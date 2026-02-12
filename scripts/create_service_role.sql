-- ============================================================================
-- CATALOG SERVICE ROLE SETUP
-- ============================================================================
-- This script must be run as ACCOUNTADMIN (one-time setup)
-- It creates the service role with necessary privileges to manage the catalog
-- ============================================================================

USE ROLE ACCOUNTADMIN;

-- Create the dedicated service role
CREATE ROLE IF NOT EXISTS CATALOG_SERVICE_ROLE
  COMMENT = 'Service role for Data Catalog SPCS application - owns all catalog objects';

-- Grant the service role to SYSADMIN for management purposes
GRANT ROLE CATALOG_SERVICE_ROLE TO ROLE SYSADMIN;

-- ============================================================================
-- ACCOUNT-LEVEL PRIVILEGES (WITH GRANT OPTION)
-- These allow the service role to delegate access to other roles
-- ============================================================================

-- Allow binding service endpoints (required for SPCS public endpoints)
GRANT BIND SERVICE ENDPOINT ON ACCOUNT TO ROLE CATALOG_SERVICE_ROLE WITH GRANT OPTION;

-- Allow creating databases (for initial setup)
GRANT CREATE DATABASE ON ACCOUNT TO ROLE CATALOG_SERVICE_ROLE;

-- Allow creating compute pools
GRANT CREATE COMPUTE POOL ON ACCOUNT TO ROLE CATALOG_SERVICE_ROLE;

-- ============================================================================
-- WAREHOUSE ACCESS
-- ============================================================================

-- Create warehouse if it doesn't exist
CREATE WAREHOUSE IF NOT EXISTS COMPUTE_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 300
  AUTO_RESUME = TRUE
  COMMENT = 'Warehouse for Data Catalog application';

-- Grant warehouse usage with ability to re-grant
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE CATALOG_SERVICE_ROLE WITH GRANT OPTION;
GRANT OPERATE ON WAREHOUSE COMPUTE_WH TO ROLE CATALOG_SERVICE_ROLE;

-- ============================================================================
-- IMAGE REPOSITORY ACCESS
-- Service role needs to push/pull container images
-- ============================================================================

-- These will be granted after database is created (in setup_database.sql)
-- GRANT READ, WRITE ON IMAGE REPOSITORY CATALOG_DB.IMAGE_SCHEMA.IMAGE_REPO TO ROLE CATALOG_SERVICE_ROLE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'CATALOG_SERVICE_ROLE created successfully' as status;
SHOW GRANTS TO ROLE CATALOG_SERVICE_ROLE;

-- ============================================================================
-- NOTES FOR ADMINISTRATORS
-- ============================================================================
-- After running this script:
-- 1. Run setup_database.sql as CATALOG_SERVICE_ROLE to create the database
-- 2. Run deploy.sh to build and deploy the application
-- 3. The service will be able to grant access to other roles automatically
--
-- To grant a user access to use this role:
--   GRANT ROLE CATALOG_SERVICE_ROLE TO USER <username>;
-- ============================================================================
