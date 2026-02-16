@echo off
setlocal enabledelayedexpansion

REM Data Catalog Deployment Script for Windows
REM SPCS deployment only

set "SCRIPT_NAME=deploy.bat"
set "APP_NAME=data-catalog"
set "DATABASE=CATALOG_DB"
set "SCHEMA=CATALOG_SCHEMA"
set "ROLE=CATALOG_ROLE"
set "WAREHOUSE=COMPUTE_WH"
set "CONNECTION="

REM Color codes for output
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo %BLUE%=========================================%NC%
echo %BLUE%  Data Catalog Deployment Script%NC%
echo %BLUE%=========================================%NC%
echo.

REM Parse command line arguments
set "DEPLOY_TYPE=spcs"

REM Parse additional arguments
:parse_args
if "%1"=="--connection" (
    set "CONNECTION=%2"
    shift /1
    shift /1
    goto parse_args
)
if "%1"=="--help" (
    echo Usage: %SCRIPT_NAME% --connection ^<connection-name^>
    echo.
    echo Required:
    echo   --connection   Snowflake CLI connection name
    echo.
    echo Example:
    echo   %SCRIPT_NAME% --connection my_connection
    exit /b 0
)
if not "%1"=="" (
    echo %RED%Error: Unknown option: %1%NC%
    echo Usage: %SCRIPT_NAME% --connection ^<connection-name^>
    exit /b 1
)

if "%CONNECTION%"=="" (
    echo %RED%Error: --connection parameter is required%NC%
    echo Usage: %SCRIPT_NAME% --connection ^<connection-name^>
    exit /b 1
)

REM Check prerequisites
echo %YELLOW%Checking prerequisites...%NC%

REM Check Snowflake CLI
snow --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Snowflake CLI not found. Please install: pip install snowflake-cli%NC%
    exit /b 1
)
echo %GREEN%✅ Snowflake CLI found%NC%

REM Check Docker (only for SPCS)
if "%DEPLOY_TYPE%"=="spcs" (
    docker --version >nul 2>&1
    if errorlevel 1 (
        echo %RED%❌ Docker not found. Please install Docker Desktop%NC%
        exit /b 1
    )
    echo %GREEN%✅ Docker found%NC%
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Node.js not found. Please install Node.js 18+%NC%
    exit /b 1
)
echo %GREEN%✅ Node.js found%NC%

REM Test Snowflake connection
echo %YELLOW%Testing Snowflake connection...%NC%
snow sql -c %CONNECTION% -q "SELECT CURRENT_USER(), CURRENT_ROLE();" >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Failed to connect to Snowflake with connection '%CONNECTION%'%NC%
    echo Please verify your connection: snow connection test %CONNECTION%
    exit /b 1
)
echo %GREEN%✅ Snowflake connection verified%NC%
echo.

REM =============================================================================
REM SPCS DEPLOYMENT
REM =============================================================================
echo %BLUE%☁️  Deploying to SNOWFLAKE SPCS%NC%
echo.

REM Step 1: Setup database and role
echo %YELLOW%Step 1: Setting up database and role...%NC%
snow sql -c %CONNECTION% -f scripts/create_app_role.sql
if errorlevel 1 (
    echo %RED%❌ Failed to create role and database%NC%
    exit /b 1
)
snow sql -c %CONNECTION% -f scripts/setup_database.sql
if errorlevel 1 (
    echo %RED%❌ Failed to setup database%NC%
    exit /b 1
)
echo %GREEN%✅ Database and role ready%NC%

REM Step 2: Setup image repository
echo %YELLOW%Step 2: Setting up image repository...%NC%
snow sql -c %CONNECTION% -f snowflake/setup_image_repo.sql
if errorlevel 1 (
    echo %RED%❌ Failed to setup image repository%NC%
    exit /b 1
)
echo %GREEN%✅ Image repository created%NC%

REM Step 3: Build React application
echo %YELLOW%Step 3: Building React application...%NC%
npm run build
if errorlevel 1 (
    echo %RED%❌ Failed to build React app%NC%
    exit /b 1
)
echo %GREEN%✅ React app built%NC%

