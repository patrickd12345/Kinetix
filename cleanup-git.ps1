# Cleanup script to remove node_modules and other build artifacts from git

Write-Host "Checking git status..."
git status --short | Measure-Object -Line

Write-Host "`nRemoving node_modules from git tracking..."
if (git ls-files | Select-String "node_modules" -Quiet) {
    git rm -r --cached web/node_modules 2>&1
    Write-Host "Removed web/node_modules"
} else {
    Write-Host "node_modules not tracked in git"
}

Write-Host "`nRemoving dist from git tracking..."
if (git ls-files | Select-String "^web/dist" -Quiet) {
    git rm -r --cached web/dist 2>&1
    Write-Host "Removed web/dist"
}

Write-Host "`nAdding .gitignore files..."
git add .gitignore web/.gitignore

Write-Host "`nCurrent git status:"
git status --short | Select-Object -First 20

Write-Host "`nTotal files in git index:"
git ls-files | Measure-Object -Line

Write-Host "`nDone! If you see changes, commit them with:"
Write-Host "git commit -m 'Remove node_modules and build artifacts from tracking'"



