param(
  [Parameter(Mandatory=$false, HelpMessage="Ruta completa al archivo de video fuente (por defecto la ruta que nos diste)")]
  [string]$SourcePath = "C:\Users\ml328\Videos\web\fondo.mp4",
  [Parameter(Mandatory=$false, HelpMessage="Nombre destino dentro de public (por defecto login-bg.mp4)")]
  [string]$DestFileName = "login-bg.mp4"
)

# Determinar rutas
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path (Join-Path $scriptDir '..')
$destFull = Join-Path $projectRoot "public\$DestFileName"

Write-Host "Proyecto detectado: $projectRoot"
Write-Host "Origen: $SourcePath"
Write-Host "Destino: $destFull"

if (-not (Test-Path $SourcePath)) {
  Write-Host "ERROR: No se encontró el archivo de origen:" -ForegroundColor Red
  Write-Host "  $SourcePath"
  Write-Host "Por favor asegúrate de que la ruta es correcta o copia manualmente el archivo a 'public\$DestFileName'."
  exit 1
}

# Crear carpeta public si falta
$publicDir = Split-Path -Parent $destFull
if (-not (Test-Path $publicDir)) {
  New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
}

Try {
  Copy-Item -Path $SourcePath -Destination $destFull -Force
  Write-Host "Copiado correctamente -> $destFull" -ForegroundColor Green
} Catch {
  Write-Host "Error al copiar: $_" -ForegroundColor Red
  exit 1
}

Write-Host "Si estás ejecutando el dev server, puede que necesites reiniciarlo para que detecte el nuevo archivo estático (aunque normalmente CRA lo sirve sin reinicio)."
