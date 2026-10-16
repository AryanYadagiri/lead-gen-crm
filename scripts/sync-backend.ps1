# PowerShell script to manually sync lead-generation folder to standalone backend repo
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🔄 Syncing backend subtree to AryanYadagiri/lead-generation..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$backendRemote = git remote | Select-String "^backend$"
if (-not $backendRemote) {
    git remote add backend https://github.com/AryanYadagiri/lead-generation.git
}

$tempBranch = "_sync_backend_" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
Write-Host "Splitting subtree lead-generation..." -ForegroundColor Yellow
git subtree split --prefix=lead-generation -b $tempBranch

if ($LASTEXITCODE -eq 0) {
    Write-Host "Pushing to AryanYadagiri/lead-generation (main and master)..." -ForegroundColor Yellow
    git push backend "${tempBranch}:main" --force
    git push backend "${tempBranch}:master" --force
    git branch -D $tempBranch
    Write-Host "✅ Backend synchronized successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to split lead-generation subtree." -ForegroundColor Red
}