REM Step 4: Get registry URL
echo %YELLOW%Step 4: Getting Snowflake registry URL...%NC%
for /f "tokens=*" %%i in ('snow spcs image-repository url %DATABASE%.%SCHEMA%.CATALOG_REPO --connection %CONNECTION%') do set "REGISTRY_URL=%%i"
    if "%REGISTRY_URL%"=="" (
        echo %RED%❌ Failed to get registry URL%NC%
        exit /b 1
    )
    echo %GREEN%✅ Registry URL: %REGISTRY_URL%%NC%
    
    REM Step 5: Build Docker image
    echo %YELLOW%Step 5: Building Docker image...%NC%
    docker build --platform linux/amd64 -t %APP_NAME%:latest .
    if errorlevel 1 (
        echo %RED%❌ Failed to build Docker image%NC%
        exit /b 1
    )
    echo %GREEN%✅ Docker image built%NC%
    
    REM Step 6: Login to registry
    echo %YELLOW%Step 6: Logging into Snowflake registry...%NC%
    snow spcs image-registry login --connection %CONNECTION%
    if errorlevel 1 (
        echo %RED%❌ Failed to login to registry%NC%
        exit /b 1
    )
    echo %GREEN%✅ Logged into registry%NC%
    
    REM Step 7: Tag and push image
    echo %YELLOW%Step 7: Pushing image to Snowflake registry...%NC%
    docker tag %APP_NAME%:latest %REGISTRY_URL%/%APP_NAME%:latest
    docker push %REGISTRY_URL%/%APP_NAME%:latest
    if errorlevel 1 (
        echo %RED%❌ Failed to push image%NC%
        exit /b 1
    )
    echo %GREEN%✅ Image pushed to registry%NC%
    
    REM Step 8: Deploy service
    echo %YELLOW%Step 8: Deploying SPCS service...%NC%
    snow sql -c %CONNECTION% -f snowflake/deploy.sql
    if errorlevel 1 (
        echo %RED%❌ Failed to deploy service%NC%
        exit /b 1
    )
    echo %GREEN%✅ Service deployed%NC%
    
    REM Step 9: Wait for service to be ready
    echo %YELLOW%Step 9: Waiting for service to be ready...%NC%
    set /a "attempts=0"
    set /a "max_attempts=20"
    
    :wait_loop
    set /a "attempts+=1"
    if %attempts% gtr %max_attempts% (
        echo %RED%❌ Service did not become ready within 10 minutes%NC%
        echo Check service status manually with: snow sql -c %CONNECTION% -q "SELECT SYSTEM$GET_SERVICE_STATUS('%DATABASE%.%SCHEMA%.CATALOG_SERVICE');"
        exit /b 1
    )
    
    echo Checking service status... (attempt %attempts%/%max_attempts%)
    for /f "tokens=*" %%i in ('snow sql -c %CONNECTION% -q "SELECT SYSTEM$GET_SERVICE_STATUS('%DATABASE%.%SCHEMA%.CATALOG_SERVICE');" --output-format=json') do set "SERVICE_STATUS=%%i"
    
    echo %SERVICE_STATUS% | findstr /i "READY" >nul
    if errorlevel 1 (
        timeout /t 30 /nobreak >nul
        goto :wait_loop
    )
    
    echo %GREEN%✅ Service is READY!%NC%
    
    REM Step 10: Get service endpoint
    echo %YELLOW%Step 10: Getting service endpoint...%NC%
    for /f "tokens=*" %%i in ('snow sql -c %CONNECTION% -q "SHOW ENDPOINTS IN SERVICE %DATABASE%.%SCHEMA%.CATALOG_SERVICE;" --output-format=json') do set "ENDPOINT_OUTPUT=%%i"
    
    REM Parse endpoint URL from JSON output (simplified - may need adjustment)
    echo %ENDPOINT_OUTPUT% | findstr /r "https://.*\.snowflakecomputing\.app" >nul
    if not errorlevel 1 (
        for /f "tokens=2 delims=," %%j in ('echo %ENDPOINT_OUTPUT% ^| findstr /r "https://.*\.snowflakecomputing\.app"') do (
            set "ENDPOINT_URL=%%j"
            set "ENDPOINT_URL=!ENDPOINT_URL:"=!"
        )
    )
    
    REM Step 11: Initial metadata refresh
    echo %YELLOW%Step 11: Running initial metadata scan...%NC%
    snow sql -c %CONNECTION% -q "USE ROLE %ROLE%; CALL %DATABASE%.%SCHEMA%.REFRESH_CATALOG_METADATA();"
    echo %GREEN%✅ Metadata scan completed%NC%
    
    echo.
    echo %GREEN%🎉 SPCS DEPLOYMENT COMPLETE! 🎉%NC%
    echo.
    if not "%ENDPOINT_URL%"=="" (
        echo %YELLOW%🌐 Your Data Catalog is live at:%NC%
        echo %BLUE%   %ENDPOINT_URL%%NC%
    ) else (
        echo %YELLOW%🌐 Get your endpoint URL with:%NC%
        echo   snow sql -c %CONNECTION% -q "SHOW ENDPOINTS IN SERVICE %DATABASE%.%SCHEMA%.CATALOG_SERVICE;"
    )
    echo.
    echo %YELLOW%📋 Post-deployment tasks:%NC%
    echo 1. Grant database access to CATALOG_ROLE for databases you want to catalog
    echo 2. Test the catalog interface at the endpoint URL
    echo 3. Share the URL with your team
    echo.
    echo %YELLOW%🛠️ Service management commands:%NC%
    echo - Check status: snow sql -c %CONNECTION% -q "SELECT SYSTEM$GET_SERVICE_STATUS('%DATABASE%.%SCHEMA%.CATALOG_SERVICE');"
    echo - View logs:    snow sql -c %CONNECTION% -q "CALL SYSTEM$GET_SERVICE_LOGS('%DATABASE%.%SCHEMA%.CATALOG_SERVICE', '0');"
    echo - Suspend:      snow sql -c %CONNECTION% -q "ALTER SERVICE %DATABASE%.%SCHEMA%.CATALOG_SERVICE SUSPEND;"
    echo - Resume:       snow sql -c %CONNECTION% -q "ALTER SERVICE %DATABASE%.%SCHEMA%.CATALOG_SERVICE RESUME;"
    echo.
    goto :eof
)

:eof
endlocal