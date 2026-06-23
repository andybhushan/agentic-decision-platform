<#
.SYNOPSIS
  Loads the synthetic claim corpus into the v1 Fabric Lakehouse semantic layer.

.DESCRIPTION
  Implements step 2 of the ADR-0011 migration plan. Materializes the same three tables
  as the v0 Azure SQL backend (dim_policyholder, dim_vehicle, fact_claims) inside the
  Fabric Lakehouse so FabricLakehouseSource queries return identical answers.

  Approach: CSV-then-Load. We:
    1. Parse claims-1k.json into 3 CSV streams (matches SemanticLoader.cs exactly).
    2. Upload each CSV to the Lakehouse Files area via the OneLake DFS API.
    3. POST the Lakehouse "tables/{name}/load" REST endpoint with Overwrite mode and
       a CSV format spec. Each call returns a long-running operation; we poll until done.

  Idempotent: re-running OVERWRITES the tables (the corpus is deterministic).

.PARAMETER WorkspaceId
  GUID of the adp-v1 workspace (output of provision-fabric.ps1).

.PARAMETER LakehouseId
  GUID of the adp lakehouse.

.PARAMETER CorpusPath
  Path to claims-1k.json. Default: usecases/meridian-pnc-auto-claims/data/claims-1k.json
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$WorkspaceId,
  [Parameter(Mandatory=$true)][string]$LakehouseId,
  [string]$CorpusPath = (Join-Path $PSScriptRoot '..\usecases\meridian-pnc-auto-claims\data\claims-1k.json')
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Info([string]$msg) { Write-Host "   $msg" -ForegroundColor Gray }
function Write-OK  ([string]$msg) { Write-Host "   OK: $msg" -ForegroundColor Green }

if (-not (Test-Path $CorpusPath)) { throw "Corpus not found at $CorpusPath" }

Write-Step "Acquiring AAD tokens (Fabric + Storage)"
$fabTokenJson = az account get-access-token --resource 'https://api.fabric.microsoft.com' 2>$null
$stgTokenJson = az account get-access-token --resource 'https://storage.azure.com' 2>$null
if (-not $fabTokenJson -or -not $stgTokenJson) { throw "az login required" }
$fabToken = ($fabTokenJson | ConvertFrom-Json).accessToken
$stgToken = ($stgTokenJson | ConvertFrom-Json).accessToken
$fabHeaders = @{ Authorization = "Bearer $fabToken"; 'Content-Type' = 'application/json' }
$stgHeaders = @{ Authorization = "Bearer $stgToken" }
Write-OK "tokens acquired"

# Resolve the workspace + lakehouse names for the OneLake DFS path.
$ws = Invoke-RestMethod -Method Get -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId" -Headers $fabHeaders
$lh = Invoke-RestMethod -Method Get -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/lakehouses/$LakehouseId" -Headers $fabHeaders
$wsName = $ws.displayName
$lhName = $lh.displayName
Write-Info "workspace='$wsName'  lakehouse='$lhName'"

# 1. Parse the corpus + generate CSV files.
Write-Step "Parsing $CorpusPath"
# PS 5.1 ConvertFrom-Json doesn't support -Depth; defaults to 100 which is plenty for this shape.
$corpus = Get-Content $CorpusPath -Raw | ConvertFrom-Json
Write-OK "$($corpus.claims.Count) claims in corpus"

$tmp = Join-Path $env:TEMP "adp-fabric-load"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$phCsv = Join-Path $tmp 'dim_policyholder.csv'
$vehCsv = Join-Path $tmp 'dim_vehicle.csv'
$claimCsv = Join-Path $tmp 'fact_claims.csv'

Write-Step "Materializing CSV files"
$phMap = @{}
$vehMap = @{}
$claimRows = New-Object System.Collections.Generic.List[string]
$claimRows.Add('claim_number,policyholder_id,vin,incident_date,incident_type,severity_hint,state,channel,fnol_received_at')

function CsvField([string]$v) {
  if ($null -eq $v) { return '' }
  if ($v -match '[",\r\n]') { return '"' + $v.Replace('"','""') + '"' }
  return $v
}

foreach ($c in $corpus.claims) {
  $phId = $c.policyholder.policyholderId
  if (-not $phMap.ContainsKey($phId)) {
    $phMap[$phId] = @{
      policyholder_id = $phId
      first_name      = $c.policyholder.firstName
      last_name       = $c.policyholder.lastName
      policy_number   = $c.policy.policyNumber
      state           = $c.policyholder.address.state
      city            = $c.policyholder.address.city
    }
  }
  $vin = $c.vehicle.vin
  if (-not $vehMap.ContainsKey($vin)) {
    $vehMap[$vin] = @{
      vin   = $vin
      plate = $c.vehicle.plate
      year  = $c.vehicle.year
      make  = $c.vehicle.make
      model = $c.vehicle.model
    }
  }
  $incDate = ([datetime]$c.incidentDate).ToString('yyyy-MM-dd HH:mm:ss')
  $fnolAt  = ([datetime]$c.fnolReceivedAt).ToString('yyyy-MM-dd HH:mm:ss')
  $row = ($c.claimNumber, $phId, $vin, $incDate, $c.incident.incidentType, $c.expected.severityHint, $c.policyholder.address.state, $c.channel, $fnolAt) |
    ForEach-Object { CsvField "$_" }
  $claimRows.Add(($row -join ','))
}

