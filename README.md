# 📚 Data Catalog - Snowflake SPCS

A **production-ready Data Catalog** built with React + Express.js for Snowflake's Snowpark Container Services (SPCS). Discover, explore, and collaborate on data across all your Snowflake databases.

## 🎯 What This Application Provides

A **fully functional data catalog** featuring:

- 📊 **Comprehensive Metadata Discovery**: Automatic scanning of all accessible databases, schemas, and tables
- 🔍 **Powerful Search & Filtering**: Find tables by name, description, database, schema, or type
- ⭐ **User Ratings & Reviews**: 5-star rating system for data quality feedback
- 💬 **Collaborative Comments**: Discussion threads on tables for knowledge sharing
- 📝 **Wiki-Style Documentation**: User-contributed descriptions to complement system metadata
- 🔐 **Access Request Workflow**: Governed data access with justification and approval tracking
- 📈 **Rich Metadata Display**: Row counts, table sizes, column schemas, and modification dates
- 🚀 **SPCS Native**: OAuth authentication, containerized deployment, auto-scaling

## ✨ Data Catalog Features

### 🔍 **Discovery & Search**
- Browse all tables across databases and schemas
- Full-text search across table names and descriptions
- Filter by database, schema, and object type (tables vs views)
- See row counts, sizes, and last modified dates at a glance

### 📊 **Rich Metadata**
- **Comprehensive Table Info**: Row counts, storage size, creation/modification dates
- **Column Schema Details**: Data types, nullability, and column comments
- **System Metadata**: Original Snowflake comments and descriptions
- **Usage Stats**: View ratings, comment counts, and popularity

### 👥 **Collaborative Features**
- **5-Star Ratings**: Rate data quality and usefulness
- **Comment Threads**: Discuss tables, share insights, and ask questions
- **Wiki Descriptions**: Create and edit collaborative documentation
- **User Attribution**: See who contributed ratings, comments, and descriptions

### 🔐 **Data Governance**
- **Access Request Workflow**: Request access with justification
- **Approval Tracking**: Monitor request status (pending, approved, denied)
- **Audit Trail**: Track requesters, approvers, and decision timestamps
- **Role-Based Access**: Read-only catalog role with governed access patterns

## 🏗️ Architecture

This template follows the proven **flat project structure** pattern optimized for SPCS:

- **Single `package.json`** at root level for simplified dependency management
- **Express server** serves both API routes AND static React build files  
- **Port 3002** consistently across all environments (local, Docker, SPCS)
- **Per-request Snowflake connections** to prevent timeout issues
- **Dual authentication** (SPCS OAuth + local development credentials)
- **TypeScript throughout** for type safety and better development experience

## 📁 Project Structure

```
sales-analytics-dashboard/
├── .cursorrules              # Cursor AI configuration with SPCS best practices
├── package.json              # Dependencies and scripts
├── server.js                 # Express server with 8 API endpoints
├── tsconfig.json            # TypeScript configuration
├── Dockerfile               # Multi-stage Docker build
├── deploy.sh                # 🚀 ONE-COMMAND deployment script
├── src/                     # React application source
│   ├── App.tsx              # Main app with dashboard layout
│   ├── index.tsx            # React entry point
│   └── components/          
│       ├── Dashboard.tsx    # Main dashboard with charts & filters
│       └── ErrorBoundary.tsx # Robust error handling
├── public/                  # Static assets and manifest
├── scripts/                 # Database setup scripts
│   ├── create_app_role.sql  # Creates APP_SPCS_ROLE with permissions
│   └── setup_database.sql   # Creates sample e-commerce data
└── snowflake/               # SPCS deployment files
    ├── deploy.sql           # Service deployment with resource specs
    ├── manage_service.sql   # Service management commands
    └── setup_image_repo.sql # Image repository configuration
```

## 🗄️ Database Schema

The catalog creates a comprehensive metadata infrastructure:

### **Catalog Tables**
```sql
-- Cached metadata from INFORMATION_SCHEMA
CATALOG_METADATA (database_name, schema_name, table_name, table_type, 
                  row_count, bytes, created, last_altered, comment)

-- Column-level schema information
CATALOG_COLUMNS (full_table_name, column_name, data_type, 
                 is_nullable, comment, ordinal_position)

-- User ratings (1-5 stars)
USER_RATINGS (table_full_name, user_name, rating, created_at)

-- Discussion threads
USER_COMMENTS (comment_id, table_full_name, user_name, 
               comment_text, created_at, updated_at)

-- Wiki-style documentation
TABLE_DESCRIPTIONS (table_full_name, user_description, 
                    last_updated_by, updated_at)

-- Access request tracking
ACCESS_REQUESTS (request_id, table_full_name, requester, justification,
                 status, approver, decision_date, requested_at)
```

