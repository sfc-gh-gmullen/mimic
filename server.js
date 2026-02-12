const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const snowflake = require('snowflake-sdk');

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || 'localhost';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Get the service OAuth token from SPCS
function getServiceToken() {
  return fs.readFileSync('/snowflake/session/token', 'ascii');
}

// Connect to Snowflake using SPCS OAuth authentication
// With caller's rights: pass req to execute SQL as the calling user
async function connectToSnowflake(req = null) {
  const serviceToken = getServiceToken();
  const ingressUserToken = req?.headers?.['sf-context-current-user-token'];
  
  // Caller's rights: combine service token + user token
  // This allows queries to run with the caller's permissions
  const token = ingressUserToken 
    ? `${serviceToken}.${ingressUserToken}` 
    : serviceToken;
  
  if (ingressUserToken) {
    console.log('🔐 Using caller\'s rights for user:', req?.headers?.['sf-context-current-user']);
  }
  
  const connectionOptions = {
    account: process.env.SNOWFLAKE_ACCOUNT,
    host: process.env.SNOWFLAKE_HOST,
    token: token,
    authenticator: 'OAUTH',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
    clientSessionKeepAlive: true,
  };

  const connection = snowflake.createConnection(connectionOptions);
  
  await new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err) {
        console.error('❌ Failed to connect to Snowflake:', err.message);
        reject(err);
      } else {
        resolve(conn);
      }
    });
  });
  
  return connection;
}

// Execute query with proper error handling
async function executeQuery(connection, query) {
    return new Promise((resolve, reject) => {
        connection.execute({
            sqlText: query,
            complete: (err, stmt, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        });
    });
}

// Essential API endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        environment: 'SPCS Container',
        port: PORT,
        host: HOST,
        timestamp: new Date().toISOString()
    });
});

