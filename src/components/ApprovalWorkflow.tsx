import React, { useState, useEffect } from 'react';
import MessageModal from './MessageModal';

interface AccessRequest {
  REQUEST_ID: string;
  TABLE_FULL_NAME: string;
  REQUESTER: string;
  JUSTIFICATION: string;
  STATUS: string;
  APPROVER: string;
  DECISION_DATE: string;
  DECISION_COMMENT: string;
  REQUESTED_AT: string;
  ACCESS_START_DATE: string;
  ACCESS_END_DATE: string;
  ACCESS_TYPE: string;
  GRANT_TO_NAME: string;
  ASSIGNED_TO: string;
  ADDITIONAL_INFO: string;
}

interface Contact {
  PURPOSE: string;
  METHOD: string;
  INHERITED: boolean;
}

const ApprovalWorkflow: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [approverName, setApproverName] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [infoNeeded, setInfoNeeded] = useState('');
  const [reassignTo, setReassignTo] = useState('');
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

  useEffect(() => {
    fetchPendingRequests();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (selectedRequest) {
      fetchContacts(selectedRequest.TABLE_FULL_NAME);
    }
  }, [selectedRequest]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/current-user');
      const result = await response.json();
      if (result.success) {
        setApproverName(result.username);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/access-requests/pending');
      const result = await response.json();
      if (result.success) {
        setRequests(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async (fullTableName: string) => {
    const [db, schema, table] = fullTableName.split('.');
    try {
      const response = await fetch(`/api/contacts/${db}/${schema}/${table}`);
      const result = await response.json();
      if (result.success && result.data) {
        setContacts(result.data || []);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      setContacts([]);
    }
  };

  const handleApproveWithGrant = async () => {
    if (!selectedRequest || !approverName) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please provide approver name',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/access-requests/${selectedRequest.REQUEST_ID}/approve-with-grant`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver: approverName,
          comment: decisionComment,
          accessType: selectedRequest.ACCESS_TYPE,
          grantToName: selectedRequest.GRANT_TO_NAME
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: result.message || 'Access granted successfully',
          type: 'success'
        });
        resetForm();
        fetchPendingRequests();
      } else if (result.warning) {
        setModalState({
          isOpen: true,
          title: 'Partial Success',
          message: result.warning + (result.error ? ` Error: ${result.error}` : ''),
          type: 'info'
        });
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to approve request',
          type: 'error'
        });
      }
    } catch (err) {
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to process approval',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedRequest || !approverName) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please provide approver name',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/access-requests/${selectedRequest.REQUEST_ID}/deny`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver: approverName,
          comment: decisionComment || 'Request denied'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: 'Request denied successfully',
          type: 'success'
        });
        resetForm();
        fetchPendingRequests();
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to deny request',
          type: 'error'
        });
      }
    } catch (err) {
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to process denial',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMoreInfo = async () => {
    if (!selectedRequest || !approverName || !infoNeeded) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please provide your name and specify what information is needed',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/access-requests/${selectedRequest.REQUEST_ID}/request-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedBy: approverName,
          infoNeeded: infoNeeded
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: 'Request sent back to user for additional information',
          type: 'success'
        });
        resetForm();
        fetchPendingRequests();
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to request information',
          type: 'error'
        });
      }
    } catch (err) {
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to process request',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedRequest || !reassignTo) {
      setModalState({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please specify who to reassign to',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/access-requests/${selectedRequest.REQUEST_ID}/reassign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignTo: reassignTo })
      });

      const result = await response.json();
      
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: result.message,
          type: 'success'
        });
        resetForm();
        fetchPendingRequests();
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to reassign request',
          type: 'error'
        });
      }
    } catch (err) {
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to reassign request',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedRequest(null);
    setApproverName('');
    setDecisionComment('');
    setInfoNeeded('');
    setReassignTo('');
    setContacts([]);
  };

  const truncateText = (text: string | null | undefined, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { backgroundColor: '#FFF3CD', color: '#856404', borderColor: '#FFC107' };
      case 'pending_info':
        return { backgroundColor: '#D1ECF1', color: '#0C5460', borderColor: '#17A2B8' };
      default:
        return { backgroundColor: '#F8F9FA', color: '#6C757D', borderColor: '#DEE2E6' };
    }
  };

  if (loading && (requests || []).length === 0) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px', 
        padding: '32px', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ color: 'white', margin: '0 0 16px 0' }}>🔐 Access Request Approvals</h2>
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: '16px'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '20px', 
      padding: '32px', 
      boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
      marginBottom: '24px'
    }}>
      <h2 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '1.75em' }}>🔐 Access Request Approvals</h2>
      <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '24px', fontSize: '0.95em' }}>
        Review and approve data access requests with automatic grants
      </p>

      {(requests || []).length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: '16px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '4em', marginBottom: '16px' }}>✅</div>
          <div style={{ fontSize: '1.1em' }}>No pending access requests</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {(requests || []).map((request) => (
            <div 
              key={request.REQUEST_ID}
              style={{ 
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: selectedRequest?.REQUEST_ID === request.REQUEST_ID 
                  ? '0 8px 24px rgba(0,0,0,0.2)' 
                  : '0 4px 12px rgba(0,0,0,0.1)',
                transform: selectedRequest?.REQUEST_ID === request.REQUEST_ID ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                <div style={{ flex: 1, marginRight: '16px' }}>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    color: '#667eea',
                    fontSize: '1.1em',
                    fontWeight: '600'
                  }}>
                    {truncateText(request.TABLE_FULL_NAME, 50)}
                  </h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    fontSize: '0.9em', 
                    color: '#495057',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600', color: '#667eea' }}>👤 </span>
                      {truncateText(request.REQUESTER, 30)}
                    </div>
                    <div>
                      <span style={{ fontWeight: '600', color: '#667eea' }}>📅 </span>
                      {formatDate(request.REQUESTED_AT)}
                    </div>
                    <div>
                      <span style={{ fontWeight: '600', color: '#667eea' }}>🔑 </span>
                      {request.ACCESS_TYPE === 'ROLE' ? `Role: ${truncateText(request.GRANT_TO_NAME, 20)}` : `User: ${truncateText(request.GRANT_TO_NAME, 20)}`}
                    </div>
                    {request.ACCESS_START_DATE && request.ACCESS_END_DATE && (
                      <div>
                        <span style={{ fontWeight: '600', color: '#667eea' }}>⏰ </span>
                        {formatDate(request.ACCESS_START_DATE)} - {formatDate(request.ACCESS_END_DATE)}
                      </div>
                    )}
                  </div>
                  {request.ASSIGNED_TO && (
                    <div style={{ 
                      fontSize: '0.85em', 
                      color: '#17a2b8',
                      backgroundColor: '#d1ecf1',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      display: 'inline-block',
                      marginTop: '8px'
                    }}>
                      📌 Assigned to: {request.ASSIGNED_TO}
                    </div>
                  )}
                </div>
                <span style={{ 
                  padding: '6px 16px',
                  ...getStatusBadgeStyle(request.STATUS),
                  border: '1px solid',
                  borderRadius: '12px',
                  fontSize: '0.8em',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}>
                  {request.STATUS === 'pending_info' ? 'MORE INFO NEEDED' : request.STATUS}
                </span>
              </div>

              <div style={{ 
                backgroundColor: '#f8f9fa',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid #e9ecef'
              }}>
                <strong style={{ color: '#495057', fontSize: '0.9em' }}>📝 Justification:</strong>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.95em', lineHeight: '1.5', color: '#212529' }}>
                  {request.JUSTIFICATION || 'No justification provided'}
                </p>
                {request.ADDITIONAL_INFO && (
                  <div style={{ 
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '8px',
                    border: '1px solid #ffc107'
                  }}>
                    <strong style={{ color: '#856404', fontSize: '0.85em' }}>ℹ️ More Info Requested:</strong>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.9em', color: '#856404' }}>
                      {request.ADDITIONAL_INFO}
                    </p>
                  </div>
                )}
              </div>

              {selectedRequest?.REQUEST_ID === request.REQUEST_ID ? (
                <div style={{ 
                  marginTop: '20px', 
                  padding: '20px', 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  border: '2px solid #667eea'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#667eea', fontSize: '1.1em' }}>Review & Decision</h4>
                  
                  {/* Contacts Section */}
                  {contacts && contacts.length > 0 && (
                    <div style={{ 
                      marginBottom: '20px', 
                      padding: '16px', 
                      backgroundColor: '#e7f3ff',
                      borderRadius: '12px',
                      border: '1px solid #b3d9ff'
                    }}>
                      <strong style={{ color: '#004085', display: 'block', marginBottom: '12px', fontSize: '0.95em' }}>
                        📞 Dataset Contacts:
                      </strong>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {contacts.map((contact, idx) => (
                          <div key={idx} style={{ 
                            fontSize: '0.85em', 
                            color: '#004085',
                            padding: '8px',
                            backgroundColor: 'white',
                            borderRadius: '8px'
                          }}>
                            <strong>{contact.PURPOSE}:</strong> {contact.METHOD}
                            {contact.INHERITED && ' (inherited)'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#495057', fontSize: '0.9em' }}>
                      Your Name (Approver) *
                    </label>
                    <input
                      type="text"
                      value={approverName}
                      readOnly
                      placeholder="Loading..."
                      style={{ 
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '0.95em',
                        transition: 'border-color 0.2s',
                        outline: 'none',
                        backgroundColor: '#f8f9fa',
                        color: '#495057',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#495057', fontSize: '0.9em' }}>
                      Decision Comment
                    </label>
                    <textarea
                      value={decisionComment}
                      onChange={(e) => setDecisionComment(e.target.value)}
                      placeholder="Add notes about this decision (optional)..."
                      rows={3}
                      style={{ 
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '0.95em',
                        resize: 'vertical',
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                    />
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px', 
                    marginTop: '20px' 
                  }}>
                    <button
                      onClick={handleApproveWithGrant}
                      disabled={loading}
                      style={{ 
                        padding: '14px 20px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '0.95em',
                        opacity: loading ? 0.6 : 1,
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
                      }}
                      onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      ✓ Approve & Grant
                    </button>
                    <button
                      onClick={handleDeny}
                      disabled={loading}
                      style={{ 
                        padding: '14px 20px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '0.95em',
                        opacity: loading ? 0.6 : 1,
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                      }}
                      onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      ✗ Deny
                    </button>
                  </div>

                  {/* Request More Info Section */}
                  <div style={{ 
                    marginTop: '20px', 
                    padding: '16px', 
                    backgroundColor: '#fff8e1',
                    borderRadius: '12px',
                    border: '2px dashed #ffc107'
                  }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#856404', fontSize: '0.9em' }}>
                      ℹ️ Request Additional Information
                    </label>
                    <textarea
                      value={infoNeeded}
                      onChange={(e) => setInfoNeeded(e.target.value)}
                      placeholder="What additional information do you need from the requester?"
                      rows={2}
                      style={{ 
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ffc107',
                        borderRadius: '10px',
                        fontSize: '0.9em',
                        resize: 'vertical',
                        marginBottom: '12px'
                      }}
                    />
                    <button
                      onClick={handleRequestMoreInfo}
                      disabled={loading}
                      style={{ 
                        padding: '10px 16px',
                        backgroundColor: '#ffc107',
                        color: '#856404',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9em',
                        width: '100%'
                      }}
                    >
                      📩 Send Back for More Info
                    </button>
                  </div>

                  {/* Reassign Section */}
                  <div style={{ 
                    marginTop: '16px', 
                    padding: '16px', 
                    backgroundColor: '#e7f3ff',
                    borderRadius: '12px',
                    border: '2px dashed #17a2b8'
                  }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#0c5460', fontSize: '0.9em' }}>
                      🔄 Reassign to Another Approver
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                        placeholder="Enter username to reassign"
                        style={{ 
                          flex: 1,
                          padding: '10px',
                          border: '2px solid #17a2b8',
                          borderRadius: '10px',
                          fontSize: '0.9em'
                        }}
                      />
                      <button
                        onClick={handleReassign}
                        disabled={loading}
                        style={{ 
                          padding: '10px 16px',
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          fontSize: '0.9em',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Reassign
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={resetForm}
                    style={{ 
                      marginTop: '16px',
                      padding: '12px',
                      width: '100%',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.95em'
                    }}
                  >
                    Cancel Review
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedRequest(request)}
                  style={{ 
                    padding: '12px 24px',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.95em',
                    fontWeight: '600',
                    width: '100%',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                  }}
                >
                  🔍 Review & Decide
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <MessageModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </div>
  );
};

export default ApprovalWorkflow;