$phLines = @('policyholder_id,first_name,last_name,policy_number,state,city')
foreach ($v in $phMap.Values) {
  $phLines += ((CsvField $v.policyholder_id), (CsvField $v.first_name), (CsvField $v.last_name), (CsvField $v.policy_number), (CsvField $v.state), (CsvField $v.city) -join ',')
}
$vehLines = @('vin,plate,year,make,model')
foreach ($v in $vehMap.Values) {
  $vehLines += ((CsvField $v.vin), (CsvField $v.plate), $v.year.ToString(), (CsvField $v.make), (CsvField $v.model) -join ',')
}

Set-Content -Path $phCsv    -Value $phLines    -Encoding utf8
Set-Content -Path $vehCsv   -Value $vehLines   -Encoding utf8
Set-Content -Path $claimCsv -Value $claimRows  -Encoding utf8
Write-OK "$($phMap.Count) policyholders / $($vehMap.Count) vehicles / $($corpus.claims.Count) claims to CSV"

# 2. Upload to OneLake Files via DFS API.
function Upload-OneLakeFile {
  param([string]$LocalPath, [string]$RemoteRelative)

  $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
  $url   = "https://onelake.dfs.fabric.microsoft.com/$wsName/$lhName.Lakehouse/Files/$RemoteRelative"

  Write-Info "PUT $url ($($bytes.Length) bytes)"
  # Create file
  $headers = $stgHeaders.Clone()
  $headers['Content-Length'] = '0'
  $headers['x-ms-version'] = '2023-08-03'
  try {
    Invoke-WebRequest -Method Put -Uri "$url`?resource=file" -Headers $headers -UseBasicParsing | Out-Null
  } catch {
    # Overwrite is the default; ignore 409 if already exists.
    if ($_.Exception.Response.StatusCode.value__ -notin 200, 201, 409) { throw }
  }
  # Append
  $appendHeaders = $stgHeaders.Clone()
  $appendHeaders['x-ms-version'] = '2023-08-03'
  $appendHeaders['Content-Type'] = 'application/octet-stream'
  Invoke-WebRequest -Method Patch -Uri "$url`?action=append&position=0" -Headers $appendHeaders -Body $bytes -UseBasicParsing | Out-Null
  # Flush
  $flushHeaders = $stgHeaders.Clone()
  $flushHeaders['x-ms-version'] = '2023-08-03'
  $flushHeaders['Content-Length'] = '0'
  Invoke-WebRequest -Method Patch -Uri "$url`?action=flush&position=$($bytes.Length)" -Headers $flushHeaders -UseBasicParsing | Out-Null
  Write-OK "uploaded $RemoteRelative"
}

Write-Step "Uploading CSV files to OneLake Files/semantic/"
Upload-OneLakeFile -LocalPath $phCsv    -RemoteRelative 'semantic/dim_policyholder.csv'
Upload-OneLakeFile -LocalPath $vehCsv   -RemoteRelative 'semantic/dim_vehicle.csv'
Upload-OneLakeFile -LocalPath $claimCsv -RemoteRelative 'semantic/fact_claims.csv'

# 3. Load CSV → Delta tables.
function Load-Table {
  param([string]$Table, [string]$RelativeFile)

  $body = @{
    relativePath  = "Files/$RelativeFile"
    pathType      = 'File'
    mode          = 'Overwrite'
    formatOptions = @{
      format    = 'Csv'
      header    = $true
      delimiter = ','
    }
  } | ConvertTo-Json -Depth 4

  $url = "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/lakehouses/$LakehouseId/tables/$Table/load"
  Write-Info "POST tables/$Table/load (file=$RelativeFile, mode=Overwrite)"
  $resp = Invoke-WebRequest -Method Post -Uri $url -Headers $fabHeaders -Body $body -UseBasicParsing
  $opLocation = $resp.Headers['Location']
  if (-not $opLocation) {
    if ($resp.Headers['x-ms-operation-id']) {
      $opId = $resp.Headers['x-ms-operation-id']
      $opLocation = "https://api.fabric.microsoft.com/v1/operations/$opId"
    } else {
      Write-OK "$Table load accepted (no operation handle returned)"
      return
    }
  }
  # Poll operation status.
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $op = Invoke-RestMethod -Method Get -Uri $opLocation -Headers $fabHeaders
    $status = $op.status
    Write-Info "  $Table op status=$status (attempt $($i+1))"
    if ($status -eq 'Succeeded') { Write-OK "$Table loaded"; return }
    if ($status -in 'Failed','Cancelled') { throw "$Table load $status :: $($op | ConvertTo-Json -Depth 4)" }
  }
  throw "$Table load timed out after 5 minutes"
}

Write-Step "Triggering Lakehouse table loads"
Load-Table -Table 'dim_policyholder' -RelativeFile 'semantic/dim_policyholder.csv'
Load-Table -Table 'dim_vehicle'      -RelativeFile 'semantic/dim_vehicle.csv'
Load-Table -Table 'fact_claims'      -RelativeFile 'semantic/fact_claims.csv'

Write-Host ""
Write-Step "DONE - Fabric Lakehouse semantic tables loaded"
Write-Host "   dim_policyholder, dim_vehicle, fact_claims all have data from $CorpusPath" -ForegroundColor Green
