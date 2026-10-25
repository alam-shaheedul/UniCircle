param([string]$Version = '')

$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $revision = (& git rev-parse HEAD | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read Git revision.' }
    $dirty = [bool](& git status --porcelain)
    if (-not $Version) {
        $Version = $revision.Substring(0, 12)
        if ($dirty) { $Version += '-dirty' }
    }
    if ($Version -notmatch '^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$') { throw 'Invalid image version.' }
    if ($dirty -and $Version -notmatch '-dirty$') {
        throw 'Commit changes first or use a -dirty version for an uncommitted build.'
    }
    foreach ($service in @('backend', 'frontend')) {
        & docker build --tag "unicircle-${service}:$Version" --build-arg "IMAGE_VERSION=$Version" --build-arg "VCS_REF=$revision" "./$service"
        if ($LASTEXITCODE -ne 0) { throw "Image build failed: $service" }
    }
    Write-Output "Built both images with IMAGE_TAG=$Version and revision=$revision."
} finally {
    Pop-Location
}
