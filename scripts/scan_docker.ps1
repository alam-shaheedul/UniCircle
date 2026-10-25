param([Parameter(Mandatory = $true)][string]$Version)

$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$') { throw 'Invalid image version.' }
# Immutable, post-incident upstream Trivy release. No Docker socket, credentials,
# project environment files, or application data are mounted into the scanner.
$scanner = 'aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa'
$repo = Split-Path $PSScriptRoot -Parent
$artifacts = Join-Path $repo 'tmp\docker-security'
$exports = Join-Path $artifacts 'exports'
$reports = Join-Path $artifacts 'reports'
New-Item -ItemType Directory -Force $exports, $reports | Out-Null
$findings = $false
foreach ($service in @('backend', 'frontend', 'postgres')) {
    $target = if ($service -eq 'postgres') {
        'postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea'
    } else { "unicircle-${service}:$Version" }
    $archive = Join-Path $exports "$service.tar"
    $reportPath = Join-Path $reports "$service.json"
    try {
        & docker image save --output $archive $target
        if ($LASTEXITCODE -ne 0) { throw "Could not export $target" }
        $scanStarted = [DateTime]::UtcNow
        & docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges:true `
            --tmpfs '/tmp:rw,noexec,nosuid,size=256m' `
            --mount "type=bind,source=$exports,target=/exports,readonly" `
            --mount "type=bind,source=$reports,target=/reports" `
            --mount 'type=volume,source=unicircle_trivy_cache,target=/cache' `
            $scanner image --cache-dir /cache --timeout 15m --no-progress --scanners vuln `
            --format json --output "/reports/$service.json" --input "/exports/$service.tar" `
            --severity HIGH,CRITICAL --exit-code 1
        $scanExit = $LASTEXITCODE
        if ($scanExit -notin @(0, 1)) { throw "Scanner failed for $service" }
        if (-not (Test-Path -LiteralPath $reportPath) -or (Get-Item -LiteralPath $reportPath).LastWriteTimeUtc -lt $scanStarted) {
            throw "Scanner failed to produce a fresh report for $service"
        }
        $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
        if (-not $report.SchemaVersion -or -not $report.Results) { throw "Invalid scanner report for $service" }
        if ($scanExit -eq 1) { $findings = $true }
        Write-Output "Security report: $reports\$service.json"
    } finally {
        # These are disposable exports of the named images, not application data.
        if ((Split-Path $archive -Parent) -ne $exports) { throw 'Unexpected archive cleanup scope.' }
        if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    }
}
if ($findings) { throw 'High/critical findings require review. See tmp/docker-security/reports; do not release without remediation or approved risk acceptance.' }
Write-Output 'Image scans found no known high/critical vulnerabilities.'
