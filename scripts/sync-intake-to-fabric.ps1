<#
.SYNOPSIS
  Fabric write-back of runtime intake: rebuilds the lakehouse semantic tables as the FULL
  synthetic universe (claims-1k.json / borrowers-30.json, the population the agents'
  similar-claims grounding depends on) OVERLAID with every subject filed through the
  portals at runtime. Where a runtime subject id collides with a universe row, the runtime
  row wins: the platform's operational truth replaces the synthetic placeholder.

  Idempotent by design: full rebuild + mode=Overwrite. Run any time; pre-demo is ideal.
  Mirrors load-fabric-lakehouse.ps1 / load-fabric-banking.ps1 mechanics (CSV -> OneLake DFS
  -> tables/{name}/load) and runs under the signed-in az identity.

.PARAMETER ApiBase
  The TracesApi base URL (default: the live Container App).
#>

[CmdletBinding()]
param(
  [string]$WorkspaceId = '12b39202-bbf7-4985-8eb1-541b3cde0071',
  [string]$LakehouseId = '7ad533bb-706e-4528-b9d4-f6cd86cbf5dd',
  [string]$ApiBase     = 'https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api',
  [string]$ClaimsUniversePath  = (Join-Path $PSScriptRoot '..\usecases\meridian-pnc-auto-claims\data\claims-1k.json'),
  [string]$BankingUniversePath = (Join-Path $PSScriptRoot '..\usecases\banking-loan-origination\data\borrowers-30.json')
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-OK  ([string]$msg) { Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Info([string]$msg) { Write-Host "   $msg" -ForegroundColor Gray }

function CsvField([string]$v) {
  if ($null -eq $v) { return '' }
  if ($v -match '[",\r\n]') { return '"' + $v.Replace('"','""') + '"' }
  return $v
}

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

# 1. Load the synthetic universes and fetch runtime intake from the live platform.
Write-Step "Loading universes + fetching runtime intake from $ApiBase"
if (-not (Test-Path $ClaimsUniversePath))  { throw "Claims universe not found at $ClaimsUniversePath" }
if (-not (Test-Path $BankingUniversePath)) { throw "Banking universe not found at $BankingUniversePath" }
$claimsUniverse  = Get-Content $ClaimsUniversePath -Raw | ConvertFrom-Json
$bankingUniverse = Get-Content $BankingUniversePath -Raw | ConvertFrom-Json

$ins  = Invoke-RestMethod -Method Get -Uri "$ApiBase/records?industry=insurance"
$bank = Invoke-RestMethod -Method Get -Uri "$ApiBase/records?industry=banking"
$insIntakeIds  = @($ins.intake.PSObject.Properties.Name)
$bankIntakeIds = @($bank.intake.PSObject.Properties.Name)
$insIntake  = @($ins.records  | Where-Object { $insIntakeIds  -contains $_.claimNumber })
$bankIntake = @($bank.records | Where-Object { $bankIntakeIds -contains $_.applicationId })
Write-OK "universe: $($claimsUniverse.claims.Count) claims / $($bankingUniverse.applications.Count) applications"
Write-OK "runtime intake: $($insIntake.Count) claims / $($bankIntake.Count) applications (these replace colliding universe rows)"

$tmp = Join-Path $env:TEMP 'adp-fabric-sync'
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

# 2. Claims side: dim_policyholder, dim_vehicle, fact_claims (schema identical to the base loader).
Write-Step "Materializing claims CSVs (universe overlaid with intake)"
$phMap = @{}
$vehMap = @{}
$claimMap = [ordered]@{}

function Add-Claim($c) {
  $phId = $c.policyholder.policyholderId
  if ($phId -and -not $phMap.ContainsKey($phId)) {
    $phMap[$phId] = @($phId, $c.policyholder.firstName, $c.policyholder.lastName, $c.policy.policyNumber, $c.policyholder.address.state, $c.policyholder.address.city)
  }
  $vin = "$($c.vehicle.vin)"
  if ($vin -and -not $script:vehMap.ContainsKey($vin)) {
    $script:vehMap[$vin] = @($vin, $c.vehicle.plate, "$($c.vehicle.year)", $c.vehicle.make, $c.vehicle.model)
  }
  $incDate = ''
  if ($c.incidentDate) { $incDate = ([datetime]$c.incidentDate).ToString('yyyy-MM-dd HH:mm:ss') }
  $fnolAt = ''
  if ($c.fnolReceivedAt) { $fnolAt = ([datetime]$c.fnolReceivedAt).ToString('yyyy-MM-dd HH:mm:ss') }
  # Universe rows carry an eval severity hint; runtime intake rows deliberately have none.
  $sev = ''
  if ($c.expected -and $c.expected.severityHint) { $sev = $c.expected.severityHint }
  $row = ($c.claimNumber, $phId, $vin, $incDate, $c.incident.incidentType, $sev, $c.policyholder.address.state, $c.channel, $fnolAt) | ForEach-Object { CsvField "$_" }
  $script:claimMap[$c.claimNumber] = ($row -join ',')
}

foreach ($c in $claimsUniverse.claims) { Add-Claim $c }
foreach ($c in $insIntake)             { Add-Claim $c }   # runtime truth replaces colliding ids

$claimRows = New-Object System.Collections.Generic.List[string]
$claimRows.Add('claim_number,policyholder_id,vin,incident_date,incident_type,severity_hint,state,channel,fnol_received_at')
foreach ($r in $claimMap.Values) { $claimRows.Add($r) }

$phLines = @('policyholder_id,first_name,last_name,policy_number,state,city')
foreach ($v in $phMap.Values) { $phLines += (($v | ForEach-Object { CsvField "$_" }) -join ',') }
$vehLines = @('vin,plate,year,make,model')
foreach ($v in $vehMap.Values) { $vehLines += (($v | ForEach-Object { CsvField "$_" }) -join ',') }

$phCsv = Join-Path $tmp 'dim_policyholder.csv'
$vehCsv = Join-Path $tmp 'dim_vehicle.csv'
$claimCsv = Join-Path $tmp 'fact_claims.csv'
Set-Content -Path $phCsv -Value $phLines -Encoding utf8
Set-Content -Path $vehCsv -Value $vehLines -Encoding utf8
Set-Content -Path $claimCsv -Value $claimRows -Encoding utf8
Write-OK "$($phMap.Count) policyholders / $($vehMap.Count) vehicles / $($claimRows.Count - 1) claims"

# 3. Banking side: dim_borrower, fact_loan_applications (schema identical to the banking loader).
Write-Step "Materializing banking CSVs (universe overlaid with intake)"
$bMap = @{}
$appMap = [ordered]@{}

foreach ($b in $bankingUniverse.borrowers) {
  $bMap["$($b.borrowerId)"] = @("$($b.borrowerId)", $b.fullName, $b.state, $b.ageBand, $b.employer, $b.incomeBand)
}
foreach ($a in $bankingUniverse.applications) {
  $date = ''
  if ($a.applicationDate) { $date = ([datetime]$a.applicationDate).ToString('yyyy-MM-dd') }
  $row = ($a.applicationId, $a.borrowerId, $date, "$($a.loanAmount)", "$($a.termMonths)", $a.loanPurpose, "$($a.decision)", $a.state) | ForEach-Object { CsvField "$_" }
  $appMap["$($a.applicationId)"] = ($row -join ',')
}
foreach ($a in $bankIntake) {
  $bid = "$($a.borrowerId)"
  if ($bid -and -not $bMap.ContainsKey($bid)) {
    $bMap[$bid] = @($bid, "$($a.borrowerName)", $a.state, $a.ageBand, $a.employer, '')
  }
  $date = ''
  if ($a.applicationDate) { $date = ([datetime]$a.applicationDate).ToString('yyyy-MM-dd') }
  $row = ($a.applicationId, $bid, $date, "$($a.loanAmount)", "$($a.termMonths)", $a.loanPurpose, '', $a.state) | ForEach-Object { CsvField "$_" }
  $appMap["$($a.applicationId)"] = ($row -join ',')   # runtime truth replaces colliding ids
}

$aRows = New-Object System.Collections.Generic.List[string]
$aRows.Add('application_id,borrower_id,application_date,loan_amount,term_months,loan_purpose,decision,state')
foreach ($r in $appMap.Values) { $aRows.Add($r) }

$bLines = @('borrower_id,full_name,state,age_band,employer,income_band')
foreach ($v in $bMap.Values) { $bLines += (($v | ForEach-Object { CsvField "$_" }) -join ',') }

$borrowerCsv = Join-Path $tmp 'dim_borrower.csv'
$appCsv = Join-Path $tmp 'fact_loan_applications.csv'
Set-Content -Path $borrowerCsv -Value $bLines -Encoding utf8
Set-Content -Path $appCsv -Value $aRows -Encoding utf8
Write-OK "$($bMap.Count) borrowers / $($aRows.Count - 1) applications"

# 4. Upload to OneLake Files + Overwrite-load the Delta tables.
function Upload-OneLakeFile {
  param([string]$LocalPath, [string]$RemoteRelative)
  $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
  $url = "https://onelake.dfs.fabric.microsoft.com/$wsName/$lhName.Lakehouse/Files/$RemoteRelative"
  $headers = $stgHeaders.Clone(); $headers['Content-Length'] = '0'; $headers['x-ms-version'] = '2023-08-03'
  try { Invoke-WebRequest -Method Put -Uri "$url`?resource=file" -Headers $headers -UseBasicParsing | Out-Null }
  catch { if ($_.Exception.Response.StatusCode.value__ -notin 200, 201, 409) { throw } }
  $appendHeaders = $stgHeaders.Clone(); $appendHeaders['x-ms-version'] = '2023-08-03'; $appendHeaders['Content-Type'] = 'application/octet-stream'
  Invoke-WebRequest -Method Patch -Uri "$url`?action=append&position=0" -Headers $appendHeaders -Body $bytes -UseBasicParsing | Out-Null
  $flushHeaders = $stgHeaders.Clone(); $flushHeaders['x-ms-version'] = '2023-08-03'; $flushHeaders['Content-Length'] = '0'
  Invoke-WebRequest -Method Patch -Uri "$url`?action=flush&position=$($bytes.Length)" -Headers $flushHeaders -UseBasicParsing | Out-Null
  Write-OK "uploaded $RemoteRelative"
}

function Load-Table {
  param([string]$Table, [string]$RelativeFile)
  $body = @{ relativePath = "Files/$RelativeFile"; pathType = 'File'; mode = 'Overwrite'; formatOptions = @{ format = 'Csv'; header = $true; delimiter = ',' } } | ConvertTo-Json -Depth 4
  $url = "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/lakehouses/$LakehouseId/tables/$Table/load"
  Write-Info "POST tables/$Table/load (mode=Overwrite)"
  $resp = Invoke-WebRequest -Method Post -Uri $url -Headers $fabHeaders -Body $body -UseBasicParsing
  $opLocation = $resp.Headers['Location']
  if (-not $opLocation -and $resp.Headers['x-ms-operation-id']) { $opLocation = "https://api.fabric.microsoft.com/v1/operations/$($resp.Headers['x-ms-operation-id'])" }
  if (-not $opLocation) { Write-OK "$Table load accepted"; return }
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $op = Invoke-RestMethod -Method Get -Uri $opLocation -Headers $fabHeaders
    if ($op.status -eq 'Succeeded') { Write-OK "$Table loaded"; return }
    if ($op.status -in 'Failed','Cancelled') { throw "$Table load $($op.status) :: $($op | ConvertTo-Json -Depth 4)" }
  }
  throw "$Table load timed out"
}

Write-Step "Uploading CSVs to OneLake Files/semantic/"
Upload-OneLakeFile -LocalPath $phCsv       -RemoteRelative 'semantic/dim_policyholder.csv'
Upload-OneLakeFile -LocalPath $vehCsv      -RemoteRelative 'semantic/dim_vehicle.csv'
Upload-OneLakeFile -LocalPath $claimCsv    -RemoteRelative 'semantic/fact_claims.csv'
Upload-OneLakeFile -LocalPath $borrowerCsv -RemoteRelative 'semantic/dim_borrower.csv'
Upload-OneLakeFile -LocalPath $appCsv      -RemoteRelative 'semantic/fact_loan_applications.csv'

Write-Step "Overwrite-loading Delta tables"
Load-Table -Table 'dim_policyholder'       -RelativeFile 'semantic/dim_policyholder.csv'
Load-Table -Table 'dim_vehicle'            -RelativeFile 'semantic/dim_vehicle.csv'
Load-Table -Table 'fact_claims'            -RelativeFile 'semantic/fact_claims.csv'
Load-Table -Table 'dim_borrower'           -RelativeFile 'semantic/dim_borrower.csv'
Load-Table -Table 'fact_loan_applications' -RelativeFile 'semantic/fact_loan_applications.csv'

# 5. Force the SQL analytics endpoint to pick up the new Delta versions; without this the
# endpoint (and therefore the Data Agent's SQL) can serve stale rows for many minutes.
Write-Step "Refreshing SQL endpoint metadata"
$sqlEndpointId = 'e205e3fc-38da-4d2d-8e0f-c8c42a199aa6'
$refresh = Invoke-RestMethod -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/sqlEndpoints/$sqlEndpointId/refreshMetadata?preview=true" -Headers $fabHeaders -Body '{}'
$synced = @($refresh | Where-Object { $_.status -eq 'Success' } | ForEach-Object { $_.tableName })
Write-OK "metadata refreshed ($($synced -join ', '))"

Write-Step "Done"
Write-Host "   Lakehouse = full universe + runtime intake overlay; the published Data Agent answers about subjects filed minutes ago." -ForegroundColor Green
