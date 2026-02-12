import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import CatalogBrowser from './components/CatalogBrowser';
import ApprovalWorkflow from './components/ApprovalWorkflow';
import ContentChangeApproval from './components/ContentChangeApproval';
import AttributeManager from './components/AttributeManager';
import MyChangeRequests from './components/MyChangeRequests';
import RoleAdmin from './components/RoleAdmin';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider, useTheme } from './ThemeContext';

interface UserContext {
  username: string;
  role: string;
}

interface UserPermissions {
  hasAppAccess: boolean;
  canCreateRequests: boolean;
  canApproveGlossary: boolean;
  canApproveDataAccess: boolean;
  canManageRoles: boolean;
}

function AppContent() {
  const [currentView, setCurrentView] = useState<'catalog' | 'data-approvals' | 'content-approvals' | 'glossary' | 'my-requests' | 'role-admin'>('catalog');
  const { theme, toggleTheme, colors, isDarkMode } = useTheme();
  const [userContext, setUserContext] = useState<UserContext>({ username: '', role: '' });
  const [permissions, setPermissions] = useState<UserPermissions>({
    hasAppAccess: false,
    canCreateRequests: false,
    canApproveGlossary: false,
    canApproveDataAccess: false,
    canManageRoles: false
  });
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUserContext();
    fetchPermissions();
    fetchAvailableRoles();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUserContext = async () => {
    try {
      const response = await fetch('/api/current-user-context');
      const result = await response.json();
      if (result.success) {
        setUserContext({ username: result.username, role: result.role });
      }
    } catch (err) {
      console.error('Failed to fetch user context:', err);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/my-permissions');
      const result = await response.json();
      if (result.success) {
        setPermissions({
          hasAppAccess: result.hasAppAccess,
          canCreateRequests: result.canCreateRequests,
          canApproveGlossary: result.canApproveGlossary,
          canApproveDataAccess: result.canApproveDataAccess,
          canManageRoles: result.canManageRoles
        });
      }
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const response = await fetch('/api/my-roles');
      const result = await response.json();
      if (result.success) {
        setAvailableRoles(result.roles || []);
        // If we have a default role and it's different from current, switch to it
        if (result.defaultRole && result.roles.includes(result.defaultRole)) {
          // Set the default role as the initial role if not already set
          if (result.defaultRole !== result.currentRole) {
            // Automatically switch to default role on initial load
            handleRoleChange(result.defaultRole);
          } else {
            setUserContext(prev => ({ ...prev, role: result.defaultRole }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch available roles:', err);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (newRole === userContext.role || roleChanging) return;
    
    setRoleChanging(true);
    try {
      const response = await fetch('/api/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const result = await response.json();
      if (result.success) {
        setUserContext(prev => ({ ...prev, role: result.role }));
        // Refresh permissions with new role
        fetchPermissions();
      }
    } catch (err) {
      console.error('Failed to change role:', err);
    } finally {
      setRoleChanging(false);
      setShowRoleDropdown(false);
    }
  };

  return (
    <div className="App" style={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Navigation Bar */}
      <div style={{ 
        backgroundColor: colors.primary,
        padding: '12px 20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ 
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <h1 style={{ 
            margin: 0,
            color: 'white',
            fontSize: '1.5em',
            marginRight: '20px'
          }}>
            Data Catalog
          </h1>
          {/* User Context Display with Role Selector */}
          {userContext.username && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginRight: 'auto',
              padding: '8px 14px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              fontSize: '0.9em',
              color: 'white'
            }}>
              <span title="Current User">👤 {userContext.username}</span>
              <span style={{ opacity: 0.5 }}>|</span>
              {/* Role Selector Dropdown */}
              <div ref={roleDropdownRef} style={{ position: 'relative' }}>
                <div
                  onClick={() => availableRoles.length > 1 && !roleChanging && setShowRoleDropdown(!showRoleDropdown)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '0.95em',
                    cursor: availableRoles.length > 1 ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '140px',
                    justifyContent: 'space-between',
                    opacity: roleChanging ? 0.7 : 1
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🎭 {roleChanging ? 'Changing...' : userContext.role}
                  </span>
                  {availableRoles.length > 1 && (
                    <span style={{ fontSize: '0.75em' }}>
                      {showRoleDropdown ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                {showRoleDropdown && availableRoles.length > 1 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    marginTop: '4px',
                    backgroundColor: colors.cardBg,
                    border: '2px solid #29B5E8',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    minWidth: '200px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 2000
                  }}>
                    {availableRoles.map(role => (
                      <div
                        key={role}
                        onClick={() => handleRoleChange(role)}
                        style={{
                          padding: '12px 14px',
                          cursor: 'pointer',
                          color: colors.text,
                          backgroundColor: role === userContext.role ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg,
                          fontWeight: role === userContext.role ? '600' : '400',
                          borderBottom: `1px solid ${colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseOver={(e) => {
                          if (role !== userContext.role) {
                            e.currentTarget.style.backgroundColor = colors.surface;
                          }
                        }}
                        onMouseOut={(e) => {
                          if (role !== userContext.role) {
                            e.currentTarget.style.backgroundColor = colors.cardBg;
                          }
                        }}
                      >
                        {role === userContext.role && <span style={{ color: '#29B5E8' }}>✓</span>}
                        <span>{role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => setCurrentView('catalog')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'catalog' ? 'white' : 'transparent',
              color: currentView === 'catalog' ? colors.primary : 'white',
              border: '2px solid white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9em',
              transition: 'all 0.2s'
            }}
          >
            Catalog
          </button>
          <button
            onClick={() => setCurrentView('glossary')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'glossary' ? 'white' : 'transparent',
              color: currentView === 'glossary' ? colors.primary : 'white',
              border: '2px solid white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9em',
              transition: 'all 0.2s'
            }}
          >
            Glossary
          </button>
          <button
            onClick={() => setCurrentView('content-approvals')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'content-approvals' ? 'white' : 'transparent',
              color: currentView === 'content-approvals' ? colors.primary : 'white',
              border: '2px solid white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9em',
              transition: 'all 0.2s'
            }}
          >
            Content Changes
          </button>
          <button
            onClick={() => setCurrentView('my-requests')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'my-requests' ? 'white' : 'transparent',
              color: currentView === 'my-requests' ? colors.primary : 'white',
              border: '2px solid white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9em',
              transition: 'all 0.2s'
            }}
          >
            My Requests
          </button>
          <button
            onClick={() => setCurrentView('data-approvals')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'data-approvals' ? 'white' : 'transparent',
              color: currentView === 'data-approvals' ? colors.primary : 'white',
              border: '2px solid white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9em',
              transition: 'all 0.2s'
            }}
          >
            Data Access
          </button>
          {/* Role Admin - only visible if user has MANAGE_ROLES permission */}
          {permissions.canManageRoles && (
            <button
              onClick={() => setCurrentView('role-admin')}
              style={{
                padding: '8px 16px',
                backgroundColor: currentView === 'role-admin' ? 'white' : 'transparent',
                color: currentView === 'role-admin' ? colors.primary : 'white',
                border: '2px solid white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9em',
                transition: 'all 0.2s'
              }}
            >
              Role Admin
            </button>
          )}
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: 'white',
              border: '2px solid white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1.1em',
              transition: 'all 0.2s',
              marginLeft: '8px'
            }}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      <div className="container" style={{ backgroundColor: colors.background }}>
        <ErrorBoundary>
          {currentView === 'catalog' && <CatalogBrowser />}
          {currentView === 'glossary' && <AttributeManager />}
          {currentView === 'my-requests' && <MyChangeRequests />}
          {currentView === 'content-approvals' && <ContentChangeApproval canApprove={permissions.canApproveGlossary} />}
          {currentView === 'data-approvals' && <ApprovalWorkflow canApprove={permissions.canApproveDataAccess} />}
          {currentView === 'role-admin' && permissions.canManageRoles && <RoleAdmin />}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

