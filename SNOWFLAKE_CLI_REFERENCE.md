# Snowflake CLI Reference - Data Catalog

Quick reference for managing the Data Catalog using Snowflake CLI (`snow` command) with the `demo142_cursor` connection.

## Connection Setup

### Verify Connection
```bash
# List all connections
snow connection list

# Test connection
snow connection test demo142_cursor

# View connection details
snow connection show demo142_cursor
```

### Configure New Connection (if needed)
```bash
snow connection add demo142_cursor \
  --account <your-account> \
  --user <your-username> \
  --password <your-password> \
  --warehouse COMPUTE_WH \
  --role ACCOUNTADMIN
```

## Deployment Commands

### Full Deployment
```bash
# Deploy entire application to SPCS
./deploy.sh --spcs

# Local development setup only
./deploy.sh --local
```

### Manual Steps

#### 1. Database Setup
```bash
# Create role and warehouse
snow sql -f scripts/create_app_role.sql -c demo142_cursor

# Create catalog database and tables
snow sql -f scripts/setup_database.sql -c demo142_cursor
```

#### 2. Image Repository
```bash
# Setup image repository
snow sql -f snowflake/setup_image_repo.sql -c demo142_cursor

# Login to registry
snow spcs image-registry login -c demo142_cursor
```

#### 3. Service Deployment
```bash
# Deploy service
snow sql -f snowflake/deploy.sql -c demo142_cursor
```

## Service Management

### Status and Monitoring
```bash
# Check service status
snow sql -c demo142_cursor -q "
SELECT SYSTEM\$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');
"

# View service logs (last 100 lines)
snow sql -c demo142_cursor -q "
CALL SYSTEM\$GET_SERVICE_LOGS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE', '0', 'data-catalog-app', 100);
"

# Show all services
snow sql -c demo142_cursor -q "SHOW SERVICES;"

# Show service details
snow sql -c demo142_cursor -q "DESCRIBE SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;"

# Get endpoint URL
snow sql -c demo142_cursor -q "SHOW ENDPOINTS IN SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;"
```

### Service Control
```bash
# Suspend service (saves costs)
snow sql -c demo142_cursor -q "
ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE SUSPEND;
"

# Resume service
snow sql -c demo142_cursor -q "
ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE RESUME;
"

# Drop service (for redeployment)
snow sql -c demo142_cursor -q "
DROP SERVICE IF EXISTS CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;
"
```

## Catalog Management

### Metadata Refresh
```bash
# Refresh catalog metadata manually
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
CALL CATALOG_DB.CATALOG_SCHEMA.REFRESH_CATALOG_METADATA();
"

# Check metadata counts
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SELECT COUNT(*) as total_tables FROM CATALOG_DB.CATALOG_SCHEMA.CATALOG_METADATA;
SELECT COUNT(DISTINCT DATABASE_NAME) as databases FROM CATALOG_DB.CATALOG_SCHEMA.CATALOG_METADATA;
"
```

### Database Access Grants
```bash
# Grant catalog role access to a database
snow sql -c demo142_cursor -q "
USE ROLE ACCOUNTADMIN;
GRANT USAGE ON DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT USAGE ON ALL SCHEMAS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON ALL TABLES IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON ALL VIEWS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON FUTURE TABLES IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON FUTURE VIEWS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
"
```

### Schedule Automatic Refresh
```bash
# Create scheduled task to refresh catalog every 6 hours
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
USE DATABASE CATALOG_DB;
USE SCHEMA CATALOG_SCHEMA;

CREATE TASK IF NOT EXISTS REFRESH_CATALOG_TASK
  WAREHOUSE = COMPUTE_WH
  SCHEDULE = 'USING CRON 0 */6 * * * America/Los_Angeles'
AS
  CALL REFRESH_CATALOG_METADATA();

-- Start the task
ALTER TASK REFRESH_CATALOG_TASK RESUME;

-- Check task status
SHOW TASKS;
"
```

## Compute Pool Management

### Monitor Compute Pool
```bash
# Show all compute pools
snow sql -c demo142_cursor -q "SHOW COMPUTE POOLS;"

# Describe specific pool
snow sql -c demo142_cursor -q "DESCRIBE COMPUTE POOL CATALOG_COMPUTE_POOL;"

# Check pool status
snow sql -c demo142_cursor -q "
SELECT * FROM TABLE(
  INFORMATION_SCHEMA.COMPUTE_POOL_HISTORY(
    COMPUTE_POOL_NAME => 'CATALOG_COMPUTE_POOL'
  )
)
ORDER BY START_TIME DESC
LIMIT 10;
"
```

### Compute Pool Control
```bash
# Suspend compute pool (stops all services)
snow sql -c demo142_cursor -q "ALTER COMPUTE POOL CATALOG_COMPUTE_POOL SUSPEND;"

# Resume compute pool
snow sql -c demo142_cursor -q "ALTER COMPUTE POOL CATALOG_COMPUTE_POOL RESUME;"

# Drop compute pool (must drop services first)
snow sql -c demo142_cursor -q "DROP COMPUTE POOL IF EXISTS CATALOG_COMPUTE_POOL;"
```

## Image Repository Management

### View Images
```bash
# Show image repositories
snow sql -c demo142_cursor -q "
SHOW IMAGE REPOSITORIES IN SCHEMA CATALOG_DB.IMAGE_SCHEMA;
"

# List images in repository
snow sql -c demo142_cursor -q "
SELECT * FROM TABLE(
  INFORMATION_SCHEMA.IMAGE_REPOSITORY_IMAGES(
    DATABASE_NAME => 'CATALOG_DB',
    SCHEMA_NAME => 'IMAGE_SCHEMA',
    REPOSITORY_NAME => 'IMAGE_REPO'
  )
);
"
```

