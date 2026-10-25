param([string]$Image = 'unicircle-backend:phase10.3')

$ErrorActionPreference = 'Stop'
$containerName = 'unicircle-backend-smoke-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$containerStarted = $false

# These are test-only values, not real credentials. Liveness needs no database,
# SMTP server, or Ollama connection, and this check never writes application data.
$smokeDatabase = 'postgresql+psycopg://smoke@database.invalid:5432/unicircle_smoke'
try {
    $imageConfig = (& docker image inspect --format '{{json .Config}}' $Image | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the image configuration.' }
    if ($imageConfig.Env | Where-Object { $_ -match '^(DATABASE_URL|JWT_SECRET|OTP_PEPPER|SMTP_PASSWORD)=' }) {
        throw 'Runtime credentials must not be baked into the image environment.'
    }
    Write-Output 'Checking that production startup rejects missing security configuration...'
    # Windows PowerShell turns native stderr into error records; this failure is expected.
    $ErrorActionPreference = 'Continue'
    $negativeOutput = & docker run --rm --network none --env APP_ENV=production --env "DATABASE_URL=$smokeDatabase" $Image 2>&1
    $negativeExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($negativeExit -eq 0 -or ($negativeOutput -join "`n") -notmatch 'JWT_SECRET') {
        throw 'The image did not reject missing production security settings as expected.'
    }

    Write-Output 'Starting a non-root API container with a read-only filesystem...'
    $runArgs = @(
        'run', '--detach', '--init', '--name', $containerName,
        '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
        '--publish', '127.0.0.1::8000',
        '--env', 'APP_ENV=production',
        '--env', "DATABASE_URL=$smokeDatabase",
        '--env', 'JWT_SECRET=container-smoke-jwt-key-not-for-real-use-1234567890',
        '--env', 'OTP_PEPPER=container-smoke-otp-key-not-for-real-use-0987654321',
        '--env', 'SMTP_HOST=smtp.invalid', '--env', 'SMTP_USERNAME=smoke',
        '--env', 'SMTP_PASSWORD=container-smoke-password',
        '--env', 'SMTP_FROM_EMAIL=smoke@cuet.ac.bd', $Image,
        # Liveness-only smoke deliberately bypasses the database startup gate.
        # The PostgreSQL smoke script verifies the default gated startup separately.
        'python', '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000', '--no-server-header'
    )
    & docker @runArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the smoke container.' }
    $containerStarted = $true

    $binding = (& docker port $containerName 8000/tcp | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $binding -notmatch '^127\.0\.0\.1:(\d+)$') {
        throw "Unexpected API port binding: $binding"
    }
    $url = "http://$binding/health"
    $response = $null
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri $url -TimeoutSec 3
            break
        } catch { Start-Sleep -Seconds 1 }
    }
    if ($null -eq $response -or $response.data.status -ne 'ok' -or $response.data.service -ne 'unicircle-api') {
        throw "The API did not return its expected health envelope at $url."
    }
    Write-Output "HTTP health passed: $url"

    $checks = @'
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

assert os.getuid() == 10001 and os.getgid() == 10001, 'API must run non-root'
assert os.environ['APP_ENV'] == 'production'
assert not os.access('/app/app/main.py', os.W_OK), 'API code must be read-only'
for name in ('pytest', 'ruff', 'piptools'):
    assert importlib.util.find_spec(name) is None, f'Dev tool included: {name}'
for path in Path('/app').rglob('*'):
    assert not path.name.startswith('.env'), f'Environment file included: {path}'
    assert path.name not in ('AGENTS.md', 'CLAUDE.md'), f'Agent file included: {path}'
assert not Path('/app/tests').exists()
assert not Path('/app/.venv').exists()
for snapshot in ('directory/cuet_directory.json', 'campus/cuet_campus.json'):
    with (Path('/app/app/modules') / snapshot).open() as handle:
        assert json.load(handle), f'Snapshot missing/empty: {snapshot}'
subprocess.run([sys.executable, '-m', 'pip', 'check'], check=True)
subprocess.run([sys.executable, '-m', 'alembic', 'heads'], check=True)
print('Non-root permissions, runtime dependencies, migrations, snapshots, and image exclusions passed.')
'@
    $checks | & docker exec -i $containerName python -
    if ($LASTEXITCODE -ne 0) { throw 'In-container artifact checks failed.' }

    $health = ''
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        $health = (& docker inspect --format '{{.State.Health.Status}}' $containerName | Out-String).Trim()
        if ($health -eq 'healthy') { break }
        if ($health -eq 'unhealthy') { throw 'The Docker health check reported unhealthy.' }
        Start-Sleep -Seconds 1
    }
    if ($health -ne 'healthy') { throw "Docker health check did not become healthy: $health" }
    Write-Output 'Docker HEALTHCHECK passed.'

    & docker stop --time 15 $containerName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the API container.' }
    $exitCode = (& docker inspect --format '{{.State.ExitCode}}' $containerName | Out-String).Trim()
    # Docker preserves Uvicorn's stderr. Windows PowerShell must capture that
    # stream without treating normal INFO logs as terminating native errors.
    $ErrorActionPreference = 'Continue'
    $shutdownLogs = (& docker logs $containerName 2>&1 | Out-String)
    $logExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($logExit -ne 0) { throw 'Could not read API shutdown logs.' }
    if ($exitCode -notin @('0', '143') -or $shutdownLogs -notmatch 'Application shutdown complete\.') {
        throw "API did not complete graceful shutdown: exit=$exitCode"
    }
    Write-Output 'Graceful shutdown passed. Backend image verification complete.'
} catch {
    if ($containerStarted) { & docker logs --tail 30 $containerName }
    throw
} finally {
    if ($containerStarted) {
        & docker rm --force $containerName | Out-Null
    }
}
