param([switch]$MobilePreview)
$ErrorActionPreference = 'Stop'
$midadRoot = Split-Path -Parent $PSScriptRoot
$midadRuntime = Join-Path $midadRoot '.local'
New-Item -ItemType Directory -Path $midadRuntime -Force | Out-Null
function Test-MidadDocker {
  try {
    rtk proxy docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch { return $false }
}
function Test-MidadUrl([string]$url) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch { return $false }
}
function Start-MidadServer([string]$label, [string]$working, [string]$entry, [string]$url) {
  if (Test-MidadUrl $url) { Write-Output "$label deja accessible : $url"; return }
  $midadNode = (Get-Command node.exe -ErrorAction Stop).Source
  $midadProc = Start-Process -FilePath $midadNode -ArgumentList ('"' + $entry + '"') -WorkingDirectory $working -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $midadRuntime "$label.log") -RedirectStandardError (Join-Path $midadRuntime "$label-error.log")
  Set-Content -LiteralPath (Join-Path $midadRuntime "$label.pid") -Value $midadProc.Id
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-MidadUrl $url) { Write-Output "$label pret : $url"; return }
    if ($midadProc.HasExited) { throw "$label s'est arrete. Voir .local/$label-error.log" }
    Start-Sleep -Seconds 1
  }
  throw "$label ne repond pas. Voir .local/$label-error.log"
}
if (!(Test-MidadDocker)) {
  $midadDockerCli = (Get-Command docker -ErrorAction Stop).Source
  $midadDockerHome = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $midadDockerCli))
  $midadDockerDesktop = @(
    (Join-Path $midadDockerHome 'Docker Desktop.exe'),
    (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe')
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (!$midadDockerDesktop) { throw 'Installer et lancer Docker Desktop avant Midad.' }
  Write-Output 'Demarrage de Docker Desktop...'
  Start-Process -FilePath $midadDockerDesktop -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    if (Test-MidadDocker) { break }
    Start-Sleep -Seconds 1
  }
  if (!(Test-MidadDocker)) { throw 'Docker Desktop ne repond pas. Le lancer puis reessayer.' }
}
Push-Location $midadRoot
try {
  rtk proxy docker compose -p midad -f ops/compose.local.yml up -d --wait
  if ($LASTEXITCODE -ne 0) { throw 'La base PostgreSQL ne demarre pas.' }
  if (!(Test-Path -LiteralPath (Join-Path $midadRoot '.env'))) {
    Copy-Item -LiteralPath (Join-Path $midadRoot '.env.example') -Destination (Join-Path $midadRoot '.env')
  }
  foreach ($required in @('api/dist/main.js', 'web/.next/standalone/web/server.js')) {
    if (!(Test-Path -LiteralPath (Join-Path $midadRoot $required))) { throw 'Compiler les sources : npm.cmd run build' }
  }
  Start-MidadServer 'api' (Join-Path $midadRoot 'api') 'dist/main.js' 'http://127.0.0.1:4100/api/public/health'
  Start-MidadServer 'web' $midadRoot (Join-Path $midadRoot 'scripts/serve-web.mjs') 'http://127.0.0.1:3000'
  if ($MobilePreview) {
    if (!(Test-Path -LiteralPath (Join-Path $midadRoot 'mobile/dist/index.html'))) { throw 'Generer le mobile : npm.cmd run export -w mobile' }
    Start-MidadServer 'mobile' $midadRoot (Join-Path $midadRoot 'scripts/preview-mobile.mjs') 'http://127.0.0.1:8085'
  }
  Write-Output 'Midad fonctionne. Les serveurs restent actifs apres fermeture de cette fenetre.'
} finally { Pop-Location }
