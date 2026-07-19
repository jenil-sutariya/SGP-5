# SmartSched Windows setup helper
$Root = Split-Path -Parent $PSScriptRoot
Copy-Item "$Root\backend\.env.development" "$Root\backend\.env" -Force
Copy-Item "$Root\frontend\.env.development" "$Root\frontend\.env" -Force
Push-Location "$Root\backend"; npm install; npx prisma generate; Pop-Location
Push-Location "$Root\frontend"; npm install; Pop-Location
Write-Host "Next: start PostgreSQL, then:"
Write-Host "  cd backend; npx prisma migrate deploy; npm run prisma:seed; npm run dev"
Write-Host "  cd frontend; npm run dev"