### **Key Features**
- **Automatic Metadata Scanning**: Stored procedure refreshes from ACCOUNT_USAGE views
- **Enriched View**: Combines metadata with ratings, descriptions, and comments
- **Comprehensive Coverage**: Scans all accessible databases (excluding SNOWFLAKE system DB)
- **Incremental Updates**: Refresh catalog without losing user-generated content

## 🚀 API Endpoints

The Express server provides comprehensive REST API endpoints:

### **📊 Metadata Discovery**
- `GET /api/health` - Service health check
- `GET /api/catalog?database=X&schema=Y&search=customer` - Browse catalog with filters
- `GET /api/catalog/:database/:schema/:table` - Detailed table metadata
- `GET /api/columns/:database/:schema/:table` - Column schema details
- `GET /api/databases` - List all accessible databases
- `GET /api/schemas?database=X` - List schemas in database
- `GET /api/search?q=query` - Full-text search across catalog

### **👥 User-Generated Content**
- `POST /api/ratings` - Submit table rating (1-5 stars)
- `GET /api/ratings/:table` - Get ratings for table
- `POST /api/comments` - Add comment to table
- `GET /api/comments/:table` - Get comments for table
- `PUT /api/description/:table` - Update wiki description
- `GET /api/description/:table` - Get wiki description

### **🔐 Access Requests**
- `POST /api/access-requests` - Submit access request
- `GET /api/access-requests` - Get user's requests
- `GET /api/access-requests/pending` - Get pending approvals (admin)
- `PUT /api/access-requests/:id/approve` - Approve request
- `PUT /api/access-requests/:id/deny` - Deny request

### **🔧 Maintenance**
- `POST /api/refresh-catalog` - Trigger metadata refresh

### **Example API Response**
```json
{
  "success": true,
  "data": [{
    "DATABASE_NAME": "PROD_DB",
    "SCHEMA_NAME": "SALES",
    "TABLE_NAME": "CUSTOMERS",
    "TABLE_TYPE": "BASE TABLE",
    "ROW_COUNT": 1500000,
    "SIZE_GB": 2.5,
    "AVG_RATING": 4.5,
    "COMMENT_COUNT": 8
  }],
  "count": 1
}
```

## 🛠️ Prerequisites & Tool Setup

Before using this template, you need to install and configure the required Snowflake tools.

### **Required Tools**

- **SnowSQL CLI** - For database operations and service management
- **Snow CLI** - For SPCS image registry operations  
- **Docker** - For building and running containers
- **Node.js 18+** - For running the React/Express application

### **1. Install SnowSQL CLI**

**macOS/Linux:**
```bash
# Download and install SnowSQL
curl -O https://sfc-repo.snowflakecomputing.com/snowsql/bootstrap/1.2/linux_x86_64/snowsql-1.2.32-linux_x86_64.bash
bash snowsql-1.2.32-linux_x86_64.bash

# Or using Homebrew on macOS
brew install --cask snowflake-snowsql
```

**Windows:**
```powershell
# Download from: https://developers.snowflake.com/snowsql/
# Run the installer and follow the setup wizard
```

### **2. Install Snow CLI**

**All Platforms:**
```bash
# Install via pip
pip install snowflake-cli-labs

# Or using pipx for isolated installation
pipx install snowflake-cli-labs

# Verify installation
snow --version
```

### **3. Configure SnowSQL Default Connection**

Create your SnowSQL configuration file with a default connection:

**Location:**
- **Linux/macOS**: `~/.snowsql/config`
- **Windows**: `%USERPROFILE%\.snowsql\config`

**Configuration Content:**
```ini
[connections]

[connections.default]
# Replace with your Snowflake account details
accountname = your-account-name.region.cloud
username = your-username
password = your-password

# Default connection settings
warehousename = COMPUTE_WH
rolename = ACCOUNTADMIN
# Connection options
login_timeout = 60
network_timeout = 300
query_timeout = 300
```

### **4. Configure Snow CLI**

Set up the Snow CLI with your Snowflake connection:

```bash
# Configure Snow CLI (creates ~/.snowflake/config.toml)
snow connection add default \
  --account your-account-name.region.cloud \
  --user your-username \
  --password your-password \
  --warehouse COMPUTE_WH \
  --role ACCOUNTADMIN
```

### **5. Verify Your Setup**

Test that everything is configured correctly:

```bash
# Test SnowSQL connection
snowsql -c default -q "SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE();"

# Test Snow CLI connection  
snow connection test default

# Verify Docker is running
docker --version
docker run hello-world

# Verify Node.js version
node --version  # Should be 18.x or higher
npm --version
```

