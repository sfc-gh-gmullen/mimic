import React, { useState } from 'react';
import MessageModal from './MessageModal';

interface AccessRequestModalProps {
  tableName: string;
  onClose: () => void;
}

const AccessRequestModal: React.FC<AccessRequestModalProps> = ({ tableName, onClose }) => {
  const [justification, setJustification] = useState('');
  const [accessStartDate, setAccessStartDate] = useState('');
  const [accessEndDate, setAccessEndDate] = useState('');
  const [accessType, setAccessType] = useState<'ROLE' | 'USER'>('ROLE');
  const [grantToName, setGrantToName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  const handleSubmit = async () => {
    if (!justification.trim() || !accessStartDate || !accessEndDate || !grantToName.trim()) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        type: 'error'
      });
      return;
    }

    // Validate dates
    const start = new Date(accessStartDate);
    const end = new Date(accessEndDate);
    if (end <= start) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'End date must be after start date',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          table: tableName, 
          justification: justification,
          accessStartDate,
          accessEndDate,
          accessType,
          grantToName
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSubmitted(true);
      } else {
        setModalState({
          isOpen: true,
          title: 'Submission Failed',
          message: result.error || 'Failed to submit request',
          type: 'error'
        });
      }
    } catch (err) {
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to submit request. Please try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      >
        <div 
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            padding: '2px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '18px',
            padding: '32px'
          }}>
            {!submitted ? (
              <>
                <h2 style={{ 
                  marginTop: 0, 
                  color: '#667eea',
                  fontSize: '1.75em',
                  marginBottom: '8px'
                }}>
                  🔐 Request Access
                </h2>
                <p style={{ 
                  color: '#6c757d', 
                  fontSize: '0.95em',
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '2px solid #f0f0f0'
                }}>
                  Request access to: <strong style={{ color: '#667eea' }}>{tableName}</strong>
                </p>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    fontSize: '0.9em',
                    color: '#495057'
                  }}>
                    Justification *
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Please explain why you need access to this data..."
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '12px',
                      border: '2px solid #e9ecef',
                      borderRadius: '12px',
                      fontSize: '0.9em',
                      resize: 'vertical',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    disabled={loading}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                  />
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '16px', 
                  marginBottom: '20px' 
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      fontWeight: '600',
                      fontSize: '0.9em',
                      color: '#495057'
                    }}>
                      📅 Start Date *
                    </label>
                    <input
                      type="date"
                      value={accessStartDate}
                      onChange={(e) => setAccessStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e9ecef',
                        borderRadius: '12px',
                        fontSize: '0.9em',
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      disabled={loading}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      fontWeight: '600',
                      fontSize: '0.9em',
                      color: '#495057'
                    }}>
                      📅 End Date *
                    </label>
                    <input
                      type="date"
                      value={accessEndDate}
                      onChange={(e) => setAccessEndDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e9ecef',
                        borderRadius: '12px',
                        fontSize: '0.9em',
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      disabled={loading}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    fontSize: '0.9em',
                    color: '#495057'
                  }}>
                    Access Type *
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setAccessType('ROLE')}
                      style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: accessType === 'ROLE' ? '#667eea' : 'white',
                        color: accessType === 'ROLE' ? 'white' : '#667eea',
                        border: '2px solid #667eea',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9em',
                        transition: 'all 0.2s'
                      }}
                      disabled={loading}
                    >
                      👥 Group/Role Access
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccessType('USER')}
                      style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: accessType === 'USER' ? '#667eea' : 'white',
                        color: accessType === 'USER' ? 'white' : '#667eea',
                        border: '2px solid #667eea',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9em',
                        transition: 'all 0.2s'
                      }}
                      disabled={loading}
                    >
                      👤 Individual Access
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    fontSize: '0.9em',
                    color: '#495057'
                  }}>
                    {accessType === 'ROLE' ? '👥 Role Name *' : '👤 Username *'}
                  </label>
                  <input
                    type="text"
                    value={grantToName}
                    onChange={(e) => setGrantToName(e.target.value)}
                    placeholder={accessType === 'ROLE' ? 'e.g., DATA_ANALYST, DEVELOPER' : 'e.g., john.doe'}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e9ecef',
                      borderRadius: '12px',
                      fontSize: '0.9em',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    disabled={loading}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                  />
                  <div style={{ fontSize: '0.85em', color: '#6c757d', marginTop: '6px' }}>
                    {accessType === 'ROLE' 
                      ? 'Enter the Snowflake role name that should receive READ access'
                      : 'Enter the Snowflake username that should receive READ access'
                    }
                  </div>
                </div>

                <div style={{ 
                  backgroundColor: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  border: '2px solid #e9ecef'
                }}>
                  <div style={{ fontSize: '0.85em', color: '#6c757d' }}>
                    ℹ️ Your request will be reviewed by data stewards and approvers. 
                    You'll be notified once a decision is made.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={onClose}
                    disabled={loading}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '0.95em',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !justification.trim() || !accessStartDate || !accessEndDate || !grantToName.trim()}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: (loading || !justification.trim() || !accessStartDate || !accessEndDate || !grantToName.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: '0.95em',
                      fontWeight: '600',
                      opacity: (loading || !justification.trim() || !accessStartDate || !accessEndDate || !grantToName.trim()) ? 0.6 : 1,
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                    }}
                  >
                    {loading ? '⏳ Submitting...' : '🚀 Submit Request'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '5em', marginBottom: '20px' }}>✅</div>
                  <h2 style={{ marginTop: 0, color: '#28a745', fontSize: '1.75em' }}>Request Submitted!</h2>
                  <p style={{ color: '#6c757d', fontSize: '1.05em', lineHeight: '1.6' }}>
                    Your access request has been submitted successfully. 
                    You'll be notified once it's reviewed by the approvers.
                  </p>
                  <div style={{ 
                    backgroundColor: '#d4edda',
                    padding: '16px',
                    borderRadius: '12px',
                    marginTop: '24px',
                    marginBottom: '24px',
                    border: '2px solid #c3e6cb'
                  }}>
                    <div style={{ fontSize: '0.9em', color: '#155724' }}>
                      <strong>Access Details:</strong><br/>
                      📅 {new Date(accessStartDate).toLocaleDateString()} - {new Date(accessEndDate).toLocaleDateString()}<br/>
                      {accessType === 'ROLE' ? '👥' : '👤'} {grantToName}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    style={{
                      marginTop: '8px',
                      padding: '12px 32px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '0.95em',
                      fontWeight: '600',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <MessageModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </>
  );
};

export default AccessRequestModal;
