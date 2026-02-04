# Data Catalog - Deployment Guide

This guide walks you through testing and deploying the Data Catalog application to Snowflake SPCS.

## Prerequisites

- ✅ Snowflake account with ACCOUNTADMIN access
- ✅ **Snowflake CLI (snow)** installed and configured with `demo142_cursor` connection
- ✅ Docker Desktop installed and running
- ✅ Node.js 18+ installed

**Note:** This deployment uses Snowflake CLI (`snow` command) exclusively, as specified in the user requirements.

## Architecture Overview

The Data Catalog is a React + Express.js application that:
- 📊 **Scans all accessible databases** in your Snowflake account for metadata
- 🔍 **Provides search and filtering** across tables and views
- ⭐ **Enables user ratings and comments** for collaborative data discovery
- 📝 **Wiki-style descriptions** for documenting tables
- 🔐 **Access request workflow** for data governance

## Step 1: Local Development Setup

### 1.1 Install Dependencies

```bash
cd /Users/gmullen/github/mimic
npm install --legacy-peer-deps
```

### 1.2 Setup Database and Role

```bash
./deploy.sh --local
```

This script will:
- Create `CATALOG_ROLE` with read access to metadata
- Create `CATALOG_DB.CATALOG_SCHEMA` database
- Create all catalog tables (metadata, ratings, comments, etc.)
- Run initial metadata scan across all databases
- Generate `.env.local` configuration file

**Expected Output:**
```
✅ Role and warehouse created
✅ Database and schema created
✅ Catalog tables created
✅ Metadata scan completed
```

### 1.3 Verify Database Setup

```bash
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SELECT COUNT(*) as total_tables FROM CATALOG_DB.CATALOG_SCHEMA.CATALOG_METADATA;
SELECT COUNT(DISTINCT DATABASE_NAME) as databases_scanned FROM CATALOG_DB.CATALOG_SCHEMA.CATALOG_METADATA;
"
```

You should see tables from all accessible databases.

### 1.4 Build and Start Local Server

```bash
# Build React application
npm run build

# Set environment variables and start server
export SNOWFLAKE_ROLE=CATALOG_ROLE
export SNOWFLAKE_WAREHOUSE=COMPUTE_WH
export SNOWFLAKE_DATABASE=CATALOG_DB
export SNOWFLAKE_SCHEMA=CATALOG_SCHEMA
npm run dev
```

### 1.5 Test Locally

Open your browser to `http://localhost:3002`

**Verify the following:**
- ✅ Catalog loads and displays tables from multiple databases
- ✅ Search functionality works
- ✅ Database/Schema filters work
- ✅ Click on a table to view details
- ✅ Schema tab shows columns
- ✅ Can submit ratings (1-5 stars)
- ✅ Can add comments
- ✅ Can edit wiki description
- ✅ Can request access

**Test API Endpoints:**
```bash
# Health check
curl http://localhost:3002/api/health

# Get catalog
curl http://localhost:3002/api/catalog?limit=10

# Get databases
curl http://localhost:3002/api/databases

# Search
curl "http://localhost:3002/api/search?q=customer"
```

## Step 2: Docker Testing

### 2.1 Build Docker Image

```bash
docker build --platform linux/amd64 -t data-catalog:latest .
```

**Expected:** Build completes successfully with multi-stage build.

### 2.2 Run Docker Container Locally

```bash
docker run -p 3002:3002 data-catalog:latest
```

### 2.3 Verify Container

```bash
# Health check
curl http://localhost:3002/api/health

# Should return: {"status":"OK","environment":"Local Development",...}
```

**Note:** The container will use OAuth in SPCS but read from `~/.snowsql/config` locally.

## Step 3: SPCS Deployment

### 3.1 Verify Prerequisites

```bash
# Test Snowflake CLI connection
snow sql -c demo142_cursor -q "SELECT CURRENT_USER(), CURRENT_ROLE();"

# Test connection
snow connection test demo142_cursor

# Verify Docker
docker --version
```

### 3.2 Deploy to SPCS

```bash
./deploy.sh --spcs
```

This will:
1. ✅ Create role and database (if not exists)
2. ✅ Setup image repository
3. ✅ Build React application
4. ✅ Build Docker image (linux/amd64)
5. ✅ Tag and push to Snowflake registry
6. ✅ Create compute pool
7. ✅ Deploy SPCS service
8. ✅ Wait for service to be READY
9. ✅ Display public endpoint URL

**Expected Duration:** 5-10 minutes

### 3.3 Monitor Deployment

```bash
# Check service status
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SELECT SYSTEM\$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');
"

# Check logs
snow sql -c demo142_cursor -q "
CALL SYSTEM\$GET_SERVICE_LOGS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE', '0');
"
```

### 3.4 Get Service Endpoint

```bash
snow sql -c demo142_cursor -q "
USE ROLE CATALOG_ROLE;
SHOW ENDPOINTS IN SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;
"
```

Copy the HTTPS endpoint URL from the output.

### 3.5 Test SPCS Deployment

Open the endpoint URL in your browser. You should see the Data Catalog interface.

**Verify:**
- ✅ Catalog loads with all database metadata
- ✅ All features work (search, filters, ratings, comments)
- ✅ Can request access to tables
- ✅ Health check shows "SPCS Container" environment

## Step 4: Post-Deployment Configuration

### 4.1 Grant Database Access (Important!)

The catalog role needs SELECT access to view metadata. Grant access to databases you want to catalog:

```sql
USE ROLE ACCOUNTADMIN;

-- For each database you want to catalog:
GRANT USAGE ON DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT USAGE ON ALL SCHEMAS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON ALL TABLES IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON ALL VIEWS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;

-- For future tables/views:
GRANT SELECT ON FUTURE TABLES IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON FUTURE VIEWS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
```

