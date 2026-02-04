-- Setup image repository for SPCS deployment
-- This script creates the necessary database, schema, and image repository
-- Deploys using SYSADMIN role

-- Create image schema for storing container images
CREATE SCHEMA IF NOT EXISTS CATALOG_DB.IMAGE_SCHEMA
COMMENT = 'Schema for storing SPCS container images';

-- Create image repository
CREATE IMAGE REPOSITORY IF NOT EXISTS CATALOG_DB.IMAGE_SCHEMA.IMAGE_REPO
COMMENT = 'Repository for data catalog container images';

-- Show the repository URL
SHOW IMAGE REPOSITORIES IN SCHEMA CATALOG_DB.IMAGE_SCHEMA;

SELECT 'Image repository setup complete' as status;

