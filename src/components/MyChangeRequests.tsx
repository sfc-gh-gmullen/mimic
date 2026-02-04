import React, { useState, useEffect } from 'react';
import Modal from './Modal';

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
  DECISION_COMMENT?: string;
  DECISION_DATE?: string;
}

const MyChangeRequests: React.FC = () => {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRequest, setEditingRequest] = useState<ChangeRequest | null>(null);
  const [editedJustification, setEditedJustification] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      const response = await fetch('/api/change-requests/my-requests');
      const result = await response.json();
      if (result.success) {
        setRequests(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch my requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRequest = (request: ChangeRequest) => {
    setEditingRequest(request);
    setEditedJustification(request.JUSTIFICATION);
    const proposed = typeof request.PROPOSED_CHANGE === 'string'
      ? JSON.parse(request.PROPOSED_CHANGE)
      : request.PROPOSED_CHANGE;
    setEditedDescription(proposed.description || '');
  };

  const handleUpdateRequest = async () => {
    if (!editingRequest) return;

    if (!editedJustification.trim()) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Please provide a justification',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const proposed = typeof editingRequest.PROPOSED_CHANGE === 'string'
        ? JSON.parse(editingRequest.PROPOSED_CHANGE)
        : editingRequest.PROPOSED_CHANGE;

      const updatedChange = {
        ...proposed,
        description: editedDescription
      };

      const response = await fetch(`/api/change-requests/${editingRequest.REQUEST_ID}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justification: editedJustification,
          proposedChange: updatedChange
        })
      });

      const result = await response.json();
      if (result.success) {
        setModal({
          isOpen: true,
          title: 'Success',
          message: 'Request updated and resubmitted for approval!',
          type: 'success'
        });
        setEditingRequest(null);
        fetchMyRequests();
      } else {
        setModal({
          isOpen: true,
          title: 'Error',
          message: result.error || 'Failed to update request',
          type: 'error'
        });
      }
    } catch (err) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to update request',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: { bg: string; color: string; label: string } } = {
      'pending': { bg: '#fff3cd', color: '#856404', label: '⏳ Pending Review' },
      'more_info_needed': { bg: '#ffc107', color: '#212529', label: '↩️ More Info Needed' },
      'approved': { bg: '#d4edda', color: '#155724', label: '✓ Approved' },
      'denied': { bg: '#f8d7da', color: '#721c24', label: '✗ Denied' }
    };
    const style = statusStyles[status] || { bg: '#e9ecef', color: '#495057', label: status };
    return (
      <span style={{
        padding: '6px 16px',
        backgroundColor: style.bg,
        color: style.color,
        borderRadius: '20px',
        fontSize: '0.9em',
        fontWeight: '600'
      }}>
        {style.label}
      </span>
    );
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'DESCRIPTION': 'Table Description',
      'TAG_ADD': 'Add Tag',
      'TAG_REMOVE': 'Remove Tag',
      'COLUMN_DESCRIPTION': 'Column Description',
      'ATTRIBUTE_CREATE': 'New Attribute'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#6c757d' }}>
        Loading your requests...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#212529' }}>📝 My Change Requests</h2>
        <p style={{ color: '#6c757d', margin: 0 }}>
          View and manage your submitted change requests
        </p>
      </div>

      {requests.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '3em', marginBottom: '16px' }}>📋</div>
          <div style={{ color: '#6c757d', fontSize: '1.1em' }}>No change requests yet</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {requests.map((request) => {
            const proposed = typeof request.PROPOSED_CHANGE === 'string'
              ? JSON.parse(request.PROPOSED_CHANGE)
              : request.PROPOSED_CHANGE;
            const isEditing = editingRequest?.REQUEST_ID === request.REQUEST_ID;
            const canEdit = request.STATUS === 'more_info_needed';

            return (
              <div
                key={request.REQUEST_ID}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  border: canEdit ? '2px solid #ffc107' : '1px solid #e9ecef'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', fontSize: '1.1em', color: '#212529' }}>
                        {getRequestTypeLabel(request.REQUEST_TYPE)}
                      </span>
                      {getStatusBadge(request.STATUS)}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#6c757d' }}>
                      Target: {request.TARGET_OBJECT}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#6c757d', marginTop: '4px' }}>
                      Submitted: {new Date(request.REQUESTED_AT).toLocaleString()}
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9em' }}>
                        Updated Description:
                      </label>
                      <textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #667eea',
                          borderRadius: '8px',
                          fontSize: '0.95em',
                          minHeight: '100px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9em' }}>
                        Updated Justification: *
                      </label>
                      <textarea
                        value={editedJustification}
                        onChange={(e) => setEditedJustification(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #667eea',
                          borderRadius: '8px',
                          fontSize: '0.95em',
                          minHeight: '80px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={handleUpdateRequest}
                        disabled={loading}
                        style={{
                          padding: '10px 24px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          fontSize: '0.95em',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        Resubmit Request
                      </button>
                      <button
                        onClick={() => setEditingRequest(null)}
                        disabled={loading}
                        style={{
                          padding: '10px 24px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.95em',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9em', marginBottom: '8px', color: '#495057' }}>
                        Proposed Change:
                      </div>
                      <div style={{ fontSize: '0.9em', color: '#212529' }}>
                        {proposed.description || proposed.tag_name || JSON.stringify(proposed)}
                      </div>
                    </div>

                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9em', marginBottom: '8px', color: '#495057' }}>
                        Justification:
                      </div>
                      <div style={{ fontSize: '0.9em', color: '#212529' }}>
                        {request.JUSTIFICATION}
                      </div>
                    </div>

                    {request.DECISION_COMMENT && (
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        border: '1px solid #ffc107'
                      }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9em', marginBottom: '8px', color: '#856404' }}>
                          Feedback from Reviewer:
                        </div>
                        <div style={{ fontSize: '0.9em', color: '#856404' }}>
                          {request.DECISION_COMMENT}
                        </div>
                      </div>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => handleEditRequest(request)}
                        style={{
                          padding: '10px 24px',
                          backgroundColor: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.95em',
                          marginTop: '12px'
                        }}
                      >
                        ✏️ Edit & Resubmit
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        type={modal.type}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{modal.message}</div>
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button
            onClick={() => setModal({ ...modal, isOpen: false })}
            style={{
              padding: '10px 20px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MyChangeRequests;
