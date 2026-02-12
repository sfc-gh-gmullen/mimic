import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import MessageModal from './MessageModal';
import ConfirmModal from './ConfirmModal';

interface RolePermission {
  PERMISSION_ID: string;
  SNOWFLAKE_ROLE: string;
  PERMISSION_TYPE: string;
  GRANTED_BY: string;
  GRANTED_AT: string;
}

interface SnowflakeRole {
  name: string;
  owner: string;
  assignedToUsers: number;
}

type PermissionType = 'APP_ACCESS' | 'CREATE_REQUESTS' | 'APPROVE_GLOSSARY' | 'APPROVE_DATA_ACCESS' | 'MANAGE_ROLES';

const PERMISSION_TYPES: { type: PermissionType; label: string; description: string }[] = [
  { type: 'APP_ACCESS', label: 'App Access', description: 'Roles that can access the Data Catalog application' },
  { type: 'CREATE_REQUESTS', label: 'Create Requests', description: 'Roles that can submit new data access and change requests' },
  { type: 'APPROVE_GLOSSARY', label: 'Glossary Approval', description: 'Roles that can approve glossary and content change requests' },
  { type: 'APPROVE_DATA_ACCESS', label: 'Data Access Approval', description: 'Roles that can approve data access requests' },
  { type: 'MANAGE_ROLES', label: 'Manage Roles', description: 'Roles that can administer role permissions (this page)' },
];