### **6. Required Snowflake Permissions**

Your Snowflake user needs these permissions for SPCS deployment:

```sql
-- Your user should have ACCOUNTADMIN role or these specific grants:
USE ROLE ACCOUNTADMIN;

-- Database and schema creation
GRANT CREATE DATABASE ON ACCOUNT TO ROLE your-role;
GRANT CREATE SCHEMA ON DATABASE TO ROLE your-role;

-- SPCS-specific permissions
GRANT CREATE COMPUTE POOL ON ACCOUNT TO ROLE your-role;
GRANT CREATE WAREHOUSE ON ACCOUNT TO ROLE your-role;  
GRANT CREATE ROLE ON ACCOUNT TO ROLE your-role;

-- Image repository permissions
GRANT CREATE IMAGE REPOSITORY ON SCHEMA TO ROLE your-role;
```

### **Getting Your Account Information**

If you're not sure about your account details:

1. **Account Name**: Found in your Snowflake URL
   - URL: `https://abc123.us-west-2.aws.snowflakecomputing.com`
   - Account: `abc123.us-west-2.aws`

2. **Organization Name**: Run in Snowflake Web UI:
   ```sql
   SELECT CURRENT_ORGANIZATION_NAME();
   ```

3. **Region/Cloud**: Run in Snowflake Web UI:
   ```sql
   SELECT CURRENT_REGION(), CURRENT_CLOUD();
   ```

---

## 🚀 Quick Start

