import React, { useState, useEffect } from 'react';

interface Attribute {
  ATTRIBUTE_NAME: string;
  DISPLAY_NAME: string;
  DESCRIPTION: string;
  USAGE_COUNT: number;
  CREATED_BY: string;
  CREATED_AT: string;
}

interface Enumeration {
  ENUMERATION_ID: string;
  VALUE_CODE: string;
  VALUE_DESCRIPTION: string;
  SORT_ORDER: number;
  IS_ACTIVE: boolean;
}

interface AttributeRequest {
  REQUEST_ID: string;
  REQUEST_TYPE: string;
  TARGET_OBJECT: string;
  REQUESTER: string;
  JUSTIFICATION: string;
  PROPOSED_CHANGE: any;
  STATUS: string;
  REQUESTED_AT: string;
  DECISION_COMMENT?: string;
}

const AttributeManager: React.FC = () => {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [selectedAttribute, setSelectedAttribute] = useState<Attribute | null>(null);
  const [enumerations, setEnumerations] = useState<Enumeration[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AttributeRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending'>('pending');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);

  useEffect(() => {
    fetchAttributes();
    fetchPendingRequests();
  }, []);

  useEffect(() => {
    if (selectedAttribute) {
      fetchEnumerations(selectedAttribute.ATTRIBUTE_NAME);
    }
  }, [selectedAttribute]);

  const fetchAttributes = async () => {
    try {
      const response = await fetch('/api/attributes');
      const result = await response.json();
      if (result.success) {
        setAttributes(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch attributes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnumerations = async (attributeName: string) => {
    try {
      const response = await fetch(`/api/attributes/${attributeName}/enumerations`);
      const result = await response.json();
      if (result.success) {
        setEnumerations(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch enumerations:', err);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      // Fetch all attribute-related change requests
      const response = await fetch('/api/change-requests/all-attributes');
      const result = await response.json();
      if (result.success) {
        setPendingRequests(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending requests:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: { bg: string; color: string; label: string } } = {
      'pending': { bg: '#fff3cd', color: '#856404', label: '⏳ Pending' },
      'more_info_needed': { bg: '#ffc107', color: '#212529', label: '↩️ More Info Needed' },
      'approved': { bg: '#d4edda', color: '#155724', label: '✓ Approved' },
      'denied': { bg: '#f8d7da', color: '#721c24', label: '✗ Denied' }
    };
    const style = statusStyles[status] || { bg: '#e9ecef', color: '#495057', label: status };
    return (
      <span style={{
        padding: '4px 12px',
        backgroundColor: style.bg,
        color: style.color,
        borderRadius: '12px',
        fontSize: '0.85em',
        fontWeight: '600'
      }}>
        {style.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px', 
        padding: '32px', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ color: 'white', margin: '0 0 16px 0' }}>🏷️ Business Glossary Manager</h2>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '1.75em' }}>🏷️ Business Glossary Manager</h2>
          <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '0.95em' }}>
            Manage global attribute definitions and enumerated values
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowPendingRequests(!showPendingRequests)}
            style={{
              padding: '12px 24px',
              backgroundColor: pendingRequests.length > 0 ? '#ffc107' : 'rgba(255,255,255,0.8)',
              color: pendingRequests.length > 0 ? '#212529' : '#667eea',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.95em',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            📋 Pending Requests
            {pendingRequests.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#dc3545',
                color: 'white',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75em',
                fontWeight: '700'
              }}>
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.95em',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {showCreateForm ? '✕ Cancel' : '+ Request New Attribute'}
          </button>
        </div>
      </div>

      {/* Pending Requests Section */}
      {showPendingRequests && (
        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#667eea' }}>
              📋 Attribute Change Requests ({pendingRequests.filter(r => requestFilter === 'pending' ? r.STATUS === 'pending' || r.STATUS === 'more_info_needed' : true).length})
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setRequestFilter('pending')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: requestFilter === 'pending' ? '#667eea' : 'white',
                  color: requestFilter === 'pending' ? 'white' : '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Pending Only
              </button>
              <button
                onClick={() => setRequestFilter('all')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: requestFilter === 'all' ? '#667eea' : 'white',
                  color: requestFilter === 'all' ? 'white' : '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                All Requests
              </button>
            </div>
          </div>
          {pendingRequests.filter(r => requestFilter === 'pending' ? r.STATUS === 'pending' || r.STATUS === 'more_info_needed' : true).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {requestFilter === 'pending' ? 'No pending requests' : 'No requests found'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {pendingRequests.filter(r => requestFilter === 'pending' ? r.STATUS === 'pending' || r.STATUS === 'more_info_needed' : true).map((request) => {
                const proposed = typeof request.PROPOSED_CHANGE === 'string' 
                  ? JSON.parse(request.PROPOSED_CHANGE)
                  : request.PROPOSED_CHANGE;
                
                return (
                  <div
                    key={request.REQUEST_ID}
                    style={{
                      padding: '16px',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      border: '2px solid #e9ecef'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1.05em', color: '#212529', marginBottom: '4px' }}>
                          {request.REQUEST_TYPE === 'ATTRIBUTE_CREATE' && '🆕 New Attribute Request'}
                          {request.REQUEST_TYPE === 'ENUMERATION_ADD' && '➕ Add Enumeration'}
                          {request.REQUEST_TYPE === 'ENUMERATION_EDIT' && '✏️ Edit Enumeration'}
                        </div>
                        <div style={{ fontSize: '0.85em', color: '#6c757d' }}>
                          {request.REQUEST_TYPE === 'ATTRIBUTE_CREATE' 
                            ? proposed.attribute_name 
                            : request.TARGET_OBJECT}
                        </div>
                      </div>
                      {getStatusBadge(request.STATUS)}
                    </div>
                    
                    {request.REQUEST_TYPE === 'ATTRIBUTE_CREATE' && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9em', marginBottom: '4px' }}>
                          {proposed.display_name}
                        </div>
                        <div style={{ fontSize: '0.85em', color: '#6c757d', marginBottom: '8px' }}>
                          {proposed.description}
                        </div>
                        {proposed.enumerations && proposed.enumerations.length > 0 && (
                          <div style={{ fontSize: '0.85em', color: '#495057' }}>
                            <strong>Business Context:</strong> {proposed.enumerations.length} values defined
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div style={{ 
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      fontSize: '0.85em',
                      marginBottom: '8px'
                    }}>
                      <strong>Justification:</strong> {request.JUSTIFICATION}
                    </div>
                    
                    {request.DECISION_COMMENT && (
                      <div style={{ 
                        padding: '12px',
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        fontSize: '0.85em',
                        marginBottom: '8px'
                      }}>
                        <strong>Feedback:</strong> {request.DECISION_COMMENT}
                      </div>
                    )}
                    
                    <div style={{ fontSize: '0.8em', color: '#6c757d', marginTop: '8px' }}>
                      Requested by {request.REQUESTER} on {new Date(request.REQUESTED_AT).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Attribute Form */}
      {showCreateForm && (
        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#667eea' }}>Request New Attribute</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9em' }}>
                Attribute Name (lowercase, no spaces)*
              </label>
              <input
                type="text"
                id="attr-name"
                placeholder="e.g., claim_status, policy_type"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.95em'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9em' }}>
                Display Name*
              </label>
              <input
                type="text"
                id="attr-display"
                placeholder="e.g., Claim Status, Policy Type"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.95em'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9em' }}>
                Description*
              </label>
              <textarea
                id="attr-desc"
                placeholder="Describe what this attribute represents..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.95em',
                  minHeight: '80px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9em' }}>
                Business Context (one per line, format: CODE: Description)
              </label>
              
              {/* Info box for writing good definitions */}
              <div style={{
                padding: '12px',
                backgroundColor: '#e7f3ff',
                border: '2px solid #667eea',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '0.85em'
              }}>
                <div style={{ fontWeight: '600', color: '#004085', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '1.2em' }}>ℹ️</span>
                  <span>How to Write Good Business Definitions</span>
                </div>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#004085', lineHeight: '1.6' }}>
                  <li><strong>Be clear and specific:</strong> Avoid jargon and use plain language that business users understand</li>
                  <li><strong>Define all values:</strong> List each possible code with a meaningful description</li>
                  <li><strong>Be consistent:</strong> Use the same terminology across all definitions</li>
                  <li><strong>Include examples:</strong> When helpful, add real-world examples in the description</li>
                  <li><strong>Keep it business-focused:</strong> Explain what the value means for business processes, not technical implementation</li>
                </ul>
                <div style={{ marginTop: '8px', fontStyle: 'italic', color: '#495057' }}>
                  <strong>Format:</strong> CODE: Clear business definition of what this code represents
                </div>
              </div>
              
              <textarea
                id="attr-values"
                placeholder="APPROVED: Claim has been reviewed and payment authorized&#10;DENIED: Claim does not meet coverage requirements and will not be paid&#10;PENDING: Claim is under review by claims adjuster"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.95em',
                  minHeight: '120px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9em' }}>
                Justification*
              </label>
              <textarea
                id="attr-just"
                placeholder="Why is this attribute needed? What business problem does it solve?"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '0.95em',
                  minHeight: '60px',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <button
              onClick={async () => {
                const nameElem = document.getElementById('attr-name') as HTMLInputElement;
                const displayElem = document.getElementById('attr-display') as HTMLInputElement;
                const descElem = document.getElementById('attr-desc') as HTMLTextAreaElement;
                const valuesElem = document.getElementById('attr-values') as HTMLTextAreaElement;
                const justElem = document.getElementById('attr-just') as HTMLTextAreaElement;
                
                const name = nameElem?.value.trim() || '';
                const display = displayElem?.value.trim() || '';
                const desc = descElem?.value.trim() || '';
                const valuesText = valuesElem?.value.trim() || '';
                const just = justElem?.value.trim() || '';
                
                if (!name || !display || !desc || !just) {
                  alert('Please fill in all required fields');
                  return;
                }
                
                // Parse enumeration values
                const enums = valuesText.split('\n')
                  .filter(line => line.trim() && line.includes(':'))
                  .map((line, idx) => {
                    const [code, ...descParts] = line.split(':');
                    return {
                      value_code: code.trim(),
                      value_description: descParts.join(':').trim(),
                      sort_order: idx + 1
                    };
                  });
                
                try {
                  const response = await fetch('/api/change-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      requestType: 'ATTRIBUTE_CREATE',
                      targetObject: name,
                      justification: just,
                      proposedChange: {
                        attribute_name: name,
                        display_name: display,
                        description: desc,
                        enumerations: enums
                      }
                    })
                  });
                  const result = await response.json();
                  if (result.success) {
                    alert('Attribute creation request submitted for approval!');
                    setShowCreateForm(false);
                    // Clear form
                    if (nameElem) nameElem.value = '';
                    if (displayElem) displayElem.value = '';
                    if (descElem) descElem.value = '';
                    if (valuesElem) valuesElem.value = '';
                    if (justElem) justElem.value = '';
                  } else {
                    alert('Failed to submit request: ' + result.error);
                  }
                } catch (err) {
                  alert('Failed to submit attribute request');
                }
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1em',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
            >
              Submit Attribute Request
            </button>
          </div>
        </div>
      )}

      {attributes.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderRadius: '16px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '4em', marginBottom: '16px' }}>📚</div>
          <div style={{ fontSize: '1.1em' }}>No business glossary attributes defined</div>
          <div style={{ fontSize: '0.9em', marginTop: '8px' }}>
            Attributes are created through the approval workflow
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
          {/* Attributes List */}
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: '16px',
            padding: '20px',
            height: 'fit-content'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1em' }}>Attributes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {attributes.map((attr) => (
                <button
                  key={attr.ATTRIBUTE_NAME}
                  onClick={() => setSelectedAttribute(attr)}
                  style={{ 
                    padding: '12px',
                    backgroundColor: selectedAttribute?.ATTRIBUTE_NAME === attr.ATTRIBUTE_NAME 
                      ? '#667eea' 
                      : 'white',
                    color: selectedAttribute?.ATTRIBUTE_NAME === attr.ATTRIBUTE_NAME 
                      ? 'white' 
                      : '#212529',
                    border: '2px solid',
                    borderColor: selectedAttribute?.ATTRIBUTE_NAME === attr.ATTRIBUTE_NAME 
                      ? '#667eea' 
                      : '#e9ecef',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    fontWeight: selectedAttribute?.ATTRIBUTE_NAME === attr.ATTRIBUTE_NAME 
                      ? '600' 
                      : 'normal'
                  }}
                  onMouseOver={(e) => {
                    if (selectedAttribute?.ATTRIBUTE_NAME !== attr.ATTRIBUTE_NAME) {
                      e.currentTarget.style.borderColor = '#667eea';
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedAttribute?.ATTRIBUTE_NAME !== attr.ATTRIBUTE_NAME) {
                      e.currentTarget.style.borderColor = '#e9ecef';
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    {attr.DISPLAY_NAME}
                  </div>
                  <div style={{ 
                    fontSize: '0.75em', 
                    opacity: selectedAttribute?.ATTRIBUTE_NAME === attr.ATTRIBUTE_NAME ? 0.9 : 0.7 
                  }}>
                    Used in {attr.USAGE_COUNT} columns
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Attribute Details */}
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: '16px',
            padding: '20px'
          }}>
            {selectedAttribute ? (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3em', color: '#667eea' }}>
                      {selectedAttribute.DISPLAY_NAME}
                    </h3>
                    <button
                      onClick={() => {
                        const justification = prompt('Why are you requesting a change to this attribute?');
                        if (!justification || !justification.trim()) return;
                        
                        const newDescription = prompt('Enter new description:', selectedAttribute.DESCRIPTION);
                        if (!newDescription || !newDescription.trim()) return;
                        
                        fetch('/api/change-requests', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            request_type: 'ATTRIBUTE_EDIT',
                            target_object: selectedAttribute.ATTRIBUTE_NAME,
                            justification: justification,
                            proposed_change: {
                              description: newDescription,
                              display_name: selectedAttribute.DISPLAY_NAME
                            },
                            current_value: {
                              description: selectedAttribute.DESCRIPTION,
                              display_name: selectedAttribute.DISPLAY_NAME
                            }
                          })
                        })
                        .then(res => res.json())
                        .then(result => {
                          if (result.success) {
                            alert('Change request submitted for approval!');
                            fetchPendingRequests();
                          } else {
                            alert('Failed to submit request: ' + result.error);
                          }
                        })
                        .catch(err => {
                          alert('Failed to submit request');
                          console.error(err);
                        });
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9em'
                      }}
                    >
                      ✏️ Request Change
                    </button>
                  </div>
                  <div style={{ 
                    fontSize: '0.85em', 
                    color: '#6c757d',
                    fontFamily: 'monospace',
                    backgroundColor: '#f8f9fa',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginBottom: '12px'
                  }}>
                    {selectedAttribute.ATTRIBUTE_NAME}
                  </div>
                  <p style={{ color: '#495057', lineHeight: '1.6', marginBottom: '12px' }}>
                    {selectedAttribute.DESCRIPTION}
                  </p>
                  <div style={{ fontSize: '0.85em', color: '#6c757d' }}>
                    Created by {selectedAttribute.CREATED_BY} • Used in {selectedAttribute.USAGE_COUNT} columns
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1em' }}>Business Context</h4>
                  
                  {enumerations.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '40px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '12px',
                      color: '#6c757d'
                    }}>
                      <div>No enumerated values defined</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {enumerations.map((enumVal, idx) => (
                        <div 
                          key={enumVal.ENUMERATION_ID}
                          style={{ 
                            padding: '16px',
                            border: '2px solid #e9ecef',
                            borderRadius: '12px',
                            backgroundColor: 'white',
                            position: 'relative'
                          }}
                        >
                          <div style={{ 
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            backgroundColor: '#667eea',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7em',
                            fontWeight: '600'
                          }}>
                            #{idx + 1}
                          </div>
                          
                          <div style={{ 
                            fontWeight: '600', 
                            fontSize: '1.05em',
                            color: '#667eea',
                            marginBottom: '8px',
                            paddingRight: '60px'
                          }}>
                            {enumVal.VALUE_CODE}
                          </div>
                          
                          <div style={{ 
                            fontSize: '0.9em',
                            color: '#495057',
                            lineHeight: '1.6'
                          }}>
                            {enumVal.VALUE_DESCRIPTION}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ 
                  marginTop: '24px',
                  padding: '16px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '12px',
                  border: '1px solid #ffc107'
                }}>
                  <strong style={{ color: '#856404', fontSize: '0.9em' }}>ℹ️ Note:</strong>
                  <div style={{ color: '#856404', fontSize: '0.85em', marginTop: '6px' }}>
                    Changes to attribute definitions and business context require submission through the change request workflow.
                    Contact your data steward to request modifications.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px',
                color: '#6c757d'
              }}>
                <div style={{ fontSize: '3em', marginBottom: '16px' }}>👈</div>
                <div>Select an attribute to view details and enumerated values</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttributeManager;
