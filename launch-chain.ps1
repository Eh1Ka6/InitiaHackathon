$env:Path += ";" + $env:USERPROFILE + "\go\bin" + ";" + $env:USERPROFILE + "\scoop\shims"
Write-Host "=== WEAVE ROLLUP LAUNCH ===" -ForegroundColor Cyan
Write-Host "Select EVM when prompted" -ForegroundColor Yellow
Write-Host ""
weave rollup launch --force