> **⚠️ Important**: Complete the [Prerequisites & Tool Setup](#️-prerequisites--tool-setup) section above before proceeding!

### 1. **Get the Template**

```bash
# Clone the repository
git clone <repository-url> my-sales-dashboard
cd my-sales-dashboard

# Install dependencies
npm install --legacy-peer-deps
```

### 2. **Local Development**

```bash
# Set up database and sample data (creates realistic e-commerce data)
./deploy.sh --local

# Start the development server
npm run dev
```

**Access your dashboard**: http://localhost:3002

### 3. **Deploy to SPCS**

```bash
# Deploy everything to Snowflake SPCS with one command!
./deploy.sh --spcs

# The script will:
# ✅ Create APP_SPCS_ROLE with proper permissions
# ✅ Set up SPCS_APP_DB database with sample data  
# ✅ Build and push Docker image to Snowflake
# ✅ Deploy SPCS service with proper configuration
# ✅ Show you the public endpoint URL
```

**Your dashboard will be live** at the provided SPCS endpoint!

## 🎨 Customizing for Your Use Case

### **Change the Data Model**

1. **Update Database Schema**: Modify `scripts/setup_database.sql`
   ```sql
   -- Add your own tables
   CREATE TABLE YOUR_DATA (
       id NUMBER AUTOINCREMENT,
       your_field VARCHAR(100),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
   );
   ```

2. **Update API Endpoints**: Modify queries in `server.js`
   ```javascript
   // Add your custom endpoint
   app.get('/api/your-data', async (req, res) => {
       const query = 'SELECT * FROM YOUR_DATA LIMIT 100';
       // ... connection handling code
   });
   ```

3. **Update Frontend**: Modify `src/components/Dashboard.tsx`
   ```typescript
   // Add your custom components
   const YourCustomChart = ({ data }: { data: YourDataType[] }) => {
       return <div>Your visualization here</div>;
   };
   ```

### **Rebrand the Dashboard**

1. **Update App Name**: Change in `package.json` and `deploy.sh`
2. **Customize Styling**: Modify `src/App.css` and component styles  
3. **Update Branding**: Replace logo and colors in `public/` and CSS files
4. **Change Endpoints**: Update API base URLs if needed

### **Add New Visualizations**

The template uses **Recharts** for visualization. Add new charts easily:

```typescript
import { LineChart, BarChart, PieChart } from 'recharts';

// Add to Dashboard.tsx
<LineChart width={600} height={300} data={yourData}>
  <XAxis dataKey="month" />
  <YAxis />
  <Line type="monotone" dataKey="value" stroke="#8884d8" />
</LineChart>
```

## 🔧 Configuration

### **Environment Variables**

The application automatically detects its environment:

**SPCS Container (automatic detection):**
- `SNOWFLAKE_DATABASE`: SPCS_APP_DB
- `SNOWFLAKE_SCHEMA`: APP_SCHEMA  
- `SNOWFLAKE_WAREHOUSE`: COMPUTE_WH
- `SNOWFLAKE_ROLE`: APP_SPCS_ROLE

**Local Development:**
- Reads from `~/.snowsql/config` default connection
- Environment variables override config file settings
- Falls back to mock data if Snowflake unavailable

### **Docker Configuration**

Multi-stage Dockerfile optimized for SPCS:
- **Builder stage**: Compiles React app with TypeScript
- **Production stage**: Minimal Node.js runtime with security hardening
- **Platform**: linux/amd64 for Snowflake compatibility
- **Security**: Non-root user, minimal attack surface

## 🐛 Troubleshooting

### **Local Development Issues**

**"Failed to fetch sales metrics":**
```bash
# Check if database was created
snowsql -q "SELECT COUNT(*) FROM SPCS_APP_DB.APP_SCHEMA.ORDERS;"

# Recreate sample data
./deploy.sh --local
```

**React build not loading:**
```bash
# Rebuild React app
npm run build

# Check static files are served
curl http://localhost:3002/static/js/main.*.js
```

### **SPCS Deployment Issues**

**Service shows PENDING:**
```bash
# Check service logs
snowsql -q "CALL SYSTEM\$GET_SERVICE_LOGS('SPCS_APP_DB.APP_SCHEMA.SPCS_APP_SERVICE', '0');"

# Verify compute pool
snowsql -q "SHOW COMPUTE POOLS;"
```

**API returns 500 errors:**
```bash
# Check role permissions
snowsql -q "SHOW GRANTS TO ROLE APP_SPCS_ROLE;"

# Test database access
snowsql -q "USE ROLE APP_SPCS_ROLE; SELECT COUNT(*) FROM SPCS_APP_DB.APP_SCHEMA.ORDERS;"
```

**Endpoint not accessible:**
```bash
# Get endpoint URL
snowsql -q "SHOW ENDPOINTS IN SERVICE SPCS_APP_DB.APP_SCHEMA.SPCS_APP_SERVICE;"

# Check service status
snowsql -q "SELECT SYSTEM\$GET_SERVICE_STATUS('SPCS_APP_DB.APP_SCHEMA.SPCS_APP_SERVICE');"
```

## 📊 Dashboard Preview

When running, your dashboard displays:

### **📈 Main Dashboard View**
- **Revenue Card**: $67,971.86 with 12.5% growth indicator
- **Orders Card**: 504 orders with average $134.87 value
- **Customers Card**: 220 customers with 15.2% growth
- **Monthly Trend**: Interactive line chart showing revenue over time

### **🛍️ Product Analytics**
- **Category Breakdown**: Bar chart comparing Electronics, Clothing, Home & Garden, Books, Sports
- **Top Products**: Dynamic list updating based on selected category and time period
- **Performance Metrics**: Revenue per category with trend indicators

### **🎛️ Interactive Filters**
- **Time Period**: Toggle between 7, 30, 90 days, or all time
- **Category**: Filter all visualizations by product category
- **Real-time Updates**: Charts update instantly without page reload

## 🏆 Production-Ready Features

This template includes enterprise-grade features:

- **🔐 Security**: Non-root Docker container, input validation, secure Snowflake connections
- **🚀 Performance**: Per-request connections, React optimizations, Docker multi-stage builds
- **📊 Monitoring**: Health check endpoint, comprehensive logging, error boundaries
- **🛡️ Error Handling**: Graceful degradation, user-friendly error messages, connection cleanup
- **📱 Responsive**: Mobile-first design, flexible layouts, accessible components
- **🔄 Scalability**: SPCS auto-scaling, stateless design, efficient queries

## 🎓 Learning Outcomes

By using this template, you'll learn:

1. **SPCS Best Practices**: Proper service configuration, image management, deployment patterns
2. **React + Express Integration**: API design, state management, component architecture  
3. **Snowflake Integration**: Authentication methods, connection management, query optimization
4. **Docker for SPCS**: Multi-stage builds, security hardening, platform targeting
5. **Production Deployment**: CI/CD patterns, monitoring, troubleshooting

## 📚 Next Steps

### **Extend the Dashboard**
- Add real-time notifications with WebSockets
- Implement user authentication and role-based access
- Add data export functionality (CSV, PDF reports)
- Create admin panel for data management

### **Advanced Features**  
- Integrate machine learning predictions
- Add caching layer (Redis/Snowflake caching)
- Implement audit logging
- Add automated testing (Jest, Cypress)

### **Scale for Production**
- Set up monitoring and alerting
- Implement proper CI/CD pipeline
- Add load balancing for high availability
- Configure backup and disaster recovery

## 📄 License

MIT License - Use this template freely for your commercial and personal SPCS applications.

---

**🚀 Ready to build your own analytics dashboard?** This template gives you everything you need to go from zero to production in minutes, not days!