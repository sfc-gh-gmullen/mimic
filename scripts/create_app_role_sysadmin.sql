-- Simplified setup using SYSADMIN role
-- This skips CATALOG_ROLE creation and uses SYSADMIN directly

-- Create or verify warehouse exists
CREATE WAREHOUSE IF NOT EXISTS COMPUTE_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 300
  AUTO_RESUME = TRUE
  COMMENT = 'Warehouse for Data Catalog application';

-- Grant additional SPCS permissions to SYSADMIN (if not already granted)
-- Note: Some of these may require ACCOUNTADMIN to grant
-- GRANT CREATE COMPUTE POOL ON ACCOUNT TO ROLE SYSADMIN;
-- GRANT BIND SERVICE ENDPOINT ON ACCOUNT TO ROLE SYSADMIN;
-- GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE SYSADMIN;

SELECT 'Warehouse verified. Using SYSADMIN role for deployment.' as status;
SELECT 'Note: You may need ACCOUNTADMIN to grant SPCS-specific privileges' as note;
