---
name: spcs-callers-rights
description: "Implement caller's rights for SPCS services. Use when: enabling user-context SQL execution, configuring executeAsCaller, passing user tokens, building multi-tenant SPCS apps. Triggers: caller's rights, callers rights, executeAsCaller, user context, ingress user token, Sf-Context-Current-User-Token."
---

# SPCS Caller's Rights Implementation

Enables SPCS services to execute SQL as the calling user (not the service owner), essential for multi-tenant apps where users should only see their authorized data.

## When to Use

- Dashboard apps where users should only see their own data
- Multi-tenant services with user-specific permissions
- Any SPCS app needing to respect end-user Snowflake roles/grants

## Key Concepts

| Term | Description |
|------|-------------|
| Service User | Default identity; runs as service owner role |
| Caller's Rights | Execute SQL as the ingress user instead |
| `executeAsCaller` | Spec setting that enables caller context |
| User Token | Header `Sf-Context-Current-User-Token` injected by Snowflake |

## Workflow

### Step 1: Update Service Specification

Add `executeAsCaller: true` to the spec YAML:

```yaml
spec:
  containers:
    - name: app
      image: /db/schema/repo/image:latest
      # ... other config ...
  capabilities:
    securityContext:
      executeAsCaller: true
```

**Location**: This goes at the spec level, not inside containers.

### Step 2: Update Connection Code

Modify the Snowflake connection logic to use the combined token:

**Python (Flask/FastAPI pattern):**

```python
import os
import snowflake.connector

SNOWFLAKE_ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT")
SNOWFLAKE_HOST = os.getenv("SNOWFLAKE_HOST")

def get_service_token():
    """Read the service OAuth token provided by Snowflake."""
    with open("/snowflake/session/token", "r") as f:
        return f.read()

def get_snowflake_connection(request):
    """
    Create connection as caller (if token present) or service user.
    
    Args:
        request: HTTP request object with headers
    Returns:
        snowflake.connector.Connection
    """
    ingress_user_token = request.headers.get("Sf-Context-Current-User-Token")
    
    if ingress_user_token:
        # Caller's rights: combine service token + user token
        token = get_service_token() + "." + ingress_user_token
    else:
        # Fallback to service user
        token = get_service_token()
    
    return snowflake.connector.connect(
        account=SNOWFLAKE_ACCOUNT,
        host=SNOWFLAKE_HOST,
        authenticator="oauth",
        token=token
    )
```

**Node.js (Express pattern):**

```javascript
const snowflake = require('snowflake-sdk');
const fs = require('fs');

function getServiceToken() {
  return fs.readFileSync('/snowflake/session/token', 'utf8');
}

function getSnowflakeConnection(req) {
  const userToken = req.headers['sf-context-current-user-token'];
  const serviceToken = getServiceToken();
  
  const token = userToken 
    ? `${serviceToken}.${userToken}`  // Caller's rights
    : serviceToken;                    // Service user
  
  return snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    host: process.env.SNOWFLAKE_HOST,
    authenticator: 'OAUTH',
    token: token
  });
}
```

### Step 3: Grant Service Role to Users

Users need the service role to access the endpoint:

```sql
-- Create service role (if not exists)
GRANT SERVICE ROLE <db>.<schema>.<service>!app TO ROLE <user_role>;

-- Or grant to specific users
GRANT SERVICE ROLE <db>.<schema>.<service>!app TO USER <username>;
```

### Step 4: Redeploy Service

```sql
ALTER SERVICE <service_name> FROM SPECIFICATION $$
<updated_spec_with_executeAsCaller>
$$;
```

Or recreate if using `CREATE SERVICE`:

```sql
DROP SERVICE IF EXISTS <service_name>;
CREATE SERVICE <service_name>
  IN COMPUTE POOL <pool>
  FROM SPECIFICATION $$
  <spec>
  $$;
```

## Validation Checklist

After implementation, verify:

- [ ] `executeAsCaller: true` is in spec under `capabilities.securityContext`
- [ ] Connection code checks for `Sf-Context-Current-User-Token` header
- [ ] Token concatenation uses format: `<service_token>.<user_token>`
- [ ] Service role is granted to test users
- [ ] Query results respect caller's permissions (test with limited user)

## Limitations

- **Ingress only**: Caller's rights only work via network ingress (public endpoints), not service functions
- **Not for Native Apps**: Currently unsupported in Snowflake Native Apps with containers
- **Session isolation**: Each connection creates a new session (not shared with caller's original session)
- **Account enablement required**: The `capabilities.securityContext.executeAsCaller` spec option may not be available on all accounts. Contact Snowflake support to enable it if you get "unknown option 'capabilities' for 'spec'" error.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| User token is `None` | `executeAsCaller` not set | Add to spec and redeploy |
| Permission denied | User lacks service role | Grant service role to user |
| Wrong data returned | Using service token only | Check header extraction logic |
| Token invalid | Malformed concatenation | Ensure format is `token.usertoken` with single dot |

## Output

Service executes SQL with caller's Snowflake identity, respecting their roles and grants.