const RoleAdmin: React.FC = () => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<PermissionType>('APP_ACCESS');
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [snowflakeRoles, setSnowflakeRoles] = useState<SnowflakeRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchPermissions();
    fetchSnowflakeRoles();
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/role-permissions');
      const result = await response.json();
      if (result.success) {
        setPermissions(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSnowflakeRoles = async () => {
    try {
      const response = await fetch('/api/snowflake-roles');
      const result = await response.json();
      if (result.success) {
        setSnowflakeRoles(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch Snowflake roles:', err);
    }
  };

  const showMessage = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setModalState({ isOpen: true, title, message, type });
  };

  const handleAddPermission = async () => {
    if (!selectedRole) {
      showMessage('Error', 'Please select a role', 'error');
      return;
    }

    try {
      const response = await fetch('/api/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snowflakeRole: selectedRole,
          permissionType: activeTab
        })
      });
      const result = await response.json();
      
      if (result.success) {
        showMessage('Success', result.message, 'success');
        setSelectedRole('');
        fetchPermissions();
      } else {
        showMessage('Error', result.error || 'Failed to add permission', 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to add permission', 'error');
    }
  };

  const handleRemovePermission = async (snowflakeRole: string, permissionType: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Remove Permission',
      message: `Remove ${permissionType} permission from ${snowflakeRole}?`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch(`/api/role-permissions/${encodeURIComponent(snowflakeRole)}/${encodeURIComponent(permissionType)}`, {
            method: 'DELETE'
          });
          const result = await response.json();
          
          if (result.success) {
            showMessage('Success', result.message, 'success');
            fetchPermissions();
          } else {
            showMessage('Error', result.error || 'Failed to remove permission', 'error');
          }
        } catch (err) {
          showMessage('Error', 'Failed to remove permission', 'error');
        }
      }
    });
  };

  const handleGrantServiceAccess = async (snowflakeRole: string) => {
    try {
      const response = await fetch('/api/grant-service-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snowflakeRole })
      });
      const result = await response.json();
      
      if (result.success) {
        let message = result.message;
        if (result.grants) {
          message += `\n\nGranted: ${result.grants.join(', ')}`;
        }
        if (result.warnings && result.warnings.length > 0) {
          message += `\n\nWarnings:\n${result.warnings.join('\n')}`;
        }
        showMessage('Success', message, 'success');
      } else {
        let errorMsg = result.error || 'Failed to grant service access';
        if (result.details) {
          errorMsg += `\n\nDetails:\n${result.details.join('\n')}`;
        }
        showMessage('Error', errorMsg, 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to grant service access', 'error');
    }
  };

  const handleRevokeServiceAccess = async (snowflakeRole: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Revoke Service Access',
      message: `Revoke Snowflake service access from ${snowflakeRole}? This will prevent users with this role from accessing the app.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch('/api/revoke-service-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ snowflakeRole })
          });
          const result = await response.json();
          
          if (result.success) {
            showMessage('Success', result.message, 'success');
          } else {
            showMessage('Error', result.error || 'Failed to revoke service access', 'error');
          }
        } catch (err) {
          showMessage('Error', 'Failed to revoke service access', 'error');
        }
      }
    });
  };

  const filteredPermissions = permissions.filter(p => p.PERMISSION_TYPE === activeTab);
  const assignedRoles = filteredPermissions.map(p => p.SNOWFLAKE_ROLE);
  const availableRoles = snowflakeRoles.filter(r => !assignedRoles.includes(r.name));
  const currentPermissionInfo = PERMISSION_TYPES.find(p => p.type === activeTab);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>
        Loading role permissions...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <MessageModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: colors.text }}>
          Role Permission Administration
        </h2>
        <p style={{ margin: 0, color: colors.textSecondary }}>
          Map existing Snowflake roles to application permissions
        </p>
      </div>

      {/* Permission Type Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        {PERMISSION_TYPES.map(pt => (
          <button
            key={pt.type}
            onClick={() => setActiveTab(pt.type)}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === pt.type ? colors.primary : colors.surface,
              color: activeTab === pt.type ? 'white' : colors.text,
              border: `1px solid ${activeTab === pt.type ? colors.primary : colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: activeTab === pt.type ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {/* Current Permission Info */}
      <div style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 8px 0', color: colors.text }}>
          {currentPermissionInfo?.label}
        </h3>
        <p style={{ margin: '0 0 20px 0', color: colors.textSecondary }}>
          {currentPermissionInfo?.description}
        </p>

        {/* Assigned Roles Table */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: colors.text }}>
            Roles with this Permission ({filteredPermissions.length})
          </h4>
          
          {filteredPermissions.length === 0 ? (
            <div style={{
              padding: '20px',
              backgroundColor: colors.background,
              borderRadius: '8px',
              textAlign: 'center',
              color: colors.textSecondary
            }}>
              No roles assigned to this permission yet
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: colors.background,
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <thead>
                <tr style={{ backgroundColor: colors.border }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.text, fontWeight: '600' }}>
                    Snowflake Role
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.text, fontWeight: '600' }}>
                    Granted By
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.text, fontWeight: '600' }}>
                    Granted At
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: colors.text, fontWeight: '600' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map(perm => (
                  <tr key={perm.PERMISSION_ID} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '12px 16px', color: colors.text, fontWeight: '500' }}>
                      {perm.SNOWFLAKE_ROLE}
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.textSecondary }}>
                      {perm.GRANTED_BY}
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.textSecondary }}>
                      {new Date(perm.GRANTED_AT).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {activeTab === 'APP_ACCESS' && (
                          <>
                            <button
                              onClick={() => handleGrantServiceAccess(perm.SNOWFLAKE_ROLE)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: colors.success,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85em'
                              }}
                            >
                              Grant SF Access
                            </button>
                            <button
                              onClick={() => handleRevokeServiceAccess(perm.SNOWFLAKE_ROLE)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: colors.warning,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85em'
                              }}
                            >
                              Revoke SF Access
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleRemovePermission(perm.SNOWFLAKE_ROLE, perm.PERMISSION_TYPE)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: colors.error,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85em'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add Role Section */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: colors.background,
          borderRadius: '8px'
        }}>
          <label style={{ color: colors.text, fontWeight: '500', whiteSpace: 'nowrap' }}>
            Add Role:
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              backgroundColor: colors.inputBg,
              color: colors.text,
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: '6px',
              fontSize: '0.95em'
            }}
          >
            <option value="">Select a Snowflake role...</option>
            {availableRoles.map(role => (
              <option key={role.name} value={role.name}>
                {role.name} {role.assignedToUsers > 0 ? `(${role.assignedToUsers} users)` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddPermission}
            disabled={!selectedRole}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedRole ? colors.primary : colors.border,
              color: selectedRole ? 'white' : colors.textSecondary,
              border: 'none',
              borderRadius: '6px',
              cursor: selectedRole ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            + Add Permission
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <div style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: colors.text }}>
          Permission Summary
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {PERMISSION_TYPES.map(pt => {
            const count = permissions.filter(p => p.PERMISSION_TYPE === pt.type).length;
            return (
              <div
                key={pt.type}
                style={{
                  padding: '16px',
                  backgroundColor: colors.background,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`
                }}
              >
                <div style={{ fontSize: '0.85em', color: colors.textSecondary, marginBottom: '4px' }}>
                  {pt.label}
                </div>
                <div style={{ fontSize: '1.5em', fontWeight: '600', color: colors.text }}>
                  {count} {count === 1 ? 'role' : 'roles'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoleAdmin;