// Helper function to sanitize user input (basic SQL injection prevention)
function sanitizeInput(input) {
    if (!input) return '';
    return input.replace(/'/g, "''").substring(0, 1000); // Basic sanitization and length limit
}

// Helper function to check if current role has a permission
async function checkPermission(connection, permissionType, req) {
    const spcsRole = req?.headers?.['sf-context-current-role'] || 'PUBLIC';
    
    const query = `
        SELECT COUNT(*) as HAS_PERMISSION
        FROM CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS
        WHERE SNOWFLAKE_ROLE = '${sanitizeInput(spcsRole)}'
        AND PERMISSION_TYPE = '${sanitizeInput(permissionType)}'
    `;
    
    const rows = await executeQuery(connection, query);
    return rows[0]?.HAS_PERMISSION > 0;
}

// ============================================================================
// USER INFO
// ============================================================================

app.get('/api/current-user', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = 'SELECT CURRENT_USER() as USERNAME';
        const rows = await executeQuery(connection, query);
        
        res.json({ 
            success: true,
            username: rows[0]?.USERNAME || 'UNKNOWN_USER'
        });
        
    } catch (error) {
        console.error('❌ Get current user error:', error);
        res.json({ 
            success: false,
            username: 'UNKNOWN_USER'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get current user and role context from SPCS headers
app.get('/api/current-user-context', async (req, res) => {
    const spcsUser = req.headers['sf-context-current-user'];
    const spcsRole = req.headers['sf-context-current-account-role'] || req.headers['sf-context-current-role'];
    
    res.json({ 
        success: true,
        username: spcsUser || 'UNKNOWN_USER',
        role: spcsRole || 'PUBLIC'
    });
});

// Get available Snowflake roles for dropdown
app.get('/api/snowflake-roles', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const rows = await executeQuery(connection, 'SHOW ROLES');
        const roles = rows.map(r => ({
            name: r.name,
            owner: r.owner,
            assignedToUsers: r.assigned_to_users
        }));
        
        res.json({ 
            success: true,
            data: roles
        });
        
    } catch (error) {
        console.error('❌ Get Snowflake roles error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch Snowflake roles'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get roles that the current user can assume
app.get('/api/my-roles', async (req, res) => {
    const spcsUser = req.headers['sf-context-current-user'];
    const spcsRole = req.headers['sf-context-current-role'] || req.headers['sf-context-current-account-role'];
    
    if (!spcsUser) {
        return res.status(401).json({ 
            success: false, 
            error: 'User not authenticated' 
        });
    }
    
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const username = spcsUser;
        const currentRole = spcsRole || 'PUBLIC';
        
        // Get roles granted to the user
        let roles = [];
        try {
            const rows = await executeQuery(connection, `SHOW GRANTS TO USER "${username}"`);
            roles = rows
                .filter(r => r.privilege === 'USAGE' && r.granted_on === 'ROLE')
                .map(r => r.name);
        } catch (e) {
            console.log('Could not fetch user roles:', e.message);
            if (currentRole) roles = [currentRole];
        }
        
        // Ensure current role is in the list
        if (currentRole && !roles.includes(currentRole)) {
            roles.push(currentRole);
        }
        
        // Get user's default role from SHOW USERS
        let defaultRole = currentRole;
        try {
            const userRows = await executeQuery(connection, `SHOW USERS LIKE '${username}'`);
            if (userRows && userRows.length > 0) {
                defaultRole = userRows[0].default_role || currentRole;
            }
        } catch (e) {
            console.log('Could not fetch default role, using current role');
        }
        
        // Ensure default role is in the list
        if (defaultRole && !roles.includes(defaultRole)) {
            roles.push(defaultRole);
        }
        
        console.log(`User ${username}: roles=${roles.join(',')}, current=${currentRole}, default=${defaultRole}`);
        
        res.json({ 
            success: true,
            roles: roles.sort(),
            currentRole: currentRole,
            defaultRole: defaultRole
        });
        
    } catch (error) {
        console.error('❌ Get my roles error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch user roles'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Change the current session role
// Note: In SPCS, the actual session role is fixed. This endpoint validates 
// the role is available and returns success so the UI can track the selection.
app.post('/api/change-role', async (req, res) => {
    const { role } = req.body;
    
    if (!role) {
        return res.status(400).json({ success: false, error: 'Role is required' });
    }
    
    const spcsUser = req.headers['sf-context-current-user'];
    
    if (!spcsUser) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Verify the user can use this role
        let canUseRole = false;
        try {
            const rows = await executeQuery(connection, `SHOW GRANTS TO USER "${spcsUser}"`);
            const userRoles = rows
                .filter(r => r.privilege === 'USAGE' && r.granted_on === 'ROLE')
                .map(r => r.name);
            canUseRole = userRoles.includes(role);
        } catch (e) {
            console.log('Could not verify role access:', e.message);
        }
        
        if (!canUseRole) {
            return res.status(403).json({ 
                success: false, 
                error: `User ${spcsUser} cannot use role ${role}` 
            });
        }
        
        console.log(`Role change: User ${spcsUser} selected role ${role}`);
        
        res.json({ 
            success: true,
            role: role
        });
        
    } catch (error) {
        console.error('❌ Change role error:', error);
        res.status(500).json({ 
            success: false,
            error: `Failed to change role: ${error.message}`
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// ROLE PERMISSIONS ENDPOINTS
// ============================================================================

// Get all role permissions
app.get('/api/role-permissions', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT PERMISSION_ID, SNOWFLAKE_ROLE, PERMISSION_TYPE, GRANTED_BY, GRANTED_AT
            FROM CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS
            ORDER BY PERMISSION_TYPE, SNOWFLAKE_ROLE
        `;
        const rows = await executeQuery(connection, query);
        
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Get role permissions error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch role permissions'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get role permissions by permission type
app.get('/api/role-permissions/:permissionType', async (req, res) => {
    let connection;
    const { permissionType } = req.params;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT PERMISSION_ID, SNOWFLAKE_ROLE, PERMISSION_TYPE, GRANTED_BY, GRANTED_AT
            FROM CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS
            WHERE PERMISSION_TYPE = '${sanitizeInput(permissionType)}'
            ORDER BY SNOWFLAKE_ROLE
        `;
        const rows = await executeQuery(connection, query);
        
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Get role permissions by type error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch role permissions'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Add a role permission
app.post('/api/role-permissions', async (req, res) => {
    let connection;
    const { snowflakeRole, permissionType } = req.body;
    
    if (!snowflakeRole || !permissionType) {
        return res.status(400).json({
            success: false,
            error: 'snowflakeRole and permissionType are required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            INSERT INTO CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS 
            (SNOWFLAKE_ROLE, PERMISSION_TYPE, GRANTED_BY)
            SELECT '${sanitizeInput(snowflakeRole)}', '${sanitizeInput(permissionType)}', CURRENT_USER()
            WHERE NOT EXISTS (
                SELECT 1 FROM CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS 
                WHERE SNOWFLAKE_ROLE = '${sanitizeInput(snowflakeRole)}' 
                AND PERMISSION_TYPE = '${sanitizeInput(permissionType)}'
            )
        `;
        await executeQuery(connection, query);
        
        res.json({ 
            success: true,
            message: `Permission ${permissionType} granted to role ${snowflakeRole}`
        });
        
    } catch (error) {
        console.error('❌ Add role permission error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add role permission'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Remove a role permission
app.delete('/api/role-permissions/:snowflakeRole/:permissionType', async (req, res) => {
    let connection;
    const { snowflakeRole, permissionType } = req.params;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            DELETE FROM CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS 
            WHERE SNOWFLAKE_ROLE = '${sanitizeInput(snowflakeRole)}' 
            AND PERMISSION_TYPE = '${sanitizeInput(permissionType)}'
        `;
        await executeQuery(connection, query);
        
        res.json({ 
            success: true,
            message: `Permission ${permissionType} removed from role ${snowflakeRole}`
        });
        
    } catch (error) {
        console.error('❌ Remove role permission error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to remove role permission'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Grant Snowflake-level service access to a role
// This grants the actual Snowflake privileges needed to access the SPCS app
app.post('/api/grant-service-access', async (req, res) => {
    let connection;
    const { snowflakeRole } = req.body;
    
    if (!snowflakeRole) {
        return res.status(400).json({
            success: false,
            error: 'snowflakeRole is required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        // Check if caller has MANAGE_ROLES permission
        const spcsRole = req.headers['sf-context-current-role'];
        const hasPermission = await checkPermission(connection, 'MANAGE_ROLES', req);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Your role does not have permission to manage role access'
            });
        }
        
        const roleName = sanitizeInput(snowflakeRole);
        const grants = [];
        const errors = [];
        
        // Grant USAGE ON SERVICE (service role owns it, so this should work)
        try {
            await executeQuery(connection, `GRANT USAGE ON SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE TO ROLE ${roleName}`);
            grants.push('USAGE ON SERVICE');
        } catch (e) {
            errors.push(`USAGE ON SERVICE: ${e.message}`);
        }
        
        // Grant BIND SERVICE ENDPOINT (service role has GRANT OPTION)
        try {
            await executeQuery(connection, `GRANT BIND SERVICE ENDPOINT ON ACCOUNT TO ROLE ${roleName}`);
            grants.push('BIND SERVICE ENDPOINT');
        } catch (e) {
            errors.push(`BIND SERVICE ENDPOINT: ${e.message}`);
        }
        
        // Grant USAGE ON COMPUTE POOL
        try {
            await executeQuery(connection, `GRANT USAGE ON COMPUTE POOL CATALOG_COMPUTE_POOL TO ROLE ${roleName}`);
            grants.push('USAGE ON COMPUTE POOL');
        } catch (e) {
            errors.push(`USAGE ON COMPUTE POOL: ${e.message}`);
        }
        
        // Grant USAGE ON DATABASE
        try {
            await executeQuery(connection, `GRANT USAGE ON DATABASE CATALOG_DB TO ROLE ${roleName}`);
            grants.push('USAGE ON DATABASE');
        } catch (e) {
            errors.push(`USAGE ON DATABASE: ${e.message}`);
        }
        
        // Grant USAGE ON SCHEMA
        try {
            await executeQuery(connection, `GRANT USAGE ON SCHEMA CATALOG_DB.CATALOG_SCHEMA TO ROLE ${roleName}`);
            grants.push('USAGE ON SCHEMA');
        } catch (e) {
            errors.push(`USAGE ON SCHEMA: ${e.message}`);
        }
        
        // Grant table access
        try {
            await executeQuery(connection, `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA CATALOG_DB.CATALOG_SCHEMA TO ROLE ${roleName}`);
            grants.push('TABLE ACCESS');
        } catch (e) {
            errors.push(`TABLE ACCESS: ${e.message}`);
        }
        
        // Grant USAGE ON WAREHOUSE
        try {
            await executeQuery(connection, `GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE ${roleName}`);
            grants.push('USAGE ON WAREHOUSE');
        } catch (e) {
            errors.push(`USAGE ON WAREHOUSE: ${e.message}`);
        }
        
        if (grants.length > 0 && errors.length === 0) {
            res.json({ 
                success: true,
                message: `Service access granted to role ${roleName}`,
                grants: grants
            });
        } else if (grants.length > 0) {
            res.json({ 
                success: true,
                message: `Partial service access granted to role ${roleName}`,
                grants: grants,
                warnings: errors
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: 'Failed to grant any privileges',
                details: errors
            });
        }
        
    } catch (error) {
        console.error('❌ Grant service access error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to grant service access: ' + error.message
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Revoke Snowflake-level service access from a role
app.post('/api/revoke-service-access', async (req, res) => {
    let connection;
    const { snowflakeRole } = req.body;
    
    if (!snowflakeRole) {
        return res.status(400).json({
            success: false,
            error: 'snowflakeRole is required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        // Check if caller has MANAGE_ROLES permission
        const hasPermission = await checkPermission(connection, 'MANAGE_ROLES', req);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Your role does not have permission to manage role access'
            });
        }
        
        const roleName = sanitizeInput(snowflakeRole);
        const revokes = [];
        const errors = [];
        
        // Revoke in reverse order of grants
        try {
            await executeQuery(connection, `REVOKE USAGE ON WAREHOUSE COMPUTE_WH FROM ROLE ${roleName}`);
            revokes.push('USAGE ON WAREHOUSE');
        } catch (e) {
            errors.push(`USAGE ON WAREHOUSE: ${e.message}`);
        }
        
        try {
            await executeQuery(connection, `REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA CATALOG_DB.CATALOG_SCHEMA FROM ROLE ${roleName}`);
            revokes.push('TABLE ACCESS');
        } catch (e) {
            errors.push(`TABLE ACCESS: ${e.message}`);
        }
        
        try {
            await executeQuery(connection, `REVOKE USAGE ON SCHEMA CATALOG_DB.CATALOG_SCHEMA FROM ROLE ${roleName}`);
            revokes.push('USAGE ON SCHEMA');
        } catch (e) {
            errors.push(`USAGE ON SCHEMA: ${e.message}`);
        }
        
        try {
            await executeQuery(connection, `REVOKE USAGE ON DATABASE CATALOG_DB FROM ROLE ${roleName}`);
            revokes.push('USAGE ON DATABASE');
        } catch (e) {
            errors.push(`USAGE ON DATABASE: ${e.message}`);
        }
        
        try {
            await executeQuery(connection, `REVOKE USAGE ON COMPUTE POOL CATALOG_COMPUTE_POOL FROM ROLE ${roleName}`);
            revokes.push('USAGE ON COMPUTE POOL');
        } catch (e) {
            errors.push(`USAGE ON COMPUTE POOL: ${e.message}`);
        }
        
        try {
            await executeQuery(connection, `REVOKE BIND SERVICE ENDPOINT ON ACCOUNT FROM ROLE ${roleName}`);
            revokes.push('BIND SERVICE ENDPOINT');
        } catch (e) {
            errors.push(`BIND SERVICE ENDPOINT: ${e.message}`);
        }
        
        try {
            await executeQuery(connection, `REVOKE USAGE ON SERVICE CATALOG_DB.CATALOG_SCHEMA.CATALOG_SERVICE FROM ROLE ${roleName}`);
            revokes.push('USAGE ON SERVICE');
        } catch (e) {
            errors.push(`USAGE ON SERVICE: ${e.message}`);
        }
        
        res.json({ 
            success: true,
            message: `Service access revoked from role ${roleName}`,
            revokes: revokes,
            warnings: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('❌ Revoke service access error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to revoke service access: ' + error.message
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get current user's permissions based on their SPCS role header
app.get('/api/my-permissions', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const spcsRole = req.headers['sf-context-current-role'] || 'PUBLIC';
        
        const query = `
            SELECT rp.PERMISSION_TYPE
            FROM CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS rp
            WHERE rp.SNOWFLAKE_ROLE = '${sanitizeInput(spcsRole)}'
        `;
        
        const rows = await executeQuery(connection, query);
        const permissions = rows.map(r => r.PERMISSION_TYPE);
        
        res.json({ 
            success: true,
            permissions: permissions,
            hasAppAccess: permissions.includes('APP_ACCESS'),
            canCreateRequests: permissions.includes('CREATE_REQUESTS'),
            canApproveGlossary: permissions.includes('APPROVE_GLOSSARY'),
            canApproveDataAccess: permissions.includes('APPROVE_DATA_ACCESS'),
            canManageRoles: permissions.includes('MANAGE_ROLES')
        });
        
    } catch (error) {
        console.error('❌ Get my permissions error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch permissions'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Check if current role has a specific permission
app.get('/api/check-permission/:permissionType', async (req, res) => {
    let connection;
    const { permissionType } = req.params;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT COUNT(*) as HAS_PERMISSION
            FROM CATALOG_DB.CATALOG_SCHEMA.ROLE_PERMISSIONS
            WHERE SNOWFLAKE_ROLE = CURRENT_ROLE()
            AND PERMISSION_TYPE = '${sanitizeInput(permissionType)}'
        `;
        const rows = await executeQuery(connection, query);
        
        res.json({ 
            success: true,
            hasPermission: rows[0]?.HAS_PERMISSION > 0
        });
        
    } catch (error) {
        console.error('❌ Check permission error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to check permission'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// CATALOG METADATA ENDPOINTS
// ============================================================================

// Get all tables in catalog with filtering and pagination
app.get('/api/catalog', async (req, res) => {
    const { database, schema, type, search, tags, limit = 500, offset = 0 } = req.query;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        let query = 'SELECT DISTINCT e.* FROM ENRICHED_CATALOG e';
        
        // Join with ACCOUNT_USAGE tags if tag filter is applied
        if (tags) {
            query += ` INNER JOIN SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES t 
                       ON e.DATABASE_NAME = t.OBJECT_DATABASE 
                       AND e.SCHEMA_NAME = t.OBJECT_SCHEMA 
                       AND e.TABLE_NAME = t.OBJECT_NAME`;
        }
        
        query += ' WHERE 1=1';
        
        if (database) query += ` AND e.DATABASE_NAME = '${sanitizeInput(database)}'`;
        if (schema) query += ` AND e.SCHEMA_NAME = '${sanitizeInput(schema)}'`;
        if (type) query += ` AND e.TABLE_TYPE = '${sanitizeInput(type)}'`;
        if (tags) {
            const tagList = tags.split(',').map(t => `'${sanitizeInput(t)}'`).join(',');
            query += ` AND t.TAG_NAME IN (${tagList})`;
            query += ` AND t.OBJECT_DOMAIN = 'TABLE'`;
            query += ` AND t.DELETED IS NULL`;
        }
        if (search) {
            query += ` AND (e.TABLE_NAME ILIKE '%${sanitizeInput(search)}%' 
                        OR e.SYSTEM_COMMENT ILIKE '%${sanitizeInput(search)}%' 
                        OR e.USER_DESCRIPTION ILIKE '%${sanitizeInput(search)}%')`;
        }
        
        query += ` ORDER BY e.VIEW_COUNT DESC, e.LAST_ALTERED DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
        
        const rows = await executeQuery(connection, query);
        
        res.json({ 
            success: true,
            data: rows,
            count: rows.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('❌ Catalog API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch catalog data'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get detailed metadata for a specific table
app.get('/api/catalog/:database/:schema/:table', async (req, res) => {
    const { database, schema, table } = req.params;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT * FROM ENRICHED_CATALOG 
            WHERE DATABASE_NAME = '${database}'
              AND SCHEMA_NAME = '${schema}'
              AND TABLE_NAME = '${table}'
        `;
        
        const rows = await executeQuery(connection, query);
        
        if (rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Table not found'
            });
        } else {
            res.json({ 
                success: true,
                data: rows[0]
            });
        }
        
    } catch (error) {
        console.error('❌ Table detail API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch table details'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get column details for a table
app.get('/api/columns/:database/:schema/:table', async (req, res) => {
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT * FROM CATALOG_COLUMNS 
            WHERE FULL_TABLE_NAME = '${fullTableName}'
            ORDER BY ORDINAL_POSITION
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Columns API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch column details'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get data preview for a table (with fallback to synthetic data indicator)
app.get('/api/tables/:tableName/preview', async (req, res) => {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Attempt to query the actual table data
        const query = `SELECT * FROM ${tableName} LIMIT ${limit}`;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            hasAccess: true,
            isSynthetic: false,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Preview API error:', error.message);
        
        // Check if it's a permission error
        const isPermissionError = error.message && (
            error.message.includes('insufficient privileges') ||
            error.message.includes('does not exist or not authorized') ||
            error.message.includes('Object') && error.message.includes('does not exist')
        );
        
        if (isPermissionError) {
            // Return indicator that synthetic data should be shown
            res.json({
                success: true,
                hasAccess: false,
                isSynthetic: true,
                data: [],
                error: 'No access to table data'
            });
        } else {
            res.status(500).json({
                success: false,
                hasAccess: false,
                isSynthetic: true,
                error: 'Failed to fetch preview data',
                data: []
            });
        }
    } finally {
        if (connection) connection.destroy();
    }
});

// Get list of databases
app.get('/api/databases', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT DISTINCT DATABASE_NAME, COUNT(*) as table_count
            FROM CATALOG_METADATA
            GROUP BY DATABASE_NAME
            ORDER BY DATABASE_NAME
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Databases API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch databases'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get schemas for a database
app.get('/api/schemas', async (req, res) => {
    const { database } = req.query;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        let query = `
            SELECT DISTINCT SCHEMA_NAME, COUNT(*) as table_count
            FROM CATALOG_METADATA
            WHERE 1=1
        `;
        
        if (database) query += ` AND DATABASE_NAME = '${database}'`;
        query += ` GROUP BY SCHEMA_NAME ORDER BY SCHEMA_NAME`;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Schemas API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch schemas'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Search catalog
app.get('/api/search', async (req, res) => {
    const { q, limit = 50 } = req.query;
    let connection;
    
    if (!q) {
        return res.status(400).json({
            success: false,
            error: 'Search query parameter required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT * FROM ENRICHED_CATALOG 
            WHERE TABLE_NAME ILIKE '%${q}%'
               OR SYSTEM_COMMENT ILIKE '%${q}%'
               OR USER_DESCRIPTION ILIKE '%${q}%'
            ORDER BY AVG_RATING DESC, LAST_ALTERED DESC
            LIMIT ${limit}
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows,
            query: q
        });
        
    } catch (error) {
        console.error('❌ Search API error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// USER-GENERATED CONTENT ENDPOINTS
// ============================================================================

// Submit or update rating for a table
app.post('/api/ratings', async (req, res) => {
    const { table, rating } = req.body;
    let connection;
    
    if (!table || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({
            success: false,
            error: 'Valid table name and rating (1-5) required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            MERGE INTO USER_RATINGS t
            USING (SELECT '${table}' as TABLE_FULL_NAME, CURRENT_USER() as USER_NAME, ${rating} as RATING) s
            ON t.TABLE_FULL_NAME = s.TABLE_FULL_NAME AND t.USER_NAME = s.USER_NAME
            WHEN MATCHED THEN UPDATE SET t.RATING = s.RATING
            WHEN NOT MATCHED THEN INSERT (TABLE_FULL_NAME, USER_NAME, RATING) 
                VALUES (s.TABLE_FULL_NAME, s.USER_NAME, s.RATING)
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Rating submitted successfully'
        });
        
    } catch (error) {
        console.error('❌ Rating API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit rating'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get ratings for a table
app.get('/api/ratings/:table', async (req, res) => {
    const table = decodeURIComponent(req.params.table);
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT USER_NAME, RATING, CREATED_AT
            FROM USER_RATINGS
            WHERE TABLE_FULL_NAME = '${table}'
            ORDER BY CREATED_AT DESC
        `;
        
        const rows = await executeQuery(connection, query);
        
        const avgQuery = `
            SELECT AVG(RATING) as avg_rating, COUNT(*) as rating_count
            FROM USER_RATINGS
            WHERE TABLE_FULL_NAME = '${table}'
        `;
        const avgRows = await executeQuery(connection, avgQuery);
        
        res.json({ 
            success: true,
            data: rows,
            average: avgRows[0]
        });
        
    } catch (error) {
        console.error('❌ Get ratings API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch ratings'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Add comment to a table
app.post('/api/comments', async (req, res) => {
    const { table, comment } = req.body;
    let connection;
    
    if (!table || !comment) {
        return res.status(400).json({
            success: false,
            error: 'Table name and comment text required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            INSERT INTO USER_COMMENTS (TABLE_FULL_NAME, USER_NAME, COMMENT_TEXT)
            VALUES ('${table}', CURRENT_USER(), '${comment.replace(/'/g, "''")}')
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Comment added successfully'
        });
        
    } catch (error) {
        console.error('❌ Comment API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add comment'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get comments for a table
app.get('/api/comments/:table', async (req, res) => {
    const table = decodeURIComponent(req.params.table);
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT COMMENT_ID, USER_NAME, COMMENT_TEXT, CREATED_AT, UPDATED_AT
            FROM USER_COMMENTS
            WHERE TABLE_FULL_NAME = '${table}'
            ORDER BY CREATED_AT DESC
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Get comments API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch comments'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Update wiki description for a table (now creates change request)
app.put('/api/description/:table', async (req, res) => {
    const table = decodeURIComponent(req.params.table);
    const { description, justification } = req.body;
    let connection;
    
    if (!description) {
        return res.status(400).json({
            success: false,
            error: 'Description text required'
        });
    }
    
    if (!justification) {
        return res.status(400).json({
            success: false,
            error: 'Justification required for description changes'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        // Get current description
        const getCurrentQuery = `
            SELECT USER_DESCRIPTION
            FROM TABLE_DESCRIPTIONS
            WHERE TABLE_FULL_NAME = '${table}'
        `;
        const currentRows = await executeQuery(connection, getCurrentQuery);
        const currentValue = currentRows.length > 0 ? currentRows[0].USER_DESCRIPTION : null;
        
        // Get table contacts for assignment
        const [db, schema, tableName] = table.split('.');
        const contactsQuery = `
            SELECT PURPOSE, METHOD, INHERITED
            FROM TABLE(SNOWFLAKE.CORE.GET_CONTACTS('${table}'))
        `;
        let assignedTo = null;
        try {
            const contacts = await executeQuery(connection, contactsQuery);
            const owner = contacts.find(c => c.PURPOSE === 'OWNER' || c.PURPOSE === 'STEWARD');
            if (owner) {
                assignedTo = owner.METHOD;
            }
        } catch (err) {
            console.log('No contacts found for table, leaving unassigned');
        }
        
        // Create change request
        const insertQuery = `
            INSERT INTO CHANGE_REQUESTS (
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                CURRENT_VALUE,
                ASSIGNED_TO
            )
            SELECT
                'DESCRIPTION',
                '${table}',
                CURRENT_USER(),
                '${justification.replace(/'/g, "''")}',
                PARSE_JSON('${JSON.stringify({description: description}).replace(/'/g, "''")}'),
                ${currentValue ? `PARSE_JSON('${JSON.stringify({description: currentValue}).replace(/'/g, "''")}')` : 'NULL'},
                ${assignedTo ? `'${assignedTo}'` : 'NULL'}
        `;
        
        await executeQuery(connection, insertQuery);
        res.json({ 
            success: true,
            message: 'Description change request submitted for approval'
        });
        
    } catch (error) {
        console.error('❌ Description API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit description change request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get wiki description for a table
app.get('/api/description/:table', async (req, res) => {
    const table = decodeURIComponent(req.params.table);
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT USER_DESCRIPTION, LAST_UPDATED_BY, UPDATED_AT
            FROM TABLE_DESCRIPTIONS
            WHERE TABLE_FULL_NAME = '${table}'
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows.length > 0 ? rows[0] : null
        });
        
    } catch (error) {
        console.error('❌ Get description API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch description'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// ACCESS REQUEST WORKFLOW ENDPOINTS
// ============================================================================

// Submit access request
app.post('/api/access-requests', async (req, res) => {
    const { table, justification, accessStartDate, accessEndDate, accessType, grantToName } = req.body;
    let connection;
    
    if (!table || !justification || !accessStartDate || !accessEndDate || !accessType || !grantToName) {
        return res.status(400).json({
            success: false,
            error: 'All fields required: table, justification, access dates, access type, and grant target'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            INSERT INTO ACCESS_REQUESTS (
                TABLE_FULL_NAME, REQUESTER, JUSTIFICATION,
                ACCESS_START_DATE, ACCESS_END_DATE, ACCESS_TYPE, GRANT_TO_NAME
            )
            VALUES (
                '${sanitizeInput(table)}', 
                CURRENT_USER(), 
                '${sanitizeInput(justification)}',
                '${sanitizeInput(accessStartDate)}',
                '${sanitizeInput(accessEndDate)}',
                '${sanitizeInput(accessType)}',
                '${sanitizeInput(grantToName)}'
            )
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Access request submitted successfully'
        });
        
    } catch (error) {
        console.error('❌ Access request API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit access request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get user's access requests
app.get('/api/access-requests', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT REQUEST_ID, TABLE_FULL_NAME, REQUESTER, JUSTIFICATION, 
                   STATUS, APPROVER, DECISION_DATE, DECISION_COMMENT, REQUESTED_AT
            FROM ACCESS_REQUESTS
            WHERE REQUESTER = CURRENT_USER()
            ORDER BY REQUESTED_AT DESC
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Get access requests API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch access requests'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get pending access requests (for admins)
app.get('/api/access-requests/pending', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                REQUEST_ID, TABLE_FULL_NAME, REQUESTER, JUSTIFICATION, REQUESTED_AT,
                ACCESS_START_DATE, ACCESS_END_DATE, ACCESS_TYPE, GRANT_TO_NAME,
                ASSIGNED_TO, ADDITIONAL_INFO, STATUS, APPROVER, DECISION_DATE, DECISION_COMMENT
            FROM ACCESS_REQUESTS
            WHERE STATUS IN ('pending', 'pending_info')
            ORDER BY REQUESTED_AT ASC
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ 
            success: true,
            data: rows
        });
        
    } catch (error) {
        console.error('❌ Get pending requests API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending requests'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Approve access request
app.put('/api/access-requests/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Check permission
        const hasPermission = await checkPermission(connection, 'APPROVE_DATA_ACCESS', req);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Your role does not have permission to approve data access requests'
            });
        }
        
        const query = `
            UPDATE ACCESS_REQUESTS
            SET STATUS = 'approved',
                APPROVER = CURRENT_USER(),
                DECISION_DATE = CURRENT_TIMESTAMP(),
                DECISION_COMMENT = '${comment ? comment.replace(/'/g, "''") : ''}'
            WHERE REQUEST_ID = '${id}'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Access request approved'
        });
        
    } catch (error) {
        console.error('❌ Approve request API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Request more information from user
app.put('/api/access-requests/:id/request-info', async (req, res) => {
    const { id } = req.params;
    const { requestedBy, infoNeeded } = req.body;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            UPDATE ACCESS_REQUESTS
            SET STATUS = 'pending_info',
                ASSIGNED_TO = '${sanitizeInput(requestedBy)}',
                ADDITIONAL_INFO = '${sanitizeInput(infoNeeded)}'
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Additional information requested from user'
        });
        
    } catch (error) {
        console.error('❌ Request info API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to request additional information'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Reassign access request to another admin
app.put('/api/access-requests/:id/reassign', async (req, res) => {
    const { id } = req.params;
    const { assignTo } = req.body;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            UPDATE ACCESS_REQUESTS
            SET ASSIGNED_TO = '${sanitizeInput(assignTo)}'
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: `Request reassigned to ${assignTo}`
        });
        
    } catch (error) {
        console.error('❌ Reassign request API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reassign request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// User updates request with additional info
app.put('/api/access-requests/:id/update-info', async (req, res) => {
    const { id } = req.params;
    const { additionalInfo } = req.body;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            UPDATE ACCESS_REQUESTS
            SET STATUS = 'pending',
                JUSTIFICATION = JUSTIFICATION || ' [Additional Info: ${sanitizeInput(additionalInfo)}]'
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
              AND STATUS = 'pending_info'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Request updated and resubmitted for approval'
        });
        
    } catch (error) {
        console.error('❌ Update info API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Deny access request
app.put('/api/access-requests/:id/deny', async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            UPDATE ACCESS_REQUESTS
            SET STATUS = 'denied',
                APPROVER = CURRENT_USER(),
                DECISION_DATE = CURRENT_TIMESTAMP(),
                DECISION_COMMENT = '${comment ? comment.replace(/'/g, "''") : ''}'
            WHERE REQUEST_ID = '${id}'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Access request denied'
        });
        
    } catch (error) {
        console.error('❌ Deny request API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deny request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// MAINTENANCE ENDPOINTS
// ============================================================================

// Trigger catalog metadata refresh
app.post('/api/refresh-catalog', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Step 1: Clear existing metadata
        console.log('📋 Clearing existing catalog metadata...');
        await executeQuery(connection, 'DELETE FROM CATALOG_DB.CATALOG_SCHEMA.CATALOG_METADATA');
        
        // Step 2: Get all accessible databases
        console.log('📋 Fetching accessible databases...');
        const databases = await executeQuery(connection, 'SHOW DATABASES');
        const dbNames = databases
            .map(db => db.name)
            .filter(name => name !== 'SNOWFLAKE' && !name.startsWith('SNOWFLAKE_'));
        
        console.log(`📋 Found ${dbNames.length} databases to scan`);
        
        let totalTables = 0;
        let totalColumns = 0;
        const errors = [];
        
        // Step 3: For each database, get tables from INFORMATION_SCHEMA (real-time data)
        for (const dbName of dbNames) {
            try {
                // Get tables from this database
                const tableQuery = `
                    INSERT INTO CATALOG_DB.CATALOG_SCHEMA.CATALOG_METADATA (
                        DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, TABLE_TYPE,
                        ROW_COUNT, BYTES, CREATED, LAST_ALTERED, COMMENT
                    )
                    SELECT 
                        TABLE_CATALOG,
                        TABLE_SCHEMA,
                        TABLE_NAME,
                        TABLE_TYPE,
                        ROW_COUNT,
                        BYTES,
                        CREATED,
                        LAST_ALTERED,
                        COMMENT
                    FROM "${dbName}".INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA != 'INFORMATION_SCHEMA'
                `;
                const result = await executeQuery(connection, tableQuery);
                const inserted = result[0]?.['number of rows inserted'] || 0;
                totalTables += inserted;
            } catch (dbError) {
                // Skip databases we can't access
                console.log(`⚠️ Skipping ${dbName}: ${dbError.message}`);
                errors.push({ database: dbName, error: dbError.message });
            }
        }
        
        // Step 4: Clear and refresh column metadata
        console.log('📋 Refreshing column metadata...');
        await executeQuery(connection, 'DELETE FROM CATALOG_DB.CATALOG_SCHEMA.CATALOG_COLUMNS');
        
        for (const dbName of dbNames) {
            try {
                const columnQuery = `
                    INSERT INTO CATALOG_DB.CATALOG_SCHEMA.CATALOG_COLUMNS (
                        FULL_TABLE_NAME, COLUMN_NAME, DATA_TYPE,
                        IS_NULLABLE, COMMENT, ORDINAL_POSITION
                    )
                    SELECT 
                        TABLE_CATALOG || '.' || TABLE_SCHEMA || '.' || TABLE_NAME,
                        COLUMN_NAME,
                        DATA_TYPE,
                        IS_NULLABLE,
                        COMMENT,
                        ORDINAL_POSITION
                    FROM "${dbName}".INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA != 'INFORMATION_SCHEMA'
                `;
                const result = await executeQuery(connection, columnQuery);
                const inserted = result[0]?.['number of rows inserted'] || 0;
                totalColumns += inserted;
            } catch (dbError) {
                // Skip databases we can't access
            }
        }
        
        console.log(`✅ Catalog refresh complete: ${totalTables} tables, ${totalColumns} columns`);
        
        res.json({ 
            success: true,
            message: `Catalog refreshed: ${totalTables} tables, ${totalColumns} columns from ${dbNames.length} databases`,
            stats: {
                databases: dbNames.length,
                tables: totalTables,
                columns: totalColumns,
                skipped: errors.length
            }
        });
        
    } catch (error) {
        console.error('❌ Refresh catalog API error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to refresh catalog'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// POPULARITY TRACKING
// ============================================================================

// Track table view
app.post('/api/popularity/:database/:schema/:table', async (req, res) => {
    let connection;
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            MERGE INTO TABLE_POPULARITY t
            USING (SELECT '${sanitizeInput(fullTableName)}' as table_name) s
            ON t.TABLE_FULL_NAME = s.table_name
            WHEN MATCHED THEN UPDATE SET 
                VIEW_COUNT = VIEW_COUNT + 1,
                LAST_VIEWED = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT 
                (TABLE_FULL_NAME, VIEW_COUNT, LAST_VIEWED, UNIQUE_VIEWERS)
                VALUES (s.table_name, 1, CURRENT_TIMESTAMP(), 1)
        `;
        
        await executeQuery(connection, query);
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Track popularity error:', error);
        res.status(500).json({ success: false, error: 'Failed to track view' });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// TAGS
// ============================================================================

// Get all available tags (for filter) - using SHOW TAGS IN ACCOUNT
app.get('/api/tags', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // First execute SHOW TAGS IN ACCOUNT
        await executeQuery(connection, 'SHOW TAGS IN ACCOUNT');
        
        // Query the results directly from RESULT_SCAN
        const tagsQuery = `
            SELECT 
                "database_name" as TAG_DATABASE,
                "schema_name" as TAG_SCHEMA,
                "name" as TAG_NAME,
                "database_name" || '.' || "schema_name" || '.' || "name" as FULL_TAG_NAME
            FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))
            ORDER BY "database_name", "schema_name", "name"
        `;
        
        const tags = await executeQuery(connection, tagsQuery);
        
        // Get usage counts and values from TAG_REFERENCES
        const countAndValuesQuery = `
            SELECT 
                TAG_DATABASE || '.' || TAG_SCHEMA || '.' || TAG_NAME as FULL_TAG_NAME,
                COUNT(DISTINCT OBJECT_NAME) as COUNT,
                ARRAY_AGG(DISTINCT TAG_VALUE) as TAG_VALUES
            FROM SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES
            WHERE OBJECT_DOMAIN = 'TABLE'
              AND DELETED IS NULL
              AND TAG_VALUE IS NOT NULL
            GROUP BY TAG_DATABASE, TAG_SCHEMA, TAG_NAME
        `;
        
        let countMap = {};
        let valuesMap = {};
        try {
            const results = await executeQuery(connection, countAndValuesQuery);
            (results || []).forEach(row => {
                countMap[row.FULL_TAG_NAME] = row.COUNT;
                // Parse TAG_VALUES - it comes as a JSON array string
                try {
                    const values = typeof row.TAG_VALUES === 'string' 
                        ? JSON.parse(row.TAG_VALUES) 
                        : row.TAG_VALUES;
                    valuesMap[row.FULL_TAG_NAME] = (values || []).filter(v => v !== null && v !== '');
                } catch (e) {
                    valuesMap[row.FULL_TAG_NAME] = [];
                }
            });
        } catch (e) {
            console.log('Could not fetch tag counts/values, proceeding without them');
        }
        
        // Merge tags with counts and values
        const result = (tags || []).map(tag => ({
            TAG_NAME: tag.TAG_NAME,
            TAG_DATABASE: tag.TAG_DATABASE,
            TAG_SCHEMA: tag.TAG_SCHEMA,
            FULL_TAG_NAME: tag.FULL_TAG_NAME,
            COUNT: countMap[tag.FULL_TAG_NAME] || 0,
            VALUES: valuesMap[tag.FULL_TAG_NAME] || []
        }));
        
        res.json({ success: true, data: result });
        
    } catch (error) {
        console.error('❌ Get all tags error:', error);
        // Return empty array instead of error to prevent UI crash
        res.json({ success: true, data: [] });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get tag references for all tables (for client-side filtering)
app.get('/api/tag-references', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Query from TAG_CACHE table for real-time tag data
        // This cache is populated by SYNC_TAG_CACHE_TASK hourly
        // and updated immediately when tags are applied via the app
        const query = `
            SELECT 
                FULL_TABLE_NAME,
                FULL_TAG_NAME,
                COALESCE(TAG_VALUE, '') as TAG_VALUE
            FROM CATALOG_DB.CATALOG_SCHEMA.TAG_CACHE
            ORDER BY FULL_TABLE_NAME, FULL_TAG_NAME
        `;
        
        const rows = await executeQuery(connection, query);
        
        // Transform into a map: { "DB.SCHEMA.TABLE": [{tag: "TAG1", value: "val1"}, ...] }
        const tableTagsMap = (rows || []).reduce((acc, row) => {
            if (!acc[row.FULL_TABLE_NAME]) {
                acc[row.FULL_TABLE_NAME] = [];
            }
            acc[row.FULL_TABLE_NAME].push({
                tag: row.FULL_TAG_NAME,
                value: row.TAG_VALUE
            });
            return acc;
        }, {});
        
        res.json({ success: true, data: tableTagsMap });
        
    } catch (error) {
        console.error('❌ Get tag references error:', error);
        res.json({ success: true, data: {} });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get contacts for all tables (for client-side display in catalog browser)
app.get('/api/contacts-bulk', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Try to fetch from CATALOG_CONTACTS table if it exists
        const query = `
            SELECT 
                FULL_TABLE_NAME,
                PURPOSE,
                METHOD
            FROM CATALOG_CONTACTS
            WHERE PURPOSE IN ('DATA_OWNER', 'STEWARD', 'DOMAIN_EXPERT')
            ORDER BY FULL_TABLE_NAME, PURPOSE
        `;
        
        const rows = await executeQuery(connection, query);
        
        // Transform into a map: { "DB.SCHEMA.TABLE": [{PURPOSE: "DATA_OWNER", METHOD: "user@example.com"}, ...] }
        const tableContactsMap = (rows || []).reduce((acc, row) => {
            if (!acc[row.FULL_TABLE_NAME]) {
                acc[row.FULL_TABLE_NAME] = [];
            }
            acc[row.FULL_TABLE_NAME].push({
                PURPOSE: row.PURPOSE,
                METHOD: row.METHOD
            });
            return acc;
        }, {});
        
        res.json({ success: true, data: tableContactsMap });
        
    } catch (error) {
        console.error('❌ Get bulk contacts error:', error.message);
        // Return empty if table doesn't exist or other error
        res.json({ success: true, data: {} });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get tags for a table
app.get('/api/tags/:database/:schema/:table', async (req, res) => {
    let connection;
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT TAG_ID, TAG_NAME, CREATED_BY, CREATED_AT
            FROM TABLE_TAGS
            WHERE TABLE_FULL_NAME = '${sanitizeInput(fullTableName)}'
            ORDER BY CREATED_AT DESC
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows });
        
    } catch (error) {
        console.error('❌ Get tags error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tags' });
    } finally {
        if (connection) connection.destroy();
    }
});

// Add tag to a table (now creates change request)
app.post('/api/tags', async (req, res) => {
    let connection;
    const { tableFullName, tagName, justification } = req.body;
    
    if (!justification) {
        return res.status(400).json({
            success: false,
            error: 'Justification required for tag changes'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        // Get table contacts for assignment
        const contactsQuery = `
            SELECT PURPOSE, METHOD, INHERITED
            FROM TABLE(SNOWFLAKE.CORE.GET_CONTACTS('${tableFullName}'))
        `;
        let assignedTo = null;
        try {
            const contacts = await executeQuery(connection, contactsQuery);
            const owner = contacts.find(c => c.PURPOSE === 'OWNER' || c.PURPOSE === 'STEWARD');
            if (owner) {
                assignedTo = owner.METHOD;
            }
        } catch (err) {
            console.log('No contacts found for table, leaving unassigned');
        }
        
        // Create change request
        const query = `
            INSERT INTO CHANGE_REQUESTS (
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                ASSIGNED_TO
            )
            SELECT
                'TAG_ADD',
                '${sanitizeInput(tableFullName)}',
                CURRENT_USER(),
                '${justification.replace(/'/g, "''")}',
                PARSE_JSON('${JSON.stringify({tag_name: tagName, action: 'add'}).replace(/'/g, "''")}'),
                ${assignedTo ? `'${assignedTo}'` : 'NULL'}
        `;
        
        await executeQuery(connection, query);
        res.json({ success: true, message: 'Tag change request submitted for approval' });
        
    } catch (error) {
        console.error('❌ Add tag error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit tag request' });
    } finally {
        if (connection) connection.destroy();
    }
});

// Delete tag (now creates change request)
app.delete('/api/tags/:tagId', async (req, res) => {
    let connection;
    const { tagId } = req.params;
    const { justification } = req.body;
    
    if (!justification) {
        return res.status(400).json({
            success: false,
            error: 'Justification required for tag removal'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        // Get tag details
        const getTagQuery = `SELECT TABLE_FULL_NAME, TAG_NAME FROM TABLE_TAGS WHERE TAG_ID = '${sanitizeInput(tagId)}'`;
        const tagRows = await executeQuery(connection, getTagQuery);
        
        if (tagRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tag not found' });
        }
        
        const { TABLE_FULL_NAME, TAG_NAME } = tagRows[0];
        
        // Get table contacts for assignment
        const contactsQuery = `
            SELECT PURPOSE, METHOD, INHERITED
            FROM TABLE(SNOWFLAKE.CORE.GET_CONTACTS('${TABLE_FULL_NAME}'))
        `;
        let assignedTo = null;
        try {
            const contacts = await executeQuery(connection, contactsQuery);
            const owner = contacts.find(c => c.PURPOSE === 'OWNER' || c.PURPOSE === 'STEWARD');
            if (owner) {
                assignedTo = owner.METHOD;
            }
        } catch (err) {
            console.log('No contacts found for table, leaving unassigned');
        }
        
        // Create change request
        const query = `
            INSERT INTO CHANGE_REQUESTS (
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                ASSIGNED_TO
            )
            SELECT
                'TAG_REMOVE',
                '${sanitizeInput(TABLE_FULL_NAME)}',
                CURRENT_USER(),
                '${justification.replace(/'/g, "''")}',
                PARSE_JSON('${JSON.stringify({tag_id: tagId, tag_name: TAG_NAME, action: 'remove'}).replace(/'/g, "''")}'),
                ${assignedTo ? `'${assignedTo}'` : 'NULL'}
        `;
        
        await executeQuery(connection, query);
        res.json({ success: true, message: 'Tag removal request submitted for approval' });
        
    } catch (error) {
        console.error('❌ Delete tag error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit tag removal request' });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// DATA PRODUCTS (Snowflake Tags)
// ============================================================================

// Get all unique Data Product tag values
app.get('/api/data-products', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Query from TAG_CACHE for all DATA_PRODUCT tag values
        // This gives us real-time data without ACCOUNT_USAGE latency
        const query = `
            SELECT DISTINCT TAG_VALUE
            FROM CATALOG_DB.CATALOG_SCHEMA.TAG_CACHE
            WHERE TAG_NAME = 'DATA_PRODUCT'
            AND TAG_SCHEMA = 'CATALOG_SCHEMA'
            AND TAG_DATABASE = 'CATALOG_DB'
            AND TAG_VALUE IS NOT NULL
            ORDER BY TAG_VALUE
        `;
        
        console.log('📦 Fetching data products from TAG_CACHE...');
        const rows = await executeQuery(connection, query);
        console.log('📦 Found data products:', rows.length, rows.map(r => r.TAG_VALUE));
        
        const dataProducts = rows.map(r => r.TAG_VALUE);
        
        res.json({ success: true, data: dataProducts });
        
    } catch (error) {
        console.error('❌ Get data products error:', error.message);
        
        // Fallback: Return empty array if query fails (e.g., permission issues)
        res.json({ success: true, data: [] });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get Data Product tag for a specific table
app.get('/api/tables/:database/:schema/:table/data-product', async (req, res) => {
    let connection;
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Try primary query using INFORMATION_SCHEMA.TAG_REFERENCES
        const query = `
            SELECT TAG_VALUE
            FROM TABLE(INFORMATION_SCHEMA.TAG_REFERENCES(
                '${sanitizeInput(fullTableName)}', 'TABLE'
            ))
            WHERE TAG_NAME = 'DATA_PRODUCT'
            AND TAG_SCHEMA = 'CATALOG_SCHEMA'
            AND TAG_DATABASE = 'CATALOG_DB'
        `;
        
        console.log(`📦 Fetching Data Product for table: ${fullTableName}`);
        const rows = await executeQuery(connection, query);
        console.log(`📦 Primary query returned ${rows.length} rows`);
        
        if (rows.length > 0) {
            const dataProduct = rows[0].TAG_VALUE;
            console.log(`📦 Found Data Product: ${dataProduct}`);
            res.json({ success: true, data: { dataProduct } });
            return;
        }
        
        // Fallback: Try querying as VIEW instead of TABLE
        try {
            console.log(`📦 Trying as VIEW...`);
            const viewQuery = `
                SELECT TAG_VALUE
                FROM TABLE(INFORMATION_SCHEMA.TAG_REFERENCES(
                    '${sanitizeInput(fullTableName)}', 'VIEW'
                ))
                WHERE TAG_NAME = 'DATA_PRODUCT'
                AND TAG_SCHEMA = 'CATALOG_SCHEMA'
                AND TAG_DATABASE = 'CATALOG_DB'
            `;
            const viewRows = await executeQuery(connection, viewQuery);
            console.log(`📦 VIEW query returned ${viewRows.length} rows`);
            
            if (viewRows.length > 0) {
                const dataProduct = viewRows[0].TAG_VALUE;
                console.log(`📦 Found Data Product (as VIEW): ${dataProduct}`);
                res.json({ success: true, data: { dataProduct } });
                return;
            }
        } catch (viewErr) {
            console.log(`📦 VIEW query failed: ${viewErr.message}`);
        }
        
        // No data product found
        console.log(`📦 No Data Product found for ${fullTableName}`);
        res.json({ success: true, data: { dataProduct: null } });
        
    } catch (error) {
        console.error('❌ Get table data product error:', error.message);
        res.json({ success: true, data: { dataProduct: null } });
    } finally {
        if (connection) connection.destroy();
    }
});

// Set Data Product tag on a table
app.post('/api/tables/:database/:schema/:table/data-product', async (req, res) => {
    let connection;
    const { database, schema, table } = req.params;
    const { dataProduct } = req.body;
    const fullTableName = `${database}.${schema}.${table}`;
    
    if (!dataProduct || !dataProduct.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Data Product name is required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        console.log(`📦 Setting Data Product "${dataProduct.trim()}" on ${fullTableName}`);
        
        // Set the DATA_PRODUCT tag on the table
        // Note: The same tag value can be applied to multiple tables/views
        const query = `
            ALTER TABLE ${sanitizeInput(fullTableName)}
            SET TAG CATALOG_DB.CATALOG_SCHEMA.DATA_PRODUCT = '${sanitizeInput(dataProduct.trim())}'
        `;
        
        await executeQuery(connection, query);
        console.log(`📦 Successfully set Data Product tag on TABLE ${fullTableName}`);
        
        // Refresh the TAG_CACHE for this object
        try {
            await executeQuery(connection, `CALL CATALOG_DB.CATALOG_SCHEMA.REFRESH_TAG_CACHE_FOR_OBJECT('${sanitizeInput(fullTableName)}', 'TABLE')`);
            console.log(`📦 Refreshed TAG_CACHE for ${fullTableName}`);
        } catch (cacheErr) {
            console.log(`📦 TAG_CACHE refresh warning: ${cacheErr.message}`);
        }
        
        res.json({ 
            success: true, 
            message: `Table added to Data Product: ${dataProduct.trim()}`
        });
        
    } catch (error) {
        console.error('❌ Set data product error (TABLE):', error.message);
        
        // Try with VIEW if TABLE fails
        try {
            console.log(`📦 Trying as VIEW...`);
            const viewQuery = `
                ALTER VIEW ${sanitizeInput(fullTableName)}
                SET TAG CATALOG_DB.CATALOG_SCHEMA.DATA_PRODUCT = '${sanitizeInput(dataProduct.trim())}'
            `;
            await executeQuery(connection, viewQuery);
            console.log(`📦 Successfully set Data Product tag on VIEW ${fullTableName}`);
            
            // Refresh the TAG_CACHE for this object
            try {
                await executeQuery(connection, `CALL CATALOG_DB.CATALOG_SCHEMA.REFRESH_TAG_CACHE_FOR_OBJECT('${sanitizeInput(fullTableName)}', 'VIEW')`);
                console.log(`📦 Refreshed TAG_CACHE for ${fullTableName}`);
            } catch (cacheErr) {
                console.log(`📦 TAG_CACHE refresh warning: ${cacheErr.message}`);
            }
            
            res.json({ 
                success: true, 
                message: `View added to Data Product: ${dataProduct.trim()}`
            });
        } catch (viewError) {
            console.error('❌ Set data product error (VIEW):', viewError.message);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to set Data Product tag. Ensure you have APPLY TAG privileges.'
            });
        }
    } finally {
        if (connection) connection.destroy();
    }
});

// Remove Data Product tag from a table
app.delete('/api/tables/:database/:schema/:table/data-product', async (req, res) => {
    let connection;
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Remove the DATA_PRODUCT tag from the table
        const query = `
            ALTER TABLE ${sanitizeInput(fullTableName)}
            UNSET TAG CATALOG_DB.CATALOG_SCHEMA.DATA_PRODUCT
        `;
        
        await executeQuery(connection, query);
        
        // Refresh the TAG_CACHE for this object
        try {
            await executeQuery(connection, `CALL CATALOG_DB.CATALOG_SCHEMA.REFRESH_TAG_CACHE_FOR_OBJECT('${sanitizeInput(fullTableName)}', 'TABLE')`);
        } catch (cacheErr) {
            console.log(`📦 TAG_CACHE refresh warning: ${cacheErr.message}`);
        }
        
        res.json({ 
            success: true, 
            message: 'Data Product tag removed from table'
        });
        
    } catch (error) {
        console.error('❌ Remove data product error:', error);
        
        // Try with VIEW if TABLE fails
        try {
            const viewQuery = `
                ALTER VIEW ${sanitizeInput(fullTableName)}
                UNSET TAG CATALOG_DB.CATALOG_SCHEMA.DATA_PRODUCT
            `;
            await executeQuery(connection, viewQuery);
            
            // Refresh the TAG_CACHE for this object
            try {
                await executeQuery(connection, `CALL CATALOG_DB.CATALOG_SCHEMA.REFRESH_TAG_CACHE_FOR_OBJECT('${sanitizeInput(fullTableName)}', 'VIEW')`);
            } catch (cacheErr) {
                console.log(`📦 TAG_CACHE refresh warning: ${cacheErr.message}`);
            }
            
            res.json({ 
                success: true, 
                message: 'Data Product tag removed from view'
            });
        } catch (viewError) {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to remove Data Product tag'
            });
        }
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// LINEAGE
// ============================================================================

// Get lineage for a table using SNOWFLAKE.CORE.GET_LINEAGE
app.get('/api/lineage/:database/:schema/:table', async (req, res) => {
    let connection;
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Get upstream lineage (sources)
        const upstreamQuery = `
            SELECT 
                'UPSTREAM' as DIRECTION,
                SOURCE_OBJECT_DATABASE,
                SOURCE_OBJECT_SCHEMA,
                SOURCE_OBJECT_NAME,
                SOURCE_OBJECT_DOMAIN,
                TARGET_OBJECT_DATABASE,
                TARGET_OBJECT_SCHEMA,
                TARGET_OBJECT_NAME,
                TARGET_OBJECT_DOMAIN,
                DISTANCE
            FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE('${sanitizeInput(fullTableName)}', 'TABLE', 'UPSTREAM', 3))
        `;
        
        // Get downstream lineage (targets)
        const downstreamQuery = `
            SELECT 
                'DOWNSTREAM' as DIRECTION,
                SOURCE_OBJECT_DATABASE,
                SOURCE_OBJECT_SCHEMA,
                SOURCE_OBJECT_NAME,
                SOURCE_OBJECT_DOMAIN,
                TARGET_OBJECT_DATABASE,
                TARGET_OBJECT_SCHEMA,
                TARGET_OBJECT_NAME,
                TARGET_OBJECT_DOMAIN,
                DISTANCE
            FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE('${sanitizeInput(fullTableName)}', 'TABLE', 'DOWNSTREAM', 3))
        `;
        
        const upstreamRows = await executeQuery(connection, upstreamQuery);
        const downstreamRows = await executeQuery(connection, downstreamQuery);
        
        // Transform to the format expected by the frontend
        const upstream = upstreamRows.map(row => ({
            SOURCE_TABLE: `${row.SOURCE_OBJECT_DATABASE}.${row.SOURCE_OBJECT_SCHEMA}.${row.SOURCE_OBJECT_NAME}`,
            SOURCE_DATABASE: row.SOURCE_OBJECT_DATABASE,
            SOURCE_SCHEMA: row.SOURCE_OBJECT_SCHEMA,
            SOURCE_NAME: row.SOURCE_OBJECT_NAME,
            SOURCE_DOMAIN: row.SOURCE_OBJECT_DOMAIN,
            TARGET_TABLE: fullTableName,
            TARGET_DATABASE: database,
            TARGET_SCHEMA: schema,
            TARGET_NAME: table,
            TARGET_DOMAIN: 'TABLE',
            LINEAGE_TYPE: 'UPSTREAM',
            DISTANCE: row.DISTANCE
        }));
        
        const downstream = downstreamRows.map(row => ({
            SOURCE_TABLE: fullTableName,
            SOURCE_DATABASE: database,
            SOURCE_SCHEMA: schema,
            SOURCE_NAME: table,
            SOURCE_DOMAIN: 'TABLE',
            TARGET_TABLE: `${row.TARGET_OBJECT_DATABASE}.${row.TARGET_OBJECT_SCHEMA}.${row.TARGET_OBJECT_NAME}`,
            TARGET_DATABASE: row.TARGET_OBJECT_DATABASE,
            TARGET_SCHEMA: row.TARGET_OBJECT_SCHEMA,
            TARGET_NAME: row.TARGET_OBJECT_NAME,
            TARGET_DOMAIN: row.TARGET_OBJECT_DOMAIN,
            LINEAGE_TYPE: 'DOWNSTREAM',
            DISTANCE: row.DISTANCE
        }));
        
        res.json({ 
            success: true, 
            data: [...upstream, ...downstream] 
        });
        
    } catch (error) {
        console.error('❌ Get lineage error:', error);
        // Return empty array if lineage not available rather than error
        res.json({ success: true, data: [] });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// BUSINESS GLOSSARY - CHANGE REQUESTS
// ============================================================================

// Generic endpoint to submit any change request
app.post('/api/change-requests', async (req, res) => {
    const { requestType, targetObject, justification, proposedChange, currentValue } = req.body;
    let connection;
    
    if (!requestType || !targetObject || !justification || !proposedChange) {
        return res.status(400).json({
            success: false,
            error: 'Request type, target object, justification, and proposed change required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        // Try to get contacts for assignment (if target is a table)
        let assignedTo = null;
        if (requestType === 'COLUMN_DESCRIPTION' || requestType === 'TAG_ADD' || requestType === 'TAG_REMOVE') {
            const tableName = requestType === 'COLUMN_DESCRIPTION' 
                ? targetObject.substring(0, targetObject.lastIndexOf('.'))
                : targetObject;
            
            try {
                const contactsQuery = `
                    SELECT PURPOSE, METHOD, INHERITED
                    FROM TABLE(SNOWFLAKE.CORE.GET_CONTACTS('${tableName}'))
                `;
                const contacts = await executeQuery(connection, contactsQuery);
                const owner = contacts.find(c => c.PURPOSE === 'OWNER' || c.PURPOSE === 'STEWARD');
                if (owner) {
                    assignedTo = owner.METHOD;
                }
            } catch (err) {
                console.log('No contacts found, leaving unassigned');
            }
        }
        
        // Create change request
        const query = `
            INSERT INTO CHANGE_REQUESTS (
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                CURRENT_VALUE,
                ASSIGNED_TO
            )
            SELECT
                '${requestType}',
                '${targetObject.replace(/'/g, "''")}',
                CURRENT_USER(),
                '${justification.replace(/'/g, "''")}',
                PARSE_JSON('${JSON.stringify(proposedChange).replace(/'/g, "''")}'),
                ${currentValue ? `PARSE_JSON('${JSON.stringify(currentValue).replace(/'/g, "''")}')`  : 'NULL'},
                ${assignedTo ? `'${assignedTo}'` : 'NULL'}
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Change request submitted for approval'
        });
        
    } catch (error) {
        console.error('❌ Submit change request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit change request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get all attribute-related change requests (for glossary manager)
app.get('/api/change-requests/all-attributes', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                REQUEST_ID,
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                STATUS,
                REQUESTED_AT,
                DECISION_COMMENT
            FROM CHANGE_REQUESTS
            WHERE REQUEST_TYPE IN ('ATTRIBUTE_CREATE', 'ATTRIBUTE_EDIT', 'ENUMERATION_ADD', 'ENUMERATION_EDIT')
            ORDER BY 
                CASE STATUS
                    WHEN 'pending' THEN 1
                    WHEN 'more_info_needed' THEN 2
                    WHEN 'approved' THEN 3
                    WHEN 'denied' THEN 4
                END,
                REQUESTED_AT DESC
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows || [] });
        
    } catch (error) {
        console.error('❌ Get attribute change requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch attribute change requests'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get user's own requests
app.get('/api/change-requests/my-requests', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                REQUEST_ID,
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                CURRENT_VALUE,
                STATUS,
                ASSIGNED_TO,
                REQUESTED_AT,
                DECISION_COMMENT,
                DECISION_DATE
            FROM CHANGE_REQUESTS
            WHERE REQUESTER = CURRENT_USER()
            ORDER BY 
                CASE STATUS
                    WHEN 'more_info_needed' THEN 1
                    WHEN 'pending' THEN 2
                    WHEN 'approved' THEN 3
                    WHEN 'denied' THEN 4
                END,
                REQUESTED_AT DESC
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows || [] });
        
    } catch (error) {
        console.error('❌ Get my change requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch your change requests'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Update a returned change request
app.put('/api/change-requests/:id/update', async (req, res) => {
    const { id } = req.params;
    const { justification, proposedChange } = req.body;
    let connection;
    
    if (!justification || !proposedChange) {
        return res.status(400).json({
            success: false,
            error: 'Justification and proposed change are required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            UPDATE CHANGE_REQUESTS
            SET JUSTIFICATION = '${justification.replace(/'/g, "''")}',
                PROPOSED_CHANGE = PARSE_JSON('${JSON.stringify(proposedChange).replace(/'/g, "''")}'),
                STATUS = 'pending',
                DECISION_COMMENT = NULL,
                DECISION_DATE = NULL,
                REQUESTED_AT = CURRENT_TIMESTAMP()
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
              AND REQUESTER = CURRENT_USER()
              AND STATUS = 'more_info_needed'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Change request updated and resubmitted for approval'
        });
        
    } catch (error) {
        console.error('❌ Update change request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update change request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get pending change requests (assigned to current user)
app.get('/api/change-requests/pending', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                REQUEST_ID,
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                CURRENT_VALUE,
                STATUS,
                ASSIGNED_TO,
                REQUESTED_AT
            FROM CHANGE_REQUESTS
            WHERE STATUS IN ('pending', 'pending_info')
            ORDER BY REQUESTED_AT DESC
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows });
        
    } catch (error) {
        console.error('❌ Get change requests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch change requests' });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get change requests for a specific user
app.get('/api/change-requests/my-requests', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                REQUEST_ID,
                REQUEST_TYPE,
                TARGET_OBJECT,
                REQUESTER,
                JUSTIFICATION,
                PROPOSED_CHANGE,
                CURRENT_VALUE,
                STATUS,
                ASSIGNED_TO,
                APPROVER,
                DECISION_DATE,
                DECISION_COMMENT,
                REQUESTED_AT
            FROM CHANGE_REQUESTS
            WHERE REQUESTER = CURRENT_USER()
            ORDER BY REQUESTED_AT DESC
            LIMIT 100
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows });
        
    } catch (error) {
        console.error('❌ Get my requests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch requests' });
    } finally {
        if (connection) connection.destroy();
    }
});

// Approve change request and apply changes
app.put('/api/change-requests/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Check permission
        const hasPermission = await checkPermission(connection, 'APPROVE_GLOSSARY', req);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Your role does not have permission to approve glossary/content changes'
            });
        }
        
        // Get request details
        const getQuery = `
            SELECT REQUEST_TYPE, TARGET_OBJECT, PROPOSED_CHANGE
            FROM CHANGE_REQUESTS
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
              AND STATUS = 'pending'
        `;
        const requests = await executeQuery(connection, getQuery);
        
        if (requests.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found or already processed' });
        }
        
        const request = requests[0];
        const requestType = request.REQUEST_TYPE;
        const targetObject = request.TARGET_OBJECT;
        // PROPOSED_CHANGE may already be parsed as an object by Snowflake driver
        const proposedChange = typeof request.PROPOSED_CHANGE === 'string' 
            ? JSON.parse(request.PROPOSED_CHANGE) 
            : request.PROPOSED_CHANGE;
        
        // Apply the change based on request type
        let applyQuery = '';
        
        if (requestType === 'DESCRIPTION') {
            applyQuery = `
                MERGE INTO TABLE_DESCRIPTIONS t
                USING (SELECT '${targetObject}' as TABLE_FULL_NAME) s
                ON t.TABLE_FULL_NAME = s.TABLE_FULL_NAME
                WHEN MATCHED THEN UPDATE SET 
                    t.USER_DESCRIPTION = '${proposedChange.description.replace(/'/g, "''")}',
                    t.LAST_UPDATED_BY = CURRENT_USER(),
                    t.UPDATED_AT = CURRENT_TIMESTAMP()
                WHEN NOT MATCHED THEN INSERT (TABLE_FULL_NAME, USER_DESCRIPTION, LAST_UPDATED_BY)
                    VALUES (s.TABLE_FULL_NAME, '${proposedChange.description.replace(/'/g, "''")}', CURRENT_USER())
            `;
        } else if (requestType === 'TAG_ADD') {
            applyQuery = `
                INSERT INTO TABLE_TAGS (TABLE_FULL_NAME, TAG_NAME, CREATED_BY)
                VALUES ('${targetObject}', '${proposedChange.tag_name}', CURRENT_USER())
            `;
        } else if (requestType === 'TAG_REMOVE') {
            applyQuery = `
                DELETE FROM TABLE_TAGS 
                WHERE TAG_ID = '${proposedChange.tag_id}'
            `;
        } else if (requestType === 'ENUMERATION_ADD' || requestType === 'ENUMERATION_EDIT') {
            // Handle enumeration changes
            if (proposedChange.action === 'add') {
                applyQuery = `
                    INSERT INTO ATTRIBUTE_ENUMERATIONS (
                        ATTRIBUTE_NAME, VALUE_CODE, VALUE_DESCRIPTION, SORT_ORDER, CREATED_BY
                    )
                    VALUES (
                        '${targetObject}',
                        '${proposedChange.value_code.replace(/'/g, "''")}',
                        '${proposedChange.value_description.replace(/'/g, "''")}',
                        ${proposedChange.sort_order || 999},
                        CURRENT_USER()
                    )
                `;
            } else if (proposedChange.action === 'edit') {
                applyQuery = `
                    UPDATE ATTRIBUTE_ENUMERATIONS
                    SET VALUE_DESCRIPTION = '${proposedChange.value_description.replace(/'/g, "''")}',
                        UPDATED_BY = CURRENT_USER(),
                        UPDATED_AT = CURRENT_TIMESTAMP()
                    WHERE ENUMERATION_ID = '${proposedChange.enumeration_id}'
                `;
            }
        } else if (requestType === 'COLUMN_DESCRIPTION') {
            // Handle column description changes via COMMENT
            // targetObject format: DATABASE.SCHEMA.TABLE.COLUMN
            const parts = targetObject.split('.');
            const columnName = parts[parts.length - 1];
            const tableName = parts.slice(0, -1).join('.');
            
            console.log(`Updating column description: ${tableName}.${columnName}`);
            
            applyQuery = `
                ALTER TABLE ${tableName}
                MODIFY COLUMN ${columnName}
                COMMENT '${proposedChange.description.replace(/'/g, "''")}'
            `;
        } else if (requestType === 'ATTRIBUTE_EDIT') {
            // Update attribute definition
            applyQuery = `
                UPDATE ATTRIBUTE_DEFINITIONS
                SET DESCRIPTION = '${proposedChange.description.replace(/'/g, "''")}'
                WHERE ATTRIBUTE_NAME = '${targetObject}'
            `;
        } else if (requestType === 'ATTRIBUTE_CREATE') {
            // Create new attribute definition
            const attrName = proposedChange.attribute_name;
            applyQuery = `
                INSERT INTO ATTRIBUTE_DEFINITIONS (
                    ATTRIBUTE_NAME, DISPLAY_NAME, DESCRIPTION, CREATED_BY
                )
                VALUES (
                    '${attrName}',
                    '${proposedChange.display_name.replace(/'/g, "''")}',
                    '${proposedChange.description.replace(/'/g, "''")}',
                    CURRENT_USER()
                )
            `;
            
            // Also insert enumerations if provided
            if (proposedChange.enumerations && proposedChange.enumerations.length > 0) {
                for (const enumVal of proposedChange.enumerations) {
                    const enumQuery = `
                        INSERT INTO ATTRIBUTE_ENUMERATIONS (
                            ATTRIBUTE_NAME, VALUE_CODE, VALUE_DESCRIPTION, SORT_ORDER, CREATED_BY
                        )
                        VALUES (
                            '${attrName}',
                            '${enumVal.value_code.replace(/'/g, "''")}',
                            '${enumVal.value_description.replace(/'/g, "''")}',
                            ${enumVal.sort_order},
                            CURRENT_USER()
                        )
                    `;
                    await executeQuery(connection, enumQuery);
                }
            }
        }
        
        // Execute the change
        if (applyQuery) {
            await executeQuery(connection, applyQuery);
        }
        
        // Update request status
        const updateQuery = `
            UPDATE CHANGE_REQUESTS
            SET STATUS = 'approved',
                APPROVER = CURRENT_USER(),
                DECISION_DATE = CURRENT_TIMESTAMP(),
                DECISION_COMMENT = '${comment ? comment.replace(/'/g, "''") : ''}'
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
        `;
        
        await executeQuery(connection, updateQuery);
        res.json({ 
            success: true,
            message: 'Change request approved and applied'
        });
        
    } catch (error) {
        console.error('❌ Approve change request error:', error);
        console.error('Error details:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to approve change request: ' + error.message
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Deny change request
app.put('/api/change-requests/:id/deny', async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            UPDATE CHANGE_REQUESTS
            SET STATUS = 'denied',
                APPROVER = CURRENT_USER(),
                DECISION_DATE = CURRENT_TIMESTAMP(),
                DECISION_COMMENT = '${comment ? comment.replace(/'/g, "''") : ''}'
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Change request denied'
        });
        
    } catch (error) {
        console.error('❌ Deny change request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deny change request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// Return change request for more information
app.put('/api/change-requests/:id/return', async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    let connection;
    
    if (!comment || !comment.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Comment explaining what additional information is needed is required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            UPDATE CHANGE_REQUESTS
            SET STATUS = 'more_info_needed',
                APPROVER = CURRENT_USER(),
                DECISION_DATE = CURRENT_TIMESTAMP(),
                DECISION_COMMENT = '${comment.replace(/'/g, "''")}'
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
        `;
        
        await executeQuery(connection, query);
        res.json({ 
            success: true,
            message: 'Change request returned for additional information'
        });
        
    } catch (error) {
        console.error('❌ Return change request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to return change request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// BUSINESS GLOSSARY - ATTRIBUTES
// ============================================================================

// Get all attributes
app.get('/api/attributes', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                a.ATTRIBUTE_NAME,
                a.DISPLAY_NAME,
                a.DESCRIPTION,
                a.CREATED_BY,
                a.CREATED_AT,
                COUNT(DISTINCT l.LINK_ID) as USAGE_COUNT
            FROM ATTRIBUTE_DEFINITIONS a
            LEFT JOIN COLUMN_ATTRIBUTES l ON a.ATTRIBUTE_NAME = l.ATTRIBUTE_NAME
            GROUP BY a.ATTRIBUTE_NAME, a.DISPLAY_NAME, a.DESCRIPTION, a.CREATED_BY, a.CREATED_AT
            ORDER BY a.DISPLAY_NAME
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows });
        
    } catch (error) {
        console.error('❌ Get attributes error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch attributes' });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get enumerations for an attribute
app.get('/api/attributes/:name/enumerations', async (req, res) => {
    const { name } = req.params;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                ENUMERATION_ID,
                VALUE_CODE,
                VALUE_DESCRIPTION,
                SORT_ORDER,
                IS_ACTIVE
            FROM ATTRIBUTE_ENUMERATIONS
            WHERE ATTRIBUTE_NAME = '${sanitizeInput(name)}'
              AND IS_ACTIVE = TRUE
            ORDER BY SORT_ORDER, VALUE_CODE
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows });
        
    } catch (error) {
        console.error('❌ Get enumerations error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch enumerations' });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get glossary attributes for all tables (for client-side display in catalog browser)
app.get('/api/glossary-bulk', async (req, res) => {
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                l.TABLE_FULL_NAME,
                l.ATTRIBUTE_NAME,
                a.DISPLAY_NAME,
                a.DESCRIPTION
            FROM COLUMN_ATTRIBUTES l
            JOIN ATTRIBUTE_DEFINITIONS a ON l.ATTRIBUTE_NAME = a.ATTRIBUTE_NAME
            ORDER BY l.TABLE_FULL_NAME, l.ATTRIBUTE_NAME
        `;
        
        const rows = await executeQuery(connection, query);
        
        // Transform into a map: { "DB.SCHEMA.TABLE": [{ATTRIBUTE_NAME: "PII", DISPLAY_NAME: "PII Data"}, ...] }
        const tableGlossaryMap = (rows || []).reduce((acc, row) => {
            if (!acc[row.TABLE_FULL_NAME]) {
                acc[row.TABLE_FULL_NAME] = [];
            }
            // Only add if not already present (deduplicate)
            const existing = acc[row.TABLE_FULL_NAME].find(g => g.ATTRIBUTE_NAME === row.ATTRIBUTE_NAME);
            if (!existing) {
                acc[row.TABLE_FULL_NAME].push({
                    ATTRIBUTE_NAME: row.ATTRIBUTE_NAME,
                    DISPLAY_NAME: row.DISPLAY_NAME || row.ATTRIBUTE_NAME,
                    DESCRIPTION: row.DESCRIPTION
                });
            }
            return acc;
        }, {});
        
        res.json({ success: true, data: tableGlossaryMap });
        
    } catch (error) {
        console.error('❌ Get bulk glossary error:', error.message);
        res.json({ success: true, data: {} });
    } finally {
        if (connection) connection.destroy();
    }
});

// Get column attribute linkages for a table
app.get('/api/columns/:database/:schema/:table/attributes', async (req, res) => {
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    let connection;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT 
                l.LINK_ID,
                l.COLUMN_NAME,
                l.ATTRIBUTE_NAME,
                a.DISPLAY_NAME,
                a.DESCRIPTION,
                l.LINKED_BY,
                l.LINKED_AT
            FROM COLUMN_ATTRIBUTES l
            JOIN ATTRIBUTE_DEFINITIONS a ON l.ATTRIBUTE_NAME = a.ATTRIBUTE_NAME
            WHERE l.TABLE_FULL_NAME = '${sanitizeInput(fullTableName)}'
            ORDER BY l.COLUMN_NAME
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows });
        
    } catch (error) {
        console.error('❌ Get column attributes error:', error);
        res.json({ success: true, data: [] });
    } finally {
        if (connection) connection.destroy();
    }
});

// Link a column to an attribute
app.post('/api/columns/link-attribute', async (req, res) => {
    const { tableFullName, columnName, attributeName } = req.body;
    let connection;
    
    if (!tableFullName || !columnName || !attributeName) {
        return res.status(400).json({
            success: false,
            error: 'Table name, column name, and attribute name required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            INSERT INTO COLUMN_ATTRIBUTES (TABLE_FULL_NAME, COLUMN_NAME, ATTRIBUTE_NAME, LINKED_BY)
            SELECT 
                '${sanitizeInput(tableFullName)}',
                '${sanitizeInput(columnName)}',
                '${sanitizeInput(attributeName)}',
                CURRENT_USER()
            WHERE NOT EXISTS (
                SELECT 1 FROM COLUMN_ATTRIBUTES
                WHERE TABLE_FULL_NAME = '${sanitizeInput(tableFullName)}'
                  AND COLUMN_NAME = '${sanitizeInput(columnName)}'
                  AND ATTRIBUTE_NAME = '${sanitizeInput(attributeName)}'
            )
        `;
        
        await executeQuery(connection, query);
        res.json({ success: true, message: 'Column linked to attribute' });
        
    } catch (error) {
        console.error('❌ Link column attribute error:', error);
        res.status(500).json({ success: false, error: 'Failed to link attribute' });
    } finally {
        if (connection) connection.destroy();
    }
});

// Unlink a column from an attribute
app.post('/api/columns/unlink-attribute', async (req, res) => {
    const { tableFullName, columnName, attributeName } = req.body;
    let connection;
    
    if (!tableFullName || !columnName || !attributeName) {
        return res.status(400).json({
            success: false,
            error: 'Table name, column name, and attribute name required'
        });
    }
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            DELETE FROM COLUMN_ATTRIBUTES
            WHERE TABLE_FULL_NAME = '${sanitizeInput(tableFullName)}'
              AND COLUMN_NAME = '${sanitizeInput(columnName)}'
              AND ATTRIBUTE_NAME = '${sanitizeInput(attributeName)}'
        `;
        
        await executeQuery(connection, query);
        res.json({ success: true, message: 'Column unlinked from attribute' });
        
    } catch (error) {
        console.error('❌ Unlink column attribute error:', error);
        res.status(500).json({ success: false, error: 'Failed to unlink attribute' });
    } finally {
        if (connection) connection.destroy();
    }
});

// ============================================================================
// ACCESS REQUEST APPROVAL WORKFLOW
// ============================================================================

// Get contacts for a database object
app.get('/api/contacts/:database/:schema/:table', async (req, res) => {
    let connection;
    const { database, schema, table } = req.params;
    const fullTableName = `${database}.${schema}.${table}`;
    
    try {
        connection = await connectToSnowflake(req);
        
        const query = `
            SELECT *
            FROM TABLE(SNOWFLAKE.CORE.GET_CONTACTS('${sanitizeInput(fullTableName)}', 'TABLE'))
        `;
        
        const rows = await executeQuery(connection, query);
        res.json({ success: true, data: rows });
        
    } catch (error) {
        console.error('❌ Get contacts error:', error);
        res.json({ success: true, data: [] }); // Return empty array if no contacts or error
    } finally {
        if (connection) connection.destroy();
    }
});

// Approve access request and grant role access
app.put('/api/access-requests/:id/approve-with-grant', async (req, res) => {
    let connection;
    const { id } = req.params;
    const { approver, comment, accessType, grantToName } = req.body;
    
    try {
        connection = await connectToSnowflake(req);
        
        // Check permission
        const hasPermission = await checkPermission(connection, 'APPROVE_DATA_ACCESS', req);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Your role does not have permission to approve data access requests'
            });
        }
        
        // Get request details
        const getRequestQuery = `
            SELECT REQUESTER, TABLE_FULL_NAME 
            FROM ACCESS_REQUESTS 
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
        `;
        const requestRows = await executeQuery(connection, getRequestQuery);
        
        if (!requestRows || requestRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        const { REQUESTER, TABLE_FULL_NAME } = requestRows[0];
        const [database, schema, table] = TABLE_FULL_NAME.split('.');
        
        // Update request status
        const updateQuery = `
            UPDATE ACCESS_REQUESTS 
            SET STATUS = 'approved',
                APPROVER = '${sanitizeInput(approver)}',
                DECISION_DATE = CURRENT_TIMESTAMP(),
                DECISION_COMMENT = '${sanitizeInput(comment || 'Approved with READ access granted')}'
            WHERE REQUEST_ID = '${sanitizeInput(id)}'
        `;
        await executeQuery(connection, updateQuery);
        
        // Grant SELECT privilege on the table to either ROLE or USER
        try {
            let grantQuery;
            if (accessType === 'USER') {
                grantQuery = `
                    GRANT SELECT ON TABLE ${database}.${schema}.${table} 
                    TO USER ${sanitizeInput(grantToName)}
                `;
            } else {
                grantQuery = `
                    GRANT SELECT ON TABLE ${database}.${schema}.${table} 
                    TO ROLE ${sanitizeInput(grantToName)}
                `;
            }
            await executeQuery(connection, grantQuery);
            
            res.json({ 
                success: true, 
                message: `Request approved and READ access granted to ${accessType.toLowerCase()} ${grantToName}`,
                grantDetails: {
                    table: TABLE_FULL_NAME,
                    grantType: accessType,
                    grantTo: grantToName,
                    privilege: 'SELECT'
                }
            });
        } catch (grantError) {
            // Request was approved but grant failed
            res.json({
                success: true,
                warning: 'Request approved but grant failed. You may need higher privileges.',
                error: grantError.message,
                grantDetails: {
                    table: TABLE_FULL_NAME,
                    grantType: accessType,
                    grantTo: grantToName,
                    privilege: 'SELECT'
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Approve with grant error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to approve request'
        });
    } finally {
        if (connection) connection.destroy();
    }
});

// React routing - must be last to catch all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running in SPCS container on port ${PORT}`);
    console.log('📊 App available via SPCS service endpoint');
});