import React, { useState, useEffect } from 'react';
import MessageModal from './MessageModal';

interface ChangeRequest {
  REQUEST_ID: string;
  REQUEST_TYPE: string;
  TARGET_OBJECT: string;
  REQUESTER: string;
  JUSTIFICATION: string;
  PROPOSED_CHANGE: any;
  CURRENT_VALUE: any;
  STATUS: string;
  ASSIGNED_TO: string;
  REQUESTED_AT: string;
}

const ContentChangeApproval: React.FC = () => {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
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
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/change-requests/pending');
      const result = await response.json();
      if (result.success) {
        setRequests(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch change requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/change-requests/${selectedRequest.REQUEST_ID}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: decisionComment })
      });
      
      const result = await response.json();
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: 'Change request approved and applied',
          type: 'success'
        });
        resetSelection();
        fetchPendingRequests();
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to approve',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Approve error:', error);
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to approve change request',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedRequest) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/change-requests/${selectedRequest.REQUEST_ID}/deny`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: decisionComment })
      });
      
      const result = await response.json();
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: 'Change request denied',
          type: 'success'
        });
        resetSelection();
        fetchPendingRequests();
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to deny',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Deny error:', error);
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to deny change request',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReturnForInfo = async () => {
    if (!selectedRequest) return;
    
    if (!decisionComment || !decisionComment.trim()) {
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Please explain what additional information is needed',
        type: 'error'
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/change-requests/${selectedRequest.REQUEST_ID}/return`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: decisionComment })
      });
      
      const result = await response.json();
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: 'Change request returned to requester for additional information',
          type: 'success'
        });
        resetSelection();
        fetchPendingRequests();
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to return request',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Return error:', error);
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to return change request',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetSelection = () => {
    setSelectedRequest(null);
    setDecisionComment('');
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

  const getRequestTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'DESCRIPTION': 'Table Description Edit',
      'TAG_ADD': 'Add Tag',
      'TAG_REMOVE': 'Remove Tag',
      'ENUMERATION_ADD': 'Add Enumeration',
      'ENUMERATION_EDIT': 'Edit Enumeration',
      'COLUMN_DESCRIPTION': 'Column Description Edit',
      'ATTRIBUTE_CREATE': 'New Attribute Request'
    };
    return labels[type] || type;
  };

  const renderProposedChange = (request: ChangeRequest) => {
    const proposed = request.PROPOSED_CHANGE;
    const current = request.CURRENT_VALUE;

    if (request.REQUEST_TYPE === 'DESCRIPTION') {
      return (
        <div>
          {current && (
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#856404' }}>Current:</strong>
              <div style={{ 
                padding: '12px',
                backgroundColor: '#fff3cd',
                borderRadius: '8px',
                marginTop: '6px',
                fontStyle: 'italic'
              }}>
                {current.description || 'No description'}
              </div>
            </div>
          )}
          <div>
            <strong style={{ color: '#155724' }}>Proposed:</strong>
            <div style={{ 
              padding: '12px',
              backgroundColor: '#d4edda',
              borderRadius: '8px',
              marginTop: '6px'
            }}>
              {proposed.description}
            </div>
          </div>
        </div>
      );
    }

    if (request.REQUEST_TYPE === 'TAG_ADD') {
      return (
        <div>
          <strong style={{ color: '#155724' }}>Adding Tag:</strong>
          <div style={{ 
            padding: '8px 16px',
            backgroundColor: '#d4edda',
            borderRadius: '16px',
            display: 'inline-block',
            marginTop: '6px',
            marginLeft: '8px',
            fontWeight: '600'
          }}>
            {proposed.tag_name}
          </div>
        </div>
      );
    }

    if (request.REQUEST_TYPE === 'TAG_REMOVE') {
      return (
        <div>
          <strong style={{ color: '#721c24' }}>Removing Tag:</strong>
          <div style={{ 
            padding: '8px 16px',
            backgroundColor: '#f8d7da',
            borderRadius: '16px',
            display: 'inline-block',
            marginTop: '6px',
            marginLeft: '8px',
            fontWeight: '600',
            textDecoration: 'line-through'
          }}>
            {proposed.tag_name}
          </div>
        </div>
      );
    }

    if (request.REQUEST_TYPE === 'ENUMERATION_ADD' || request.REQUEST_TYPE === 'ENUMERATION_EDIT') {
      return (
        <div>
          <strong>Enumeration Change:</strong>
          <div style={{ marginTop: '8px' }}>
            <div><strong>Code:</strong> {proposed.value_code}</div>
            <div><strong>Description:</strong> {proposed.value_description}</div>
            <div><strong>Action:</strong> {proposed.action}</div>
          </div>
        </div>
      );
    }

    if (request.REQUEST_TYPE === 'COLUMN_DESCRIPTION') {
      return (
        <div>
          <div style={{ fontSize: '0.9em', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
            Column: {request.TARGET_OBJECT.split('.').pop()}
          </div>
          {current && (
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#856404' }}>Current:</strong>
              <div style={{ 
                padding: '12px',
                backgroundColor: '#fff3cd',
                borderRadius: '8px',
                marginTop: '6px',
                fontStyle: 'italic',
                fontSize: '0.9em'
              }}>
                {current.description || 'No description'}
              </div>
            </div>
          )}
          <div>
            <strong style={{ color: '#155724' }}>Proposed:</strong>
            <div style={{ 
              padding: '12px',
              backgroundColor: '#d4edda',
              borderRadius: '8px',
              marginTop: '6px',
              fontSize: '0.9em'
            }}>
              {proposed.description}
            </div>
          </div>
        </div>
      );
    }

    if (request.REQUEST_TYPE === 'ATTRIBUTE_CREATE') {
      return (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <div><strong>Attribute Name:</strong> {proposed.attribute_name}</div>
            <div><strong>Display Name:</strong> {proposed.display_name}</div>
            <div style={{ marginTop: '8px' }}><strong>Description:</strong></div>
            <div style={{ 
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              marginTop: '4px',
              fontSize: '0.9em'
            }}>
              {proposed.description}
            </div>
          </div>
          {proposed.enumerations && proposed.enumerations.length > 0 && (
            <div>
              <strong>Enumerated Values ({proposed.enumerations.length}):</strong>
              <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
                {proposed.enumerations.map((enumVal: any, idx: number) => (
                  <div 
                    key={idx}
                    style={{ 
                      padding: '10px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6'
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#667eea' }}>{enumVal.value_code}</div>
                    <div style={{ fontSize: '0.85em', color: '#6c757d', marginTop: '4px' }}>
                      {enumVal.value_description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return <div>Proposed change details</div>;
  };

  if (loading && (requests || []).length === 0) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px', 
        padding: '32px', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ color: 'white', margin: '0 0 16px 0' }}>📝 Content Change Approvals</h2>
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
    <>
      <MessageModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
      
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px', 
        padding: '32px', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        marginBottom: '24px'
      }}>
        <h2 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '1.75em' }}>📝 Content Change Approvals</h2>
        <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '24px', fontSize: '0.95em' }}>
          Review and approve changes to descriptions, tags, and business glossary
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
            <div style={{ fontSize: '1.1em' }}>No pending content change requests</div>
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
                    <div style={{ 
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: '#e7f3ff',
                      color: '#004085',
                      borderRadius: '12px',
                      fontSize: '0.75em',
                      fontWeight: '600',
                      marginBottom: '8px'
                    }}>
                      {getRequestTypeLabel(request.REQUEST_TYPE)}
                    </div>
                    <h3 style={{ 
                      margin: '0 0 12px 0', 
                      color: '#667eea',
                      fontSize: '1.1em',
                      fontWeight: '600'
                    }}>
                      {truncateText(request.TARGET_OBJECT, 60)}
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
                      {request.ASSIGNED_TO && (
                        <div>
                          <span style={{ fontWeight: '600', color: '#667eea' }}>📌 </span>
                          Assigned to: {request.ASSIGNED_TO}
                        </div>
                      )}
                    </div>
                  </div>
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
                </div>

                <div style={{ 
                  backgroundColor: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  border: '1px solid #e9ecef'
                }}>
                  {renderProposedChange(request)}
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
                    
                    <textarea
                      placeholder="Add decision comment (optional)..."
                      value={decisionComment}
                      onChange={(e) => setDecisionComment(e.target.value)}
                      style={{ 
                        width: '100%',
                        minHeight: '80px',
                        padding: '12px',
                        border: '2px solid #dee2e6',
                        borderRadius: '8px',
                        fontSize: '0.95em',
                        fontFamily: 'inherit',
                        marginBottom: '16px',
                        resize: 'vertical'
                      }}
                    />

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleApprove}
                        disabled={loading}
                        style={{ 
                          flex: '1 1 200px',
                          padding: '12px 24px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '1em',
                          fontWeight: '600',
                          opacity: loading ? 0.6 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#218838')}
                        onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#28a745')}
                      >
                        ✓ Approve & Apply
                      </button>
                      <button
                        onClick={handleReturnForInfo}
                        disabled={loading}
                        style={{ 
                          flex: '1 1 200px',
                          padding: '12px 24px',
                          backgroundColor: '#ffc107',
                          color: '#212529',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '1em',
                          fontWeight: '600',
                          opacity: loading ? 0.6 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#e0a800')}
                        onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#ffc107')}
                      >
                        ↩️ Return for More Info
                      </button>
                      <button
                        onClick={handleDeny}
                        disabled={loading}
                        style={{ 
                          flex: '1 1 150px',
                          padding: '12px 24px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '1em',
                          fontWeight: '600',
                          opacity: loading ? 0.6 : 1,
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#c82333')}
                        onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#dc3545')}
                      >
                        ✗ Deny
                      </button>
                      <button
                        onClick={resetSelection}
                        disabled={loading}
                        style={{ 
                          padding: '12px 24px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '1em',
                          fontWeight: '600',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedRequest(request)}
                    style={{ 
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '1em',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5568d3'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
                  >
                    Review Request →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ContentChangeApproval;
