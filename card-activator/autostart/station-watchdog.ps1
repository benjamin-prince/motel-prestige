# Motel Prestige — watchdog du poste d'encodage.
#
# Toutes les 5 minutes : si le bridge (8765) ou l'application (8080) n'écoute
# pas, relance la tâche correspondante. Rattrape les cas que la règle
# "redémarrer en cas d'échec" ne couvre pas : tâche jamais déclenchée, processus
# tué proprement, fenêtre fermée, démarrage rate après une coupure de courant.

$checks = @(
  @{ Port = 8765; Task = "MotelPrestige-OrbitaBridge"  },
  @{ Port = 8080; Task = "MotelPrestige-CardActivator" }
)

foreach ($c in $checks) {
  $listening = $false
  try {
    $listening = [bool](Get-NetTCPConnection -LocalPort $c.Port -State Listen -ErrorAction SilentlyContinue)
  } catch {
    # Get-NetTCPConnection absent (très vieux Windows) — repli sur netstat.
    $listening = [bool](netstat -an | Select-String (":" + $c.Port + "\s") | Select-String "LISTENING")
  }

  if (-not $listening) {
    try {
      Start-ScheduledTask -TaskName $c.Task -ErrorAction Stop
      Write-Output ((Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  relance " + $c.Task + " (port " + $c.Port + " muet)")
    } catch {
      Write-Output ((Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  echec relance " + $c.Task + " : " + $_.Exception.Message)
    }
  }
}
