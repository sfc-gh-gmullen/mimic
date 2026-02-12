#!/bin/bash

# SPCS Deployment Script for Data Catalog
# Optimized for Snowflake-only deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="data-catalog"
DATABASE_NAME="CATALOG_DB"
SCHEMA_NAME="CATALOG_SCHEMA"
SERVICE_NAME="CATALOG_SERVICE"
IMAGE_TAG="latest"
CONNECTION="demo142_cursor"
SERVICE_ROLE="SYSADMIN"

# Parse command line arguments
SKIP_DB_SETUP=false
SKIP_BUILD=false

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-db      Skip database setup (use when DB already configured)"
    echo "  --skip-build   Skip npm build (use when only deploying existing build)"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                       # Full deployment"
    echo "  $0 --skip-db             # Skip DB setup, rebuild and deploy"
    echo "  $0 --skip-build          # Setup DB, use existing build"
    echo "  $0 --skip-db --skip-build # Quick redeploy (image push + service restart)"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-db)
            SKIP_DB_SETUP=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 SPCS Deployment for ${APP_NAME}${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from the project root.${NC}"
    exit 1
fi

# Step 1: Database setup (skippable)
if [ "$SKIP_DB_SETUP" = false ]; then
    echo -e "${YELLOW}🗄️  Setting up database...${NC}"
    
    # Note: scripts/create_service_role.sql must be run ONCE by ACCOUNTADMIN before first deployment
    # This creates CATALOG_SERVICE_ROLE with necessary privileges
    # Run manually: snow sql -f scripts/create_service_role.sql -c $CONNECTION
    
    # Check if CATALOG_SERVICE_ROLE exists
    ROLE_EXISTS=$(snow sql -q "SHOW ROLES LIKE 'CATALOG_SERVICE_ROLE';" -c $CONNECTION --format CSV 2>/dev/null | grep -c "CATALOG_SERVICE_ROLE" || echo "0")
    if [ "$ROLE_EXISTS" = "0" ]; then
        echo -e "${RED}❌ CATALOG_SERVICE_ROLE does not exist.${NC}"
        echo -e "${YELLOW}   Run the following command as ACCOUNTADMIN first:${NC}"
        echo -e "${BLUE}   snow sql -f scripts/create_service_role.sql -c $CONNECTION${NC}"
        exit 1
    fi
    
    snow sql -f scripts/setup_database.sql -c $CONNECTION --role $SERVICE_ROLE
    snow sql -f snowflake/setup_image_repo.sql -c $CONNECTION --role $SERVICE_ROLE
else
    echo -e "${BLUE}⏭️  Skipping database setup${NC}"
fi

# Step 2: Build React app (skippable)
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}⚛️  Building React application...${NC}"
    npm run build
else
    echo -e "${BLUE}⏭️  Skipping React build${NC}"
fi

# Step 3: Get registry URL
echo -e "${YELLOW}🔍 Getting registry URL...${NC}"
REGISTRY_URL=$(snow sql -q "SHOW IMAGE REPOSITORIES IN SCHEMA ${DATABASE_NAME}.IMAGE_SCHEMA;" -c $CONNECTION --role $SERVICE_ROLE --format CSV | grep IMAGE_REPO | cut -d',' -f5 | tr -d '"')
if [ -z "$REGISTRY_URL" ]; then
    echo -e "${RED}❌ Failed to get registry URL${NC}"
    exit 1
fi

# Step 4: Build, tag, and push Docker image
echo -e "${YELLOW}🐳 Building and pushing Docker image...${NC}"
SNOWFLAKE_IMAGE_URL="${REGISTRY_URL}/${APP_NAME}:${IMAGE_TAG}"

# Build and tag in one step
docker build --platform linux/amd64 -t ${SNOWFLAKE_IMAGE_URL} .

# Login and push
snow spcs image-registry login -c $CONNECTION
docker push ${SNOWFLAKE_IMAGE_URL}

# Step 5: Deploy service (restart with new image)
echo -e "${YELLOW}☁️  Deploying SPCS service...${NC}"
snow sql -q "ALTER SERVICE IF EXISTS ${DATABASE_NAME}.${SCHEMA_NAME}.${SERVICE_NAME} SUSPEND;" -c $CONNECTION --role $SERVICE_ROLE 2>/dev/null || true
snow sql -f snowflake/deploy.sql -c $CONNECTION --role $SERVICE_ROLE

# Step 6: Wait for service ready
echo -e "${YELLOW}⏳ Waiting for service...${NC}"
for i in {1..30}; do
    STATUS=$(snow sql -q "SELECT SYSTEM\$GET_SERVICE_STATUS('${DATABASE_NAME}.${SCHEMA_NAME}.${SERVICE_NAME}');" -c $CONNECTION --role $SERVICE_ROLE --format CSV 2>/dev/null | tail -1)
    
    if [[ "$STATUS" == *"READY"* ]]; then
        echo -e "${GREEN}✅ Service ready!${NC}"
        break
    elif [[ "$STATUS" == *"FAILED"* ]]; then
        echo -e "${RED}❌ Deployment failed. Check logs:${NC}"
        echo "snow sql -q \"CALL SYSTEM\$GET_SERVICE_LOGS('${DATABASE_NAME}.${SCHEMA_NAME}.${SERVICE_NAME}', '0');\" -c $CONNECTION --role $SERVICE_ROLE"
        exit 1
    fi
    
    [ $i -eq 30 ] && { echo -e "${RED}❌ Timeout waiting for service${NC}"; exit 1; }
    sleep 10
done

# Step 7: Get and display endpoint
sleep 5  # Brief wait for endpoint provisioning
ENDPOINT=$(snow sql -q "SHOW ENDPOINTS IN SERVICE ${DATABASE_NAME}.${SCHEMA_NAME}.${SERVICE_NAME};" -c $CONNECTION --role $SERVICE_ROLE 2>&1 | grep -oE '[a-z0-9]+-[a-z0-9-]+\.snowflakecomputing\.app' | head -1)

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}   Service: ${SERVICE_NAME}${NC}"
if [ ! -z "$ENDPOINT" ]; then
    echo -e "${GREEN}   URL: https://${ENDPOINT}${NC}"
else
    echo -e "${YELLOW}   URL: Provisioning... run 'snow sql -q \"SHOW ENDPOINTS IN SERVICE ${DATABASE_NAME}.${SCHEMA_NAME}.${SERVICE_NAME};\" -c $CONNECTION --role $SERVICE_ROLE'${NC}"
fi
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
