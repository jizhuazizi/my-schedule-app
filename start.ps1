$ErrorActionPreference='Stop'
$runtime=Get-Command node -ErrorAction SilentlyContinue
$nodePath=if($runtime){$runtime.Source}else{'C:\Users\Owner\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(!(Test-Path -LiteralPath $nodePath)){throw 'Node runtime not found.'}
function ServerReady {
  try {$response=Invoke-WebRequest 'http://localhost:5173/settings.css' -UseBasicParsing -TimeoutSec 2; return $response.Headers['Content-Type'] -like 'text/css*'} catch {return $false}
}
if(!(ServerReady)){
  Start-Process -FilePath $nodePath -ArgumentList ('"'+(Join-Path $PSScriptRoot 'server.cjs')+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
  for($attempt=0;$attempt -lt 30;$attempt++){if(ServerReady){break};Start-Sleep -Milliseconds 200}
}
if(!(ServerReady)){throw 'The server could not start. Port 5173 may be occupied.'}
Start-Process 'http://localhost:5173/'
