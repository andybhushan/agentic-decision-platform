param(
  [string]$ResourceGroup = "rg-adp-v1",
  [string]$FunctionApp   = "func-adp-v1-fnol",
  [string]$RepoRoot      = "C:\Users\AnandBhushan\Desktop\MS DT\Project ADP\adp-v1"
)

Set-Location $RepoRoot
$src = (Resolve-Path "build\tracesapi-publish").Path
$dst = Join-Path (Resolve-Path "build").Path "tracesapi.zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $dst) { Remove-Item $dst -Force }

$z = [System.IO.Compression.ZipFile]::Open($dst, "Create")
Get-ChildItem -Recurse -File $src -Force | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length + 1)
  $relForward = $rel -replace "\\", "/"
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $relForward, "Fastest") | Out-Null
}
$z.Dispose()
$sizeMb = [Math]::Round((Get-Item $dst).Length / 1MB, 2)
Write-Output ("Zip ready: $dst ($sizeMb MB)")

az functionapp deployment source config-zip --resource-group $ResourceGroup --name $FunctionApp --src $dst --build-remote false