### Push New Image
```bash
# Get registry URL
REGISTRY_URL=$(snow sql -q "SHOW IMAGE REPOSITORIES IN SCHEMA CATALOG_DB.IMAGE_SCHEMA;" -c demo142_cursor --format plain | grep IMAGE_REPO | awk '{print $7}')

# Build and tag
docker build --platform linux/amd64 -t data-catalog:latest .
docker tag data-catalog:latest ${REGISTRY_URL}/data-catalog:latest

# Login and push
snow spcs image-registry login -c demo142_cursor
docker push ${REGISTRY_URL}/data-catalog:latest
```

## User and Access Management

### View User Activity
```bash
# Check recent access requests
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SELECT * FROM CATALOG_DB.CATALOG_SCHEMA.ACCESS_REQUESTS
ORDER BY REQUESTED_AT DESC
LIMIT 20;
"

# Check user ratings
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SELECT 
  TABLE_FULL_NAME,
  AVG(RATING) as avg_rating,
  COUNT(*) as rating_count
FROM CATALOG_DB.CATALOG_SCHEMA.USER_RATINGS
GROUP BY TABLE_FULL_NAME
ORDER BY avg_rating DESC, rating_count DESC
LIMIT 20;
"
```

## Troubleshooting Commands

### Debug Service Issues
```bash
# Get detailed service status
snow sql -c demo142_cursor -q "
SELECT SYSTEM\$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');
"

# View recent logs with errors
snow sql -c demo142_cursor -q "
CALL SYSTEM\$GET_SERVICE_LOGS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE', '0', 'data-catalog-app', 500);
"

# Check service definition
snow sql -c demo142_cursor -q "
SELECT GET_DDL('SERVICE', 'CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');
"
```

### Check Role Permissions
```bash
# Show grants to catalog role
snow sql -c demo142_cursor -q "SHOW GRANTS TO ROLE CATALOG_ROLE;"

# Check accessible databases
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SHOW DATABASES;
"

# Test query permissions
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SELECT COUNT(*) FROM SNOWFLAKE.ACCOUNT_USAGE.TABLES WHERE TABLE_CATALOG != 'SNOWFLAKE';
"
```

### Network and Connectivity
```bash
# Test connection to Snowflake
snow sql -c demo142_cursor -q "SELECT CURRENT_TIMESTAMP(), CURRENT_USER(), CURRENT_ROLE();"

# Check warehouse status
snow sql -c demo142_cursor -q "SHOW WAREHOUSES LIKE 'COMPUTE_WH';"

# Verify image registry access
snow spcs image-registry list-images -c demo142_cursor
```

## Cost Management

### Monitor Usage
```bash
# Check service resource usage
snow sql -c demo142_cursor -q "
SELECT * FROM TABLE(
  INFORMATION_SCHEMA.SERVICE_USAGE_HISTORY(
    SERVICE_NAME => 'CATALOG_SERVICE',
    START_TIME => DATEADD('day', -7, CURRENT_TIMESTAMP())
  )
)
ORDER BY START_TIME DESC;
"

# Check compute pool costs
snow sql -c demo142_cursor -q "
SELECT 
  DATE_TRUNC('day', START_TIME) as day,
  SUM(CREDITS_USED) as total_credits
FROM TABLE(
  INFORMATION_SCHEMA.COMPUTE_POOL_HISTORY(
    COMPUTE_POOL_NAME => 'CATALOG_COMPUTE_POOL'
  )
)
WHERE START_TIME >= DATEADD('day', -30, CURRENT_TIMESTAMP())
GROUP BY day
ORDER BY day DESC;
"
```

### Optimize Costs
```bash
# Reduce compute pool size
snow sql -c demo142_cursor -q "
ALTER COMPUTE POOL CATALOG_COMPUTE_POOL SET 
  MIN_NODES = 1 
  MAX_NODES = 1;
"

# Adjust auto-suspend
snow sql -c demo142_cursor -q "
ALTER COMPUTE POOL CATALOG_COMPUTE_POOL SET AUTO_SUSPEND_SECS = 180;
"

# Suspend service when not in use
snow sql -c demo142_cursor -q "
ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE SUSPEND;
"
```

## Quick Commands Summary

| Task | Command |
|------|---------|
| Deploy to SPCS | `./deploy.sh --spcs` |
| Check status | `snow sql -c demo142_cursor -q "SELECT SYSTEM\$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');"` |
| View logs | `snow sql -c demo142_cursor -q "CALL SYSTEM\$GET_SERVICE_LOGS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE', '0');"` |
| Get endpoint | `snow sql -c demo142_cursor -q "SHOW ENDPOINTS IN SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;"` |
| Suspend service | `snow sql -c demo142_cursor -q "ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE SUSPEND;"` |
| Resume service | `snow sql -c demo142_cursor -q "ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE RESUME;"` |
| Refresh catalog | `snow sql -c demo142_cursor -q "CALL CATALOG_DB.CATALOG_SCHEMA.REFRESH_CATALOG_METADATA();"` |

## Environment Variables

Set these for local development:

```bash
export SNOWFLAKE_ROLE=CATALOG_ROLE
export SNOWFLAKE_WAREHOUSE=COMPUTE_WH
export SNOWFLAKE_DATABASE=CATALOG_DB
export SNOWFLAKE_SCHEMA=CATALOG_SCHEMA
```

---

**Connection:** demo142_cursor  
**CLI Tool:** Snowflake CLI (`snow` command)  
**Documentation:** https://docs.snowflake.com/en/developer-guide/snowflake-cli
