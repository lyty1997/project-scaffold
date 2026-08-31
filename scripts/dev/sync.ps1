# Bidirectional synchronization: fetch, pull --rebase, and push the current branch
# when needed. This is the PowerShell counterpart to scripts/dev/sync.sh for the
# cross-machine preview loop in docs/architecture/dev-workflow.md.
# -RestartPreview is an optional Windows-only final step. After a successful push,
# it asks the Linux preview host over SSH to fetch the commit and restart the server.
param(
    [switch]$RestartPreview
)
$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0) { exit 1 }
Set-Location $repoRoot

$branch = (git symbolic-ref --quiet --short HEAD)
if ($LASTEXITCODE -ne 0 -or -not $branch) {
    Write-Error "sync.ps1 requires a named branch; HEAD is currently detached."
    exit 1
}

Write-Host "== [sync] branch ${branch}: git fetch =="
git fetch origin
if ($LASTEXITCODE -ne 0) {
    Write-Error "git fetch failed with exit code $LASTEXITCODE."
    exit 1
}

git show-ref --quiet "refs/remotes/origin/$branch"
$remoteExists = ($LASTEXITCODE -eq 0)
if ($remoteExists) {
    Write-Host "== [sync] branch ${branch}: git pull --rebase =="
    git pull --rebase origin $branch
    if ($LASTEXITCODE -ne 0) {
        Write-Error "git pull --rebase failed with exit code $LASTEXITCODE. Resolve any conflicts manually."
        exit 1
    }
} else {
    Write-Host "== [sync] origin/$branch does not exist yet; skipping pull =="
}

git rev-parse --quiet --verify '@{u}' | Out-Null
$ahead = 0
if ($LASTEXITCODE -eq 0) {
    $ahead = [int](git rev-list --count '@{u}..HEAD')
}

if ($ahead -gt 0 -or -not $remoteExists) {
    Write-Host "== [sync] pushing $branch to origin ($ahead local commit(s) ahead) =="
    git push --set-upstream origin $branch
    if ($LASTEXITCODE -ne 0) {
        Write-Error "git push failed with exit code $LASTEXITCODE."
        exit 1
    }
} else {
    Write-Host "== [sync] no local commits to push =="
}

$head = (git rev-parse --short HEAD)
Write-Host "== [sync] complete; current HEAD: $head =="

if ($RestartPreview) {
    & (Join-Path $PSScriptRoot "restart-remote.ps1") -Branch $branch
    if ($LASTEXITCODE -ne 0) { exit 1 }
}