### 4.2 Refresh Catalog Metadata

After granting access, refresh the catalog:

```bash
curl -X POST https://<your-endpoint>/api/refresh-catalog
```

Or via Snowflake:
```sql
USE ROLE CATALOG_ROLE;
CALL CATALOG_DB.CATALOG_SCHEMA.REFRESH_CATALOG_METADATA();
```

### 4.3 Schedule Automatic Refresh (Optional)

Create a task to refresh metadata periodically:

```sql
USE ROLE CATALOG_ROLE;
USE DATABASE CATALOG_DB;
USE SCHEMA CATALOG_SCHEMA;

CREATE TASK IF NOT EXISTS REFRESH_CATALOG_TASK
  WAREHOUSE = COMPUTE_WH
  SCHEDULE = 'USING CRON 0 */6 * * * America/Los_Angeles'  -- Every 6 hours
AS
  CALL REFRESH_CATALOG_METADATA();

-- Start the task
ALTER TASK REFRESH_CATALOG_TASK RESUME;

-- Verify task
SHOW TASKS;
```

## Troubleshooting

### Issue: No tables showing in catalog

**Solution:**
1. Check if metadata scan ran successfully:
   ```sql
   SELECT COUNT(*) FROM CATALOG_DB.CATALOG_SCHEMA.CATALOG_METADATA;
   ```
2. If count is 0, check role permissions:
   ```sql
   SHOW GRANTS TO ROLE CATALOG_ROLE;
   ```
3. Grant access to databases (see Step 4.1)
4. Run refresh manually

### Issue: Service status shows PENDING

**Solution:**
1. Check compute pool status:
   ```sql
   SHOW COMPUTE POOLS;
   DESCRIBE COMPUTE POOL CATALOG_COMPUTE_POOL;
   ```
2. Wait 2-3 minutes for pool to become active
3. Check service logs for errors

### Issue: API returns 500 errors in SPCS

**Solution:**
1. Check service logs:
   ```sql
   CALL SYSTEM$GET_SERVICE_LOGS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE', '0', 'data-catalog-app', 100);
   ```
2. Verify role has access to CATALOG_DB:
   ```sql
   USE ROLE CATALOG_ROLE;
   USE DATABASE CATALOG_DB;
   SELECT CURRENT_ROLE(), CURRENT_DATABASE();
   ```
3. Check OAuth token is being read correctly (should see in logs)

### Issue: "Failed to connect to Snowflake" locally

**Solution:**
1. Verify snow connection exists: `snow connection list`
2. Test connection: `snow sql -c demo142_cursor -q "SELECT 1;"`
3. Ensure environment variables are set (see Step 1.4)
4. Check Snowflake CLI config: `cat ~/.snowflake/config.toml`

### Issue: React build fails

**Solution:**
1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install --legacy-peer-deps
   ```
2. Check Node.js version: `node --version` (should be 18+)
3. Check for TypeScript errors: `npm run build`

## Service Management

### Check Service Status
```bash
snow sql -c demo142_cursor -q "SELECT SYSTEM\$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');"
```

### View Service Logs
```bash
snow sql -c demo142_cursor -q "CALL SYSTEM\$GET_SERVICE_LOGS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE', '0', 'data-catalog-app', 100);"
```

### Suspend Service (to save costs)
```bash
snow sql -c demo142_cursor -q "ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE SUSPEND;"
```

### Resume Service
```bash
snow sql -c demo142_cursor -q "ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE RESUME;"
```

### Update Service (after code changes)
```bash
# Rebuild and redeploy
./deploy.sh --spcs
```

## Features to Test

### ✅ Catalog Browsing
- [ ] Tables load from all databases
- [ ] Search finds tables by name
- [ ] Database filter works
- [ ] Schema filter works
- [ ] Table type filter (Tables vs Views) works
- [ ] Click table card shows detail view

### ✅ Table Details
- [ ] Metadata tab shows row count, size, dates
- [ ] Schema tab lists all columns with types
- [ ] System comment displays if present
- [ ] Back button returns to catalog

### ✅ User Content
- [ ] Can rate table (1-5 stars)
- [ ] Average rating displays correctly
- [ ] Can add comment
- [ ] Comments display with timestamp and user
- [ ] Can edit wiki description
- [ ] Description saves successfully

### ✅ Access Requests
- [ ] Request access button works
- [ ] Modal shows correct table name
- [ ] Can enter justification
- [ ] Request submits successfully
- [ ] Success message displays

### ✅ Admin Features (if applicable)
- [ ] View pending requests at /api/access-requests/pending
- [ ] Can approve/deny requests
- [ ] Decision records approver and timestamp

## Success Criteria

✅ **Deployment successful if:**
- Service reaches READY state within 5 minutes
- Public endpoint is accessible via HTTPS
- Catalog displays tables from multiple databases
- All CRUD operations work (ratings, comments, descriptions, requests)
- No errors in service logs
- Health check returns OK

## Next Steps

Once deployed successfully:

1. **Share with team:** Distribute the endpoint URL
2. **Set up governance:** Identify data stewards for access approvals
3. **Document tables:** Encourage team to add descriptions and ratings
4. **Monitor usage:** Check service logs and query patterns
5. **Extend features:** Add Cortex Search for semantic search (future enhancement)

## Support

If you encounter issues not covered in troubleshooting:
1. Check service logs for detailed error messages
2. Verify all SQL scripts ran successfully
3. Ensure role has appropriate grants
4. Check network connectivity to Snowflake

---

**Deployment Date:** {date}  
**Version:** 1.0.0  
**Connection:** demo142_cursor
