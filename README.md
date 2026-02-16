# Data Catalog - Snowflake SPCS

A **production-ready Data Catalog** built with React + Express.js for Snowflake's Snowpark Container Services (SPCS). Discover, explore, and collaborate on data across all your Snowflake databases.

## What This Application Provides

A **fully functional data catalog** featuring:

- 📊 **Comprehensive Metadata Discovery**: Automatic scanning of all accessible databases, schemas, and tables
- 🔍 **Powerful Search & Filtering**: Find tables by name, description, database, schema, or type
- ⭐ **User Ratings & Reviews**: 5-star rating system for data quality feedback
- 💬 **Collaborative Comments**: Discussion threads on tables for knowledge sharing
- 📝 **Wiki-Style Documentation**: User-contributed descriptions to complement system metadata
- 🔐 **Access Request Workflow**: Governed data access with justification and approval tracking
- 📈 **Rich Metadata Display**: Row counts, table sizes, column schemas, and modification dates
- 🚀 **SPCS Native**: OAuth authentication, containerized deployment, auto-scaling

## Prerequisites

Before deploying, ensure you have:

- ✅ **Snowflake account** with ACCOUNTADMIN access
- ✅ **Snowflake CLI (snow)** installed and configured
- ✅ **Docker** installed and running
- ✅ **Node.js 18+** installed

### Install and Configure Snowflake CLI

```bash
# Install Snowflake CLI
pip install snowflake-cli

# Configure connection (replace with your details)
snow connection add <connection-name> \
  --account your-account-name.region.cloud \
  --user your-username \
  --warehouse COMPUTE_WH \
  --role ACCOUNTADMIN

# Test connection
snow connection test <connection-name>
```

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url> data-catalog
cd data-catalog
npm install --legacy-peer-deps
```

### 2. Deploy to SPCS
```bash
# Deploy everything with one command (replace with your connection name)
./deploy.sh --spcs --connection <your-connection-name>
```

**Your catalog will be live** at the provided SPCS endpoint URL!

## Deployment

### Prerequisites Verification

Before deployment, verify your setup:

```bash
# Test Snowflake CLI connection
snow sql -c <connection-name> -q "SELECT CURRENT_USER(), CURRENT_ROLE();"

# Test Docker
docker --version

# Test Node.js
node --version  # Should be 18+
```

### Local Development Setup

1. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Deploy to Snowflake**:
   ```bash
   ./deploy.sh --spcs
   ```
   
   This will:
   - Create role and database
   - Setup image repository
   - Build and push Docker image
   - Deploy SPCS service
   - Display public endpoint URL

2. **Monitor deployment**:
   ```bash
   # Check service status
   snow sql -c <connection-name> -q "SELECT SYSTEM\$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');"
   ```

3. **Get service endpoint**:
   ```bash
   snow sql -c <connection-name> -q "SHOW ENDPOINTS IN SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE;"
   ```

### Post-Deployment Configuration

**Grant database access** to catalog additional databases:

```sql
USE ROLE ACCOUNTADMIN;

-- For each database you want to catalog:
GRANT USAGE ON DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT USAGE ON ALL SCHEMAS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON ALL TABLES IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
GRANT SELECT ON ALL VIEWS IN DATABASE <YOUR_DATABASE> TO ROLE CATALOG_ROLE;
```

**Refresh catalog metadata**:
```bash
curl -X POST https://<your-endpoint>/api/refresh-catalog
```

## Service Management

### Check Status
```bash
snow sql -c <connection-name> -q "SELECT SYSTEM\$GET_SERVICE_STATUS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE');"
```

### View Logs
```bash
snow sql -c <connection-name> -q "CALL SYSTEM\$GET_SERVICE_LOGS('CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE', '0', 'data-catalog-app', 100);"
```

### Suspend/Resume Service
```bash
# Suspend (save costs)
snow sql -c <connection-name> -q "ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE SUSPEND;"

# Resume
snow sql -c <connection-name> -q "ALTER SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE RESUME;"
```

### Update Service
```bash
# After code changes, redeploy
./deploy.sh --connection <connection-name>
```
