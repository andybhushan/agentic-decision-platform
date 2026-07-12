<#
.SYNOPSIS
  Loads the synthetic banking corpus (borrowers-30.json) into the Fabric Lakehouse `adp` as
  Delta tables `dim_borrower` + `fact_loan_applications`. Mirrors the Meridian loader pattern:
  CSV → OneLake DFS upload → Lakehouse `tables/{name}/load` REST.

.PARAMETER WorkspaceId
  GUID of the adp-v1 Fabric workspace.

.PARAMETER LakehouseId
  GUID of the adp Lakehouse.
#>

[CmdletBinding()]
param(
  # adp-v1 workspace / adp lakehouse (verified + loaded live 2026-07-12)
  [string]$WorkspaceId = '12b39202-bbf7-4985-8eb1-541b3cde0071',
  [string]$LakehouseId = '7ad533bb-706e-4528-b9d4-f6cd86cbf5dd',
  [string]$CorpusPath  = (Join-Path $PSScriptRoot '..\usecases\banking-loan-origination\data\borrowers-30.json')
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-OK  ([string]$msg) { Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Info([string]$msg) { Write-Host "   $msg" -ForegroundColor Gray }

if (-not (Test-Path $CorpusPath)) { throw "Corpus not found at $CorpusPath" }

Write-Step "Acquiring AAD tokens (Fabric + Storage)"
$fabToken = (az account get-access-token --resource 'https://api.fabric.microsoft.com' | ConvertFrom-Json).accessToken
$stgToken = (az account get-access-token --resource 'https://storage.azure.com' | ConvertFrom-Json).accessToken
$fabHeaders = @{ Authorization = "Bearer $fabToken"; 'Content-Type' = 'application/json' }
$stgHeaders = @{ Authorization = "Bearer $stgToken" }
Write-OK "tokens acquired"

$ws = Invoke-RestMethod -Method Get -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId" -Headers $fabHeaders
$lh = Invoke-RestMethod -Method Get -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/lakehouses/$LakehouseId" -Headers $fabHeaders
$wsName = $ws.displayName
$lhName = $lh.displayName
Write-Info "workspace='$wsName'  lakehouse='$lhName'"

Write-Step "Parsing $CorpusPath"
$corpus = Get-Content $CorpusPath -Raw | ConvertFrom-Json
Write-OK "$($corpus.borrowers.Count) borrowers / $($corpus.applications.Count) applications"

$tmp = Join-Path $env:TEMP 'adp-banking-load'
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$borrowerCsv = Join-Path $tmp 'dim_borrower.csv'
$appCsv      = Join-Path $tmp 'fact_loan_applications.csv'

function CsvField([string]$v) {
  if ($null -eq $v) { return '' }
  if ($v -match '[",\r\n]') { return '"' + $v.Replace('"','""') + '"' }
  return $v
}

Write-Step "Materializing CSV files"
$bRows = @('borrower_id,full_name,state,age_band,employer,income_band')
foreach ($b in $corpus.borrowers) {
  $bRows += @(((CsvField $b.borrowerId), (CsvField $b.fullName), (CsvField $b.state), (CsvField $b.ageBand), (CsvField $b.employer), (CsvField $b.incomeBand)) -join ',')
}
Set-Content -Path $borrowerCsv -Value $bRows -Encoding utf8

$aRows = @('application_id,borrower_id,application_date,loan_amount,term_months,loan_purpose,decision,state')
foreach ($a in $corpus.applications) {
  $date = ([datetime]$a.applicationDate).ToString('yyyy-MM-dd HH:mm:ss')
  $aRows += @(((CsvField $a.applicationId), (CsvField $a.borrowerId), $date, $a.loanAmount.ToString(), $a.termMonths.ToString(), (CsvField $a.loanPurpose), (CsvField $a.decision), (CsvField $a.state)) -join ',')
}
Set-Content -Path $appCsv -Value $aRows -Encoding utf8
Write-OK "$($corpus.borrowers.Count) borrowers + $($corpus.applications.Count) applications written to CSV"

function Upload-OneLakeFile {
  param([string]$LocalPath, [string]$RemoteRelative)
  $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
  $url   = "https://onelake.dfs.fabric.microsoft.com/$wsName/$lhName.Lakehouse/Files/$RemoteRelative"
  $headers = $stgHeaders.Clone()
  $headers['Content-Length'] = '0'
  $headers['x-ms-version'] = '2023-08-03'
  try { Invoke-WebRequest -Method Put -Uri "$url`?resource=file" -Headers $headers -UseBasicParsing | Out-Null }
  catch { if ($_.Exception.Response.StatusCode.value__ -notin 200, 201, 409) { throw } }
  $appendHeaders = $stgHeaders.Clone()
  $appendHeaders['x-ms-version'] = '2023-08-03'
  $appendHeaders['Content-Type'] = 'application/octet-stream'
  Invoke-WebRequest -Method Patch -Uri "$url`?action=append&position=0" -Headers $appendHeaders -Body $bytes -UseBasicParsing | Out-Null
  $flushHeaders = $stgHeaders.Clone()
  $flushHeaders['x-ms-version'] = '2023-08-03'
  $flushHeaders['Content-Length'] = '0'
  Invoke-WebRequest -Method Patch -Uri "$url`?action=flush&position=$($bytes.Length)" -Headers $flushHeaders -UseBasicParsing | Out-Null
  Write-OK "uploaded $RemoteRelative ($($bytes.Length) bytes)"
}

Write-Step "Uploading CSVs to OneLake Files/banking/"
Upload-OneLakeFile -LocalPath $borrowerCsv -RemoteRelative 'banking/dim_borrower.csv'
Upload-OneLakeFile -LocalPath $appCsv      -RemoteRelative 'banking/fact_loan_applications.csv'

function Load-Table {
  param([string]$Table, [string]$RelativeFile)
  $body = @{
    relativePath  = "Files/$RelativeFile"
    pathType      = 'File'
    mode          = 'Overwrite'
    formatOptions = @{ format = 'Csv'; header = $true; delimiter = ',' }
  } | ConvertTo-Json -Depth 4
  $url = "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/lakehouses/$LakehouseId/tables/$Table/load"
  Write-Info "POST tables/$Table/load"
  $resp = Invoke-WebRequest -Method Post -Uri $url -Headers $fabHeaders -Body $body -UseBasicParsing
  $opLocation = $resp.Headers['Location']
  if (-not $opLocation -and $resp.Headers['x-ms-operation-id']) {
    $opLocation = "https://api.fabric.microsoft.com/v1/operations/$($resp.Headers['x-ms-operation-id'])"
  }
  if (-not $opLocation) { Write-OK "$Table load accepted"; return }
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $op = Invoke-RestMethod -Method Get -Uri $opLocation -Headers $fabHeaders
    Write-Info "  $Table status=$($op.status)"
    if ($op.status -eq 'Succeeded') { Write-OK "$Table loaded"; return }
    if ($op.status -in 'Failed','Cancelled') { throw "$Table load $($op.status)" }
  }
  throw "$Table timed out"
}

Write-Step "Triggering Lakehouse table loads"
Load-Table -Table 'dim_borrower'            -RelativeFile 'banking/dim_borrower.csv'
Load-Table -Table 'fact_loan_applications'  -RelativeFile 'banking/fact_loan_applications.csv'

Write-Step "Refreshing SQL endpoint metadata"
$epId = $lh.properties.sqlEndpointProperties.id
Invoke-WebRequest -Method Post `
  -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/sqlEndpoints/$epId/refreshMetadata?preview=true" `
  -Headers $fabHeaders -Body '{}' -UseBasicParsing | Out-Null
Write-OK "refresh requested (1-3 min for tables to appear in INFORMATION_SCHEMA)"

Write-Host ""
Write-Host "DONE - Banking tables loaded into Lakehouse '$lhName'" -ForegroundColor Green
