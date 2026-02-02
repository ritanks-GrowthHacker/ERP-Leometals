# API Authentication Setup Script
# Run this in PowerShell to set up the API authentication system

Write-Host "=== ERP API Authentication Setup ===" -ForegroundColor Cyan
Write-Host ""

# Database connection details
$dbHost = "localhost"
$dbPort = "5433"
$dbName = "erp_sales"
$dbUser = "postgres"

Write-Host "Setting up API authentication in database: $dbName" -ForegroundColor Yellow
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "ERROR: psql command not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client tools or add them to your PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual setup instructions:" -ForegroundColor Yellow
    Write-Host "1. Open pgAdmin or DBeaver" -ForegroundColor White
    Write-Host "2. Connect to database: $dbName (port $dbPort)" -ForegroundColor White
    Write-Host "3. Run app/db/sub-organisation-schema.sql" -ForegroundColor White
    Write-Host "4. Run app/db/api-keys-schema.sql" -ForegroundColor White
    exit 1
}

Write-Host "Found psql at: $($psqlPath.Path)" -ForegroundColor Green
Write-Host ""

# Prompt for password
$env:PGPASSWORD = Read-Host "Enter PostgreSQL password for user $dbUser" -AsSecureString
$env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:PGPASSWORD))

Write-Host ""
Write-Host "Step 1: Creating sub_organisation table..." -ForegroundColor Cyan

try {
    psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "app/db/sub-organisation-schema.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Sub-organisation table created successfully!" -ForegroundColor Green
    } else {
        throw "Failed to create sub_organisation table"
    }
} catch {
    Write-Host "✗ Error creating sub_organisation table: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Creating API keys tables..." -ForegroundColor Cyan

try {
    psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "app/db/api-keys-schema.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ API keys tables created successfully!" -ForegroundColor Green
    } else {
        throw "Failed to create API keys tables"
    }
} catch {
    Write-Host "✗ Error creating API keys tables: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verifying tables..." -ForegroundColor Cyan

$verifyQuery = @"
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('sub_organisation', 'sub_organisation_users', 'api_keys', 'api_request_logs')
ORDER BY tablename;
"@

try {
    $tables = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $verifyQuery
    
    Write-Host ""
    Write-Host "Tables created:" -ForegroundColor Green
    $tables -split "`n" | ForEach-Object {
        if ($_ -match '\|') {
            $tableName = ($_ -split '\|')[1]
            Write-Host "  ✓ $tableName" -ForegroundColor White
        }
    }
} catch {
    Write-Host "✗ Error verifying tables: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Step 4: Getting default sub-organisation ID..." -ForegroundColor Cyan

$getOrgQuery = "SELECT id, name FROM sub_organisation LIMIT 1;"

try {
    $orgResult = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -c $getOrgQuery
    
    if ($orgResult) {
        $orgId = ($orgResult -split '\|')[0]
        $orgName = ($orgResult -split '\|')[1]
        
        Write-Host ""
        Write-Host "Default Sub-Organisation:" -ForegroundColor Green
        Write-Host "  ID: $orgId" -ForegroundColor White
        Write-Host "  Name: $orgName" -ForegroundColor White
    }
} catch {
    Write-Host "  No organisations found. You can create one manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start your dev server: npm run dev" -ForegroundColor White
Write-Host "2. Login to ERP and get JWT token" -ForegroundColor White
Write-Host "3. Create API key via: POST /api/v1/api-keys" -ForegroundColor White
Write-Host "4. Use API key to access endpoints" -ForegroundColor White
Write-Host ""
Write-Host "See API_SETUP_INSTRUCTIONS.md for detailed usage" -ForegroundColor Yellow

# Clear password from environment
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
