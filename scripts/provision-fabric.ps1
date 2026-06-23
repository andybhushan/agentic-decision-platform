<#
.SYNOPSIS
  Provisions (or returns) a Fabric workspace + Lakehouse for the v1 semantic layer.

.DESCRIPTION
  Implements step 1 of the ADR-0011 migration plan. Idempotent: re-running returns the
  existing workspace/lakehouse instead of creating duplicates.

  Steps:
    1. Acquire an AAD token for the Fabric REST API.
    2. Find or create capacity-bound workspace `adp-v1`.
    3. Find or create Lakehouse `adp` inside the workspace.
    4. Print the SQL analytics endpoint connection string.

  After this script returns, set FABRIC_LAKEHOUSE_CONNECTION on the Function app and
  SEMANTIC_BACKEND=fabric to activate the v1 path.

.PARAMETER WorkspaceName
  Workspace display name. Default: adp-v1.

.PARAMETER LakehouseName
  Lakehouse display name. Default: adp.

.PARAMETER CapacityName
  Fabric capacity to bind the workspace to. Default: offeringsfabric001 (verified in tenant).

.EXAMPLE
  ./scripts/provision-fabric.ps1
  ./scripts/provision-fabric.ps1 -WorkspaceName adp-v1 -LakehouseName adp
#>

[CmdletBinding()]
param(
  [string]$WorkspaceName  = 'adp-v1',
  [string]$LakehouseName  = 'adp',
  [string]$CapacityName   = 'offeringsfabric001'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Info([string]$msg) { Write-Host "   $msg" -ForegroundColor Gray }
function Write-OK  ([string]$msg) { Write-Host "   OK: $msg" -ForegroundColor Green }

Write-Step "Acquiring AAD token for Fabric REST API"
$tokenJson = az account get-access-token --resource 'https://api.fabric.microsoft.com' 2>$null
if (-not $tokenJson) { throw "az account get-access-token failed. Run 'az login' first." }
$token = ($tokenJson | ConvertFrom-Json).accessToken
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
Write-OK "token acquired"

# 1. Find capacity
Write-Step "Resolving capacity '$CapacityName'"
$caps = Invoke-RestMethod -Method Get -Uri 'https://api.fabric.microsoft.com/v1/capacities' -Headers $headers
$cap = $caps.value | Where-Object { $_.displayName -eq $CapacityName } | Select-Object -First 1
if (-not $cap) {
  Write-Host "Capacities visible to this token:" -ForegroundColor Yellow
  $caps.value | ForEach-Object { "   - $($_.displayName) ($($_.id))" } | Write-Host
  throw "Capacity '$CapacityName' not found"
}
Write-OK "capacity id $($cap.id) (state $($cap.state))"

# 2. Find or create workspace
Write-Step "Finding or creating workspace '$WorkspaceName'"
$wsList = Invoke-RestMethod -Method Get -Uri 'https://api.fabric.microsoft.com/v1/workspaces' -Headers $headers
$ws = $wsList.value | Where-Object { $_.displayName -eq $WorkspaceName } | Select-Object -First 1
if ($ws) {
  Write-OK "workspace already exists: $($ws.id)"
  # Bind to the requested capacity if not already.
  if ($ws.capacityId -ne $cap.id) {
    Write-Info "binding workspace to capacity $($cap.id)"
    $bindBody = @{ capacityId = $cap.id } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/$($ws.id)/assignToCapacity" -Headers $headers -Body $bindBody | Out-Null
    Write-OK "bound"
  }
} else {
  $createWsBody = @{
    displayName = $WorkspaceName
    description = 'adp-v1 - semantic layer for FNOL Handler (per ADR-0011)'
    capacityId  = $cap.id
  } | ConvertTo-Json
  $ws = Invoke-RestMethod -Method Post -Uri 'https://api.fabric.microsoft.com/v1/workspaces' -Headers $headers -Body $createWsBody
  Write-OK "workspace created: $($ws.id)"
}

# 3. Find or create Lakehouse
Write-Step "Finding or creating Lakehouse '$LakehouseName' in workspace"
$lhList = Invoke-RestMethod -Method Get -Uri "https://api.fabric.microsoft.com/v1/workspaces/$($ws.id)/lakehouses" -Headers $headers
$lh = $lhList.value | Where-Object { $_.displayName -eq $LakehouseName } | Select-Object -First 1
if ($lh) {
  Write-OK "lakehouse already exists: $($lh.id)"
} else {
  $createLhBody = @{ displayName = $LakehouseName } | ConvertTo-Json
  $lh = Invoke-RestMethod -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/$($ws.id)/lakehouses" -Headers $headers -Body $createLhBody
  Write-OK "lakehouse created: $($lh.id)"
  # Lakehouse SQL endpoint takes ~30-60 seconds to provision after creation.
  Write-Info "waiting 45s for SQL analytics endpoint to provision"
  Start-Sleep -Seconds 45
}

# 4. Pull SQL analytics endpoint connection string
Write-Step "Resolving SQL analytics endpoint"
$lhFull = Invoke-RestMethod -Method Get -Uri "https://api.fabric.microsoft.com/v1/workspaces/$($ws.id)/lakehouses/$($lh.id)" -Headers $headers
$sqlEp = $lhFull.properties.sqlEndpointProperties
if (-not $sqlEp -or -not $sqlEp.connectionString) {
  Write-Host "SQL endpoint not yet provisioned. Re-run this script in 1-2 minutes." -ForegroundColor Yellow
  Write-Host "Lakehouse object so far:" -ForegroundColor Gray
  $lhFull | ConvertTo-Json -Depth 6
  exit 2
}

$server   = $sqlEp.connectionString
$database = $LakehouseName
$connStr  = "Server=tcp:$server,1433;Database=$database;Encrypt=true;TrustServerCertificate=false;Connection Timeout=60;"

Write-Step "DONE - Fabric semantic layer provisioned"
Write-Host ""
Write-Host "  Workspace ID:  $($ws.id)" -ForegroundColor White
Write-Host "  Lakehouse ID:  $($lh.id)" -ForegroundColor White
Write-Host "  SQL endpoint:  $server" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Load data:" -ForegroundColor Cyan
Write-Host "       ./scripts/load-fabric-lakehouse.ps1 -WorkspaceId $($ws.id) -LakehouseId $($lh.id)" -ForegroundColor White
Write-Host "  2. Flip the Function app to the Fabric backend:" -ForegroundColor Cyan
Write-Host "       az functionapp config appsettings set --name func-adp-v1-fnol --resource-group rg-adp-v1 --settings SEMANTIC_BACKEND=fabric FABRIC_LAKEHOUSE_CONNECTION=<connStr>" -ForegroundColor White
Write-Host ""
Write-Host "Connection string:" -ForegroundColor Yellow
Write-Host $connStr -ForegroundColor Yellow

# Emit a structured object so calling scripts can chain.
[pscustomobject]@{
  WorkspaceId        = $ws.id
  LakehouseId        = $lh.id
  SqlEndpointServer  = $server
  ConnectionString   = $connStr
}
