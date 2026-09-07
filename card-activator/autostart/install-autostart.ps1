# Motel Prestige — start the card station automatically at every logon.
#
# Registers two Scheduled Tasks (bridge + app) that:
#   - start at logon, with no time limit,
#   - restart themselves every minute if they crash or are closed,
#   - run with CARD_STATION_AUTOSTART=1 so the .bat files never wait on a keypress.
#
# No administrator rights needed: the tasks run as the logged-in user, on the
# same ports (8765 / 8080) they use when launched by hand.

$ErrorActionPreference = "Stop"

$root      = Split-Path -Parent $PSScriptRoot
$bridgeDir = Join-Path $root "hardware\orbita_bridge"
$appDir    = Join-Path $root "card-activator"
$bridgeBat = Join-Path $bridgeDir "start-bridge.bat"
$appBat    = Join-Path $appDir    "run-local.bat"

foreach ($f in @($bridgeBat, $appBat)) {
  if (-not (Test-Path $f)) {
    throw "Introuvable : $f`nLancez ce script depuis le dossier autostart\ du poste (C:\card-station\autostart\)."
  }
}

function Register-StationTask {
  param([string]$Name, [string]$Bat, [string]$WorkDir, [string]$Delay, [string]$Description)

  # `call` keeps the task alive for as long as python runs, so a crash is a real
  # task failure and the restart rule below fires.
  $argument = '/c set CARD_STATION_AUTOSTART=1&& call "' + $Bat + '"'
  $action   = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $argument -WorkingDirectory $WorkDir

  # Two triggers: session ouverte (cas normal) et demarrage machine — ce dernier
  # sert quand la connexion automatique est active apres un arret complet.
  $tLogon  = New-ScheduledTaskTrigger -AtLogOn
  $tBoot   = New-ScheduledTaskTrigger -AtStartup
  if ($Delay) { $tLogon.Delay = $Delay; $tBoot.Delay = $Delay }
  $trigger = @($tLogon, $tBoot)

  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                                           -MultipleInstances IgnoreNew
  $settings.ExecutionTimeLimit = "PT0S"          # never kill it
  $settings.RestartInterval    = "PT1M"          # crashed or closed → back in a minute
  $settings.RestartCount       = 99
  $settings.StartWhenAvailable = $true

  Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger `
                         -Settings $settings -Description $Description | Out-Null
  Write-Host ("  [ok] " + $Name)
}

Write-Host ""
Write-Host "Installation du demarrage automatique..." -ForegroundColor Cyan
Write-Host ""

Register-StationTask -Name "MotelPrestige-OrbitaBridge" -Bat $bridgeBat -WorkDir $bridgeDir `
  -Description "Bridge Orbita (encodeur USB) - port 8765. Motel Prestige."

# The app tolerates a bridge that is not up yet, but starting it a few seconds
# later avoids a pointless 'Encoder offline' on the very first screen.
Register-StationTask -Name "MotelPrestige-CardActivator" -Bat $appBat -WorkDir $appDir -Delay "PT15S" `
  -Description "Card Time Activator (interface personnel) - port 8080. Motel Prestige."

# Watchdog : rattrape tout ce que la relance-sur-echec ne voit pas.
$watchdog = Join-Path $PSScriptRoot "station-watchdog.ps1"
if (Test-Path $watchdog) {
  $wdAction  = New-ScheduledTaskAction -Execute "powershell.exe" `
               -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $watchdog + '"')
  $wdTrigger = New-ScheduledTaskTrigger -AtLogOn
  $wdTrigger.Delay = "PT3M"
  $wdTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) `
                            -RepetitionInterval (New-TimeSpan -Minutes 5) `
                            -RepetitionDuration (New-TimeSpan -Days 3650)).Repetition
  $wdSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                                             -MultipleInstances IgnoreNew
  $wdSettings.StartWhenAvailable = $true
  Unregister-ScheduledTask -TaskName "MotelPrestige-StationWatchdog" -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName "MotelPrestige-StationWatchdog" -Action $wdAction -Trigger $wdTrigger `
                         -Settings $wdSettings `
                         -Description "Verifie toutes les 5 min que les ports 8765/8080 repondent et relance si besoin." | Out-Null
  Write-Host "  [ok] MotelPrestige-StationWatchdog (controle toutes les 5 min)"
}

Write-Host ""
Write-Host "Termine. Les deux se lanceront a chaque ouverture de session." -ForegroundColor Green
Write-Host ""
Write-Host "Pour demarrer maintenant sans redemarrer :"
Write-Host '  Start-ScheduledTask -TaskName "MotelPrestige-OrbitaBridge"'
Write-Host '  Start-ScheduledTask -TaskName "MotelPrestige-CardActivator"'
Write-Host ""
Write-Host "IMPORTANT — pour que le poste demarre VRAIMENT seul apres une coupure," -ForegroundColor Yellow
Write-Host "Windows doit ouvrir la session sans mot de passe :"
Write-Host "  Win+R  ->  netplwiz  ->  decocher 'Les utilisateurs doivent entrer un nom"
Write-Host "  d'utilisateur et un mot de passe'  ->  saisir le mot de passe du compte."
Write-Host "Sans cela, les taches attendent qu'une personne ouvre la session."
Write-Host ""
