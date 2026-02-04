-- Simplified setup using SYSADMIN role
-- No role creation - deploy everything as SYSADMIN

-- Create or verify warehouse exists
CREATE WAREHOUSE IF NOT EXISTS COMPUTE_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 300
  AUTO_RESUME = TRUE
  COMMENT = 'Warehouse for Data Catalog application';

SELECT 'Warehouse setup complete. Deploying as SYSADMIN.' as status;

