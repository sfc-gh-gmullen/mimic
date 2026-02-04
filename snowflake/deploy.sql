-- Data Catalog SPCS deployment script
-- This script creates the compute pool and service
-- Deploys using SYSADMIN role

-- Create compute pool if it doesn't exist
CREATE COMPUTE POOL IF NOT EXISTS CATALOG_COMPUTE_POOL
  MIN_NODES = 1
  MAX_NODES = 2
  INSTANCE_FAMILY = CPU_X64_XS
  AUTO_RESUME = TRUE
  AUTO_SUSPEND_SECS = 300
  COMMENT = 'Compute pool for Data Catalog SPCS application';

-- Note: Compute pool will be created and may take time to become active
-- Check compute pool status with: DESCRIBE COMPUTE POOL CATALOG_COMPUTE_POOL;

-- Create the service with explicit account
DROP SERVICE IF EXISTS CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;

CREATE SERVICE IF NOT EXISTS CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE
  IN COMPUTE POOL CATALOG_COMPUTE_POOL
  FROM SPECIFICATION $$
    spec:
      containers:
      - name: "data-catalog-app"
        image: "/CATALOG_DB/IMAGE_SCHEMA/IMAGE_REPO/data-catalog:latest"
        env:
          PORT: "3002"
          SNOWFLAKE_WAREHOUSE: "COMPUTE_WH"
          SNOWFLAKE_ROLE: "SYSADMIN"
          SNOWFLAKE_DATABASE: "CATALOG_DB"
          SNOWFLAKE_SCHEMA: "CATALOG_SCHEMA"
        resources:
          limits:
            memory: "6Gi"
            cpu: "1"
          requests:
            memory: "0.5Gi"
            cpu: "0.5"
      endpoints:
      - name: "catalog-endpoint"
        port: 3002
        public: true
  $$
  COMMENT = 'Data Catalog SPCS Service';

-- Check service status
SELECT SYSTEM$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE') as service_status;

-- Show service details
SHOW SERVICES;
DESCRIBE SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;

-- Get service endpoints (run after service is ready)
SHOW ENDPOINTS IN SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;

