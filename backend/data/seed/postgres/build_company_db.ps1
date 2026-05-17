# One-command rebuild of the extensive synthetic "company" Postgres database.
#
#   powershell -ExecutionPolicy Bypass -File build_company_db.ps1
#
# Idempotent: drops and recreates the `company` database every run.
# Requires the local postgresql-x64-18 service running and creds postgres / 1234.

$ErrorActionPreference = "Stop"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$base = $PSScriptRoot
$env:PGPASSWORD = "1234"

# Prefer the backend venv's Python, fall back to system python.
$py = Join-Path $base "..\..\..\.venv\Scripts\python.exe" | Resolve-Path -ErrorAction SilentlyContinue
if (-not $py) { $py = "python" } else { $py = $py.Path }

Write-Host "1/4  generating CSV data ..." -ForegroundColor Cyan
& $py (Join-Path $base "build_company_db.py")

Write-Host "2/4  (re)creating database `company` ..." -ForegroundColor Cyan
& $psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 `
    -c "DROP DATABASE IF EXISTS company;" -c "CREATE DATABASE company;"

Write-Host "3/4  applying schema ..." -ForegroundColor Cyan
& $psql -h localhost -U postgres -d company -v ON_ERROR_STOP=1 -q -f (Join-Path $base "schema.sql")

Write-Host "4/4  bulk-loading data ..." -ForegroundColor Cyan
& $psql -h localhost -U postgres -d company -v ON_ERROR_STOP=1 -f (Join-Path $base "generated_load.sql")

Write-Host "     creating read-only role ..." -ForegroundColor Cyan
& $psql -h localhost -U postgres -d company -v ON_ERROR_STOP=1 -q -f (Join-Path $base "grants.sql")

Write-Host "`nDone. Use this DSN in the app's live connector:" -ForegroundColor Green
Write-Host "  host=localhost port=5432 dbname=company user=analyst password=1234"
