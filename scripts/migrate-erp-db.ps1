# ERP Database Migration Script for PostgreSQL
# This script creates the ERP database and runs the schema migration

param(
    [string]$Host = "localhost",
    [string]$Port = "5432",
    [string]$Username = "postgres",
    [string]$Password = "",
    [string]$MainDatabase = "inventory_management_main",
    [string]$ErpDatabase = "inventory_management_erp"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ERP Database Migration Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if password is provided
if ([string]::IsNullOrEmpty($Password)) {
    $SecurePassword = Read-Host "Enter PostgreSQL password for user '$Username'" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Set environment variable for password
$env:PGPASSWORD = $Password

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Host: $Host" -ForegroundColor Gray
Write-Host "  Port: $Port" -ForegroundColor Gray
Write-Host "  Username: $Username" -ForegroundColor Gray
Write-Host "  Main Database: $MainDatabase" -ForegroundColor Gray
Write-Host "  ERP Database: $ErpDatabase" -ForegroundColor Gray
Write-Host ""

# Check if psql is available
try {
    $null = Get-Command psql -ErrorAction Stop
    Write-Host "✓ PostgreSQL client (psql) found" -ForegroundColor Green
} catch {
    Write-Host "✗ PostgreSQL client (psql) not found in PATH" -ForegroundColor Red
    Write-Host "  Please install PostgreSQL client tools or add them to your PATH" -ForegroundColor Yellow
    exit 1
}

# Test connection
Write-Host ""
Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow
$testConnection = psql -h $Host -p $Port -U $Username -d postgres -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to connect to PostgreSQL" -ForegroundColor Red
    Write-Host "  Error: $testConnection" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Successfully connected to PostgreSQL" -ForegroundColor Green

# Create main database if it doesn't exist
Write-Host ""
Write-Host "Checking main database '$MainDatabase'..." -ForegroundColor Yellow
$dbExists = psql -h $Host -p $Port -U $Username -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$MainDatabase';"
if ($dbExists -eq "1") {
    Write-Host "✓ Main database '$MainDatabase' exists" -ForegroundColor Green
} else {
    Write-Host "  Creating main database '$MainDatabase'..." -ForegroundColor Yellow
    psql -h $Host -p $Port -U $Username -d postgres -c "CREATE DATABASE $MainDatabase;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Main database created successfully" -ForegroundColor Green
        
        # Run main database schema
        $mainSqlPath = Join-Path $PSScriptRoot "..\app\db\mainDb.sql"
        if (Test-Path $mainSqlPath) {
            Write-Host "  Running main database schema..." -ForegroundColor Yellow
            psql -h $Host -p $Port -U $Username -d $MainDatabase -f $mainSqlPath
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Main database schema created successfully" -ForegroundColor Green
            } else {
                Write-Host "✗ Failed to create main database schema" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "✗ Failed to create main database" -ForegroundColor Red
        exit 1
    }
}

# Create ERP database if it doesn't exist
Write-Host ""
Write-Host "Checking ERP database '$ErpDatabase'..." -ForegroundColor Yellow
$erpDbExists = psql -h $Host -p $Port -U $Username -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$ErpDatabase';"
if ($erpDbExists -eq "1") {
    Write-Host "✓ ERP database '$ErpDatabase' already exists" -ForegroundColor Green
    $response = Read-Host "Do you want to drop and recreate it? (yes/no)"
    if ($response -eq "yes") {
        Write-Host "  Dropping existing database..." -ForegroundColor Yellow
        psql -h $Host -p $Port -U $Username -d postgres -c "DROP DATABASE $ErpDatabase;"
        psql -h $Host -p $Port -U $Username -d postgres -c "CREATE DATABASE $ErpDatabase;"
        Write-Host "✓ Database recreated" -ForegroundColor Green
    } else {
        Write-Host "  Skipping database creation" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Creating ERP database '$ErpDatabase'..." -ForegroundColor Yellow
    psql -h $Host -p $Port -U $Username -d postgres -c "CREATE DATABASE $ErpDatabase;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ ERP database created successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to create ERP database" -ForegroundColor Red
        exit 1
    }
}

# Run ERP database schema
Write-Host ""
Write-Host "Running ERP database migration..." -ForegroundColor Yellow
$erpSqlPath = Join-Path $PSScriptRoot "..\app\db\erpDb.sql"
if (Test-Path $erpSqlPath) {
    psql -h $Host -p $Port -U $Username -d $ErpDatabase -f $erpSqlPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ ERP database schema created successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to create ERP database schema" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✗ ERP SQL file not found at: $erpSqlPath" -ForegroundColor Red
    exit 1
}

# Clear password from environment
$env:PGPASSWORD = $null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update your .env file with database credentials" -ForegroundColor Gray
Write-Host "  2. Run: npm install (to install dependencies)" -ForegroundColor Gray
Write-Host "  3. Run: npm run dev (to start the development server)" -ForegroundColor Gray
Write-Host ""
Write-Host "Database Connection Strings:" -ForegroundColor Yellow
Write-Host "  Main DB: postgresql://$Username:****@$Host:$Port/$MainDatabase" -ForegroundColor Gray
Write-Host "  ERP DB:  postgresql://$Username:****@$Host:$Port/$ErpDatabase" -ForegroundColor Gray
Write-Host ""
