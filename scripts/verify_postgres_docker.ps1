param([string]$BackendImage = 'unicircle-backend:phase10.3')

$ErrorActionPreference = 'Stop'
$project = 'unicircle-pg-smoke-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$backendName = "$project-api"
$probeNetwork = "$project-probe"
$composePath = Join-Path (Split-Path $PSScriptRoot -Parent) 'compose.yaml'
$keys = @('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_PORT')
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
$env:POSTGRES_DB = 'unicircle_smoke'
$env:POSTGRES_USER = 'unicircle_smoke'
$env:POSTGRES_PASSWORD = [guid]::NewGuid().ToString('N')
$env:POSTGRES_PORT = '0'
$composeArgs = @('compose', '--project-name', $project, '--file', $composePath)
$created = $false
$backendCreated = $false
$probeCreated = $false

function Invoke-Compose {
    param([string[]]$Arguments)
    & docker @composeArgs @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Compose command failed: $($Arguments -join ' ')" }
}

try {
    if (& docker volume ls --filter "name=${project}_postgres_data" --quiet) {
        throw 'Refusing to reuse an existing smoke-test volume.'
    }
    $created = $true
    Invoke-Compose @('up', '--detach', '--wait', '--wait-timeout', '90', 'postgres')
    Write-Output 'PostgreSQL Compose health check passed.'
    Invoke-Compose @('exec', '-T', 'postgres', 'psql', '-U', $env:POSTGRES_USER, '-d', $env:POSTGRES_DB,
        '-v', 'ON_ERROR_STOP=1', '-c', "CREATE TABLE container_probe (value text NOT NULL); INSERT INTO container_probe VALUES ('persisted');")

    # Force container recreation while preserving the named volume.
    Invoke-Compose @('down')
    Invoke-Compose @('up', '--detach', '--wait', '--wait-timeout', '90', 'postgres')
    $value = (& docker @composeArgs exec -T postgres psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB -Atc 'SELECT value FROM container_probe;' | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $value -ne 'persisted') { throw 'Database data did not persist.' }
    Write-Output 'Named-volume persistence passed after container recreation.'

    $ErrorActionPreference = 'Continue'
    $wrongPassword = & docker @composeArgs exec -T --env PGPASSWORD=wrong-smoke-password postgres psql -h 127.0.0.1 -U $env:POSTGRES_USER -d $env:POSTGRES_DB -Atc 'SELECT 1;' 2>&1
    $wrongExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($wrongExit -eq 0 -or ($wrongPassword -join "`n") -notmatch 'password authentication failed') {
        throw 'PostgreSQL accepted an incorrect password or failed for another reason.'
    }
    Write-Output 'SCRAM password authentication passed.'

    # Stop only the smoke database, start API while it is unavailable, then recover it.
    Invoke-Compose @('stop', 'postgres')
    $databaseUrl = "postgresql+psycopg://${env:POSTGRES_USER}:${env:POSTGRES_PASSWORD}@postgres:5432/${env:POSTGRES_DB}"
    # The DB network is internal. A separate test-only bridge allows the host
    # to probe API health without exposing the actual database network.
    & docker network create $probeNetwork | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create smoke probe network.' }
    $probeCreated = $true
    $apiArgs = @('run', '--detach', '--name', $backendName, '--network', $probeNetwork,
        '--publish', '127.0.0.1::8000', '--env', 'APP_ENV=production', '--env', "DATABASE_URL=$databaseUrl",
        '--env', 'DATABASE_STARTUP_TIMEOUT_SECONDS=60', '--env', 'DATABASE_STARTUP_RETRY_SECONDS=1',
        '--env', 'JWT_SECRET=postgres-smoke-jwt-key-not-for-real-use-1234567890',
        '--env', 'OTP_PEPPER=postgres-smoke-otp-key-not-for-real-use-0987654321',
        '--env', 'SMTP_HOST=smtp.invalid', '--env', 'SMTP_USERNAME=smoke',
        '--env', 'SMTP_PASSWORD=smoke-password', '--env', 'SMTP_FROM_EMAIL=smoke@cuet.ac.bd', $BackendImage)
    & docker @apiArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not launch gated backend container.' }
    $backendCreated = $true
    & docker network connect "${project}_database" $backendName
    if ($LASTEXITCODE -ne 0) { throw 'Could not connect smoke API to database network.' }
    $binding = (& docker port $backendName 8000/tcp | Out-String).Trim()
    $waiting = $false
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        $logs = (& docker logs $backendName 2>&1 | Out-String)
        if ($logs -match 'Waiting for PostgreSQL readiness') { $waiting = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $waiting) { throw 'Backend did not retry database readiness.' }
    $servedEarly = $false
    try { $null = Invoke-RestMethod "http://$binding/health" -TimeoutSec 2; $servedEarly = $true } catch { }
    if ($servedEarly) { throw 'Backend started serving before database readiness.' }
    Invoke-Compose @('up', '--detach', '--wait', '--wait-timeout', '90', 'postgres')
    $health = $null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $health = Invoke-RestMethod "http://$binding/health" -TimeoutSec 2; break } catch { Start-Sleep -Seconds 1 }
    }
    if ($health.data.status -ne 'ok') { throw 'Backend did not recover after PostgreSQL became ready.' }
    Write-Output 'Backend waited while PostgreSQL was down and started after recovery.'
    & docker stop --time 15 $backendName | Out-Null
    $exitCode = (& docker inspect --format '{{.State.ExitCode}}' $backendName | Out-String).Trim()
    if ($exitCode -ne '0') { throw 'Gated backend did not shut down gracefully.' }
    Write-Output 'PostgreSQL and backend startup verification complete.'
} finally {
    if ($backendCreated) { & docker rm --force $backendName | Out-Null }
    if ($probeCreated) { & docker network rm $probeNetwork | Out-Null }
    if ($created) {
        # The unique project and volume were created only by this script.
        if ($project -notmatch '^unicircle-pg-smoke-[0-9a-f]{12}$') { throw 'Unexpected cleanup scope.' }
        & docker @composeArgs down --volumes --remove-orphans
    }
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
