import React, { useState } from 'react';
import './App.css';
import CatalogBrowser from './components/CatalogBrowser';
import ApprovalWorkflow from './components/ApprovalWorkflow';
import ContentChangeApproval from './components/ContentChangeApproval';
import AttributeManager from './components/AttributeManager';
import MyChangeRequests from './components/MyChangeRequests';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider, useTheme } from './ThemeContext';

function AppContent() {
  const [currentView, setCurrentView] = useState<'catalog' | 'data-approvals' | 'content-approvals' | 'glossary' | 'my-requests'>('catalog');
  const { theme, toggleTheme, colors } = useTheme();

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
            marginRight: 'auto'
          }}>
            Data Catalog
          </h1>
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
          {currentView === 'content-approvals' && <ContentChangeApproval />}
          {currentView === 'data-approvals' && <ApprovalWorkflow />}
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

