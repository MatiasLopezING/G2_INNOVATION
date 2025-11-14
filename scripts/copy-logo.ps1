param(
  [Parameter(Mandatory=$false)]
  [string]$SourcePath = "C:\Users\ml328\Pictures\web\RecetApp.png",
  [Parameter(Mandatory=$false)]
  [string]$DestName = "RecetApp.png"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path (Join-Path $scriptDir '..')
$publicDir = Join-Path $projectRoot 'public'
$destFull = Join-Path $publicDir $DestName
$dest192 = Join-Path $publicDir 'logo192.png'
$dest512 = Join-Path $publicDir 'logo512.png'

Write-Host "Proyecto: $projectRoot"
Write-Host "Origen: $SourcePath"
Write-Host "Destino principal: $destFull"

if (-not (Test-Path $SourcePath)) {
  Write-Host "ERROR: archivo fuente no encontrado: $SourcePath" -ForegroundColor Red
  exit 1
}

# crear public si no existe
if (-not (Test-Path $publicDir)) { New-Item -ItemType Directory -Path $publicDir -Force | Out-Null }

Try {
  Copy-Item -Path $SourcePath -Destination $destFull -Force
  Copy-Item -Path $SourcePath -Destination $dest192 -Force
  Copy-Item -Path $SourcePath -Destination $dest512 -Force
  Write-Host "Logos copiados a public: $destFull, logo192.png, logo512.png" -ForegroundColor Green
} Catch {
  Write-Host "Error copiando archivos: $_" -ForegroundColor Red
  exit 1
}

Write-Host "Recuerda reiniciar el dev server si está en ejecución: npm start"