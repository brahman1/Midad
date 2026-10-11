$ErrorActionPreference='Stop'
$midadRoot=Split-Path -Parent $PSScriptRoot
$midadAndroid=Join-Path $midadRoot 'mobile/android'
$midadSdk=Join-Path $env:LOCALAPPDATA 'Android/Sdk'
if(!(Test-Path -LiteralPath $midadSdk)){throw 'Android SDK absent. Installer les outils officiels Android Studio.'}
if(!(Test-Path -LiteralPath (Join-Path $midadAndroid 'gradlew.bat'))){throw 'Exécuter expo prebuild --platform android --no-install avant cette commande.'}
$env:ANDROID_HOME=$midadSdk
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:4100/api'
$env:EXPO_PUBLIC_WEB_URL='http://127.0.0.1:3000'
$env:NODE_ENV='production'
$midadSdkProperty=$midadSdk.Replace('\','/')
Set-Content -LiteralPath (Join-Path $midadAndroid 'local.properties') -Value "sdk.dir=$midadSdkProperty" -Encoding ASCII
$midadGradle=Join-Path $midadAndroid 'app/build.gradle'
if(!(Select-String -LiteralPath $midadGradle -Pattern 'MIDAD_WINDOWS_PATH_FIX' -Quiet)){
  Add-Content -LiteralPath $midadGradle -Value '// MIDAD_WINDOWS_PATH_FIX' -Encoding ASCII
  Add-Content -LiteralPath $midadGradle -Value 'android { defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } } } }' -Encoding ASCII
}
if(!(Select-String -LiteralPath $midadGradle -Pattern 'MIDAD_NATIVE_STAGING' -Quiet)){
  Add-Content -LiteralPath $midadGradle -Value 'android { externalNativeBuild { cmake { buildStagingDirectory System.getenv("MIDAD_NATIVE_STAGING") } } }' -Encoding ASCII
}
$midadDrive=@('Z','Y','X','W') | Where-Object {!(Get-PSDrive -Name $_ -ErrorAction SilentlyContinue)} | Select-Object -First 1
if(!$midadDrive){throw 'Aucune lettre disponible pour raccourcir le chemin de compilation Windows.'}
rtk proxy subst "${midadDrive}:" $midadRoot
if($LASTEXITCODE -ne 0){throw 'Impossible de créer le chemin court de compilation.'}
try{
  $env:MIDAD_NATIVE_STAGING="${midadDrive}:/native-cache"
  Push-Location $midadAndroid
  try{
    rtk proxy .\gradlew.bat assembleRelease --no-daemon --console=plain
    if($LASTEXITCODE -ne 0){throw 'La compilation Android a échoué.'}
  }finally{Pop-Location}
}finally{rtk proxy subst "${midadDrive}:" /D}
$midadApk=Join-Path $midadAndroid 'app/build/outputs/apk/release/app-release.apk'
Copy-Item -LiteralPath $midadApk -Destination (Join-Path $midadRoot 'Midad-Android-test-local.apk')
Write-Output 'APK local créé. Signature de développement ; connexion USB avec adb reverse requise. Ne pas publier sur le Play Store.'
