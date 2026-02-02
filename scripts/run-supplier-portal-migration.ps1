# Supplier Portal Database Migration Script
# This script executes the supplier portal schema migration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supplier Portal Database Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Database configuration
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "erp_system"
$DB_USER = "postgres"

# Prompt for password
$DB_PASSWORD = Read-Host "Enter PostgreSQL password for user '$DB_USER'" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Set environment variable for psql
$env:PGPASSWORD = $PlainPassword

Write-Host ""
Write-Host "Connecting to database..." -ForegroundColor Yellow
Write-Host "Host: $DB_HOST" -ForegroundColor Gray
Write-Host "Port: $DB_PORT" -ForegroundColor Gray
Write-Host "Database: $DB_NAME" -ForegroundColor Gray
Write-Host "User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Check if psql is available
try {
    $psqlVersion = psql --version
    Write-Host "✓ PostgreSQL client found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Error: psql command not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client or add it to your PATH" -ForegroundColor Yellow
    Write-Host "Download from: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MigrationFile = Join-Path $ScriptDir "supplier-portal-schema.sql"

# Check if migration file exists
if (-not (Test-Path $MigrationFile)) {
    Write-Host "✗ Error: Migration file not found!" -ForegroundColor Red
    Write-Host "Expected location: $MigrationFile" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Migration file found" -ForegroundColor Green
Write-Host ""

# Backup reminder
Write-Host "⚠ IMPORTANT: It's recommended to backup your database before running migrations!" -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Do you want to proceed with the migration? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Executing migration..." -ForegroundColor Yellow
Write-Host ""

# Execute the migration
try {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $MigrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✓ Migration completed successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        # Verify the migration
        Write-Host "Verifying migration..." -ForegroundColor Yellow
        Write-Host ""
        
        $verifyQuery = @"
-- Check new columns in suppliers table
SELECT 'Suppliers table columns' as check_type, 
       COUNT(*) as count 
FROM information_schema.columns 
WHERE table_name = 'suppliers' 
AND column_name IN ('profile_image', 'otp', 'otp_expires_at', 'last_login_at')

UNION ALL

-- Check if new table exists
SELECT 'supplier_quotation_submissions table' as check_type,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supplier_quotation_submissions') 
            THEN 1 ELSE 0 END as count

UNION ALL

-- Check trigger
SELECT 'Triggers created' as check_type,
       COUNT(*) as count 
FROM pg_trigger 
WHERE tgrelid = 'supplier_quotation_submissions'::regclass;
"@
        
        $verifyQuery | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
        
        Write-Host ""
        Write-Host "Verification complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Restart your development server (npm run dev)" -ForegroundColor White
        Write-Host "2. Navigate to http://localhost:3000/supplier-portal" -ForegroundColor White
        Write-Host "3. Test the login flow with a supplier email" -ForegroundColor White
        Write-Host ""
        
    } else {
        Write-Host ""
        Write-Host "✗ Migration failed! Check the error messages above." -ForegroundColor Red
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "✗ Error executing migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
} finally {
    # Clear password from environment
    $env:PGPASSWORD = $null
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
