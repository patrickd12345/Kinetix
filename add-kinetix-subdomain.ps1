# Add kinetix.bookiji.com subdomain to Vercel (Kinetix project)
# Run from Kinetix repo root after: cd Kinetix

Write-Host "Step 1: Checking Vercel authentication..." -ForegroundColor Cyan
$whoamiOutput = vercel whoami 2>&1 | Out-String
$whoami = $whoamiOutput.Trim()

if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Please run: vercel login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Logged in as: $whoami" -ForegroundColor Green

Write-Host "`nStep 2: Linking Kinetix project (from current directory)..." -ForegroundColor Cyan
vercel link --yes

Write-Host "`nStep 3: Adding kinetix.bookiji.com domain..." -ForegroundColor Cyan
vercel domains add kinetix.bookiji.com

Write-Host "`nStep 4: Verifying domain was added..." -ForegroundColor Cyan
vercel domains ls

Write-Host "`nStep 5: Getting domain DNS instructions..." -ForegroundColor Cyan
vercel domains inspect kinetix.bookiji.com

Write-Host "`nDone. Add CNAME at your registrar: host=kinetix, target=value from Vercel above." -ForegroundColor Green
Write-Host "See Kinetix/docs/deployment/KINETIX_SUBDOMAIN.md for full steps." -ForegroundColor Gray
