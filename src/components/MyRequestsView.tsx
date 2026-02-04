import React, { useState, useEffect } from 'react';

interface AccessRequest {
  REQUEST_ID: string;
  TABLE_FULL_NAME: string;
  REQUESTER: string;
  JUSTIFICATION: string;
  STATUS: 'pending' | 'approved' | 'denied';
  APPROVER: string | null;
  DECISION_DATE: string | null;
  DECISION_COMMENT: string | null;
  REQUESTED_AT: string;
}

const MyRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/access-requests');
      const result = await response.json();
      
      if (result.success) {
        setRequests(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError('Failed to load access requests');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { backgroundColor: '#fff3cd', color: '#856404', text: '⏳ Pending' },
      approved: { backgroundColor: '#d4edda', color: '#155724', text: '✅ Approved' },
      denied: { backgroundColor: '#f8d7da', color: '#721c24', text: '❌ Denied' }
    };
    
    const style = styles[status as keyof typeof styles] || styles.pending;
    
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.85em',
        fontWeight: '600',
        ...style
      }}>
        {style.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2>📋 My Access Requests</h2>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading requests...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>📋 My Access Requests</h2>
      <p style={{ color: '#6c757d', marginBottom: '20px' }}>Track the status of your data access requests</p>

      {error && (
        <div style={{ padding: '15px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          <div style={{ fontSize: '3em', marginBottom: '10px' }}>📭</div>
          <div>No access requests yet</div>
          <div style={{ fontSize: '0.9em', marginTop: '8px' }}>
            Request access to tables from the catalog browser
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Table</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Justification</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Requested</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Decision</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => (
                <tr key={request.REQUEST_ID} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px', fontWeight: '500', fontSize: '0.9em' }}>
                    {request.TABLE_FULL_NAME}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.9em', maxWidth: '300px' }}>
                    <div style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {request.JUSTIFICATION}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {getStatusBadge(request.STATUS)}
                  </td>
                  <td style={{ padding: '12px', color: '#6c757d', fontSize: '0.85em' }}>
                    {new Date(request.REQUESTED_AT).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.85em' }}>
                    {request.DECISION_DATE ? (
                      <div>
                        <div style={{ fontWeight: '500' }}>{request.APPROVER}</div>
                        <div style={{ color: '#6c757d' }}>
                          {new Date(request.DECISION_DATE).toLocaleDateString()}
                        </div>
                        {request.DECISION_COMMENT && (
                          <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#6c757d' }}>
                            "{request.DECISION_COMMENT}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#6c757d', fontStyle: 'italic' }}>Pending review</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyRequestsView;
