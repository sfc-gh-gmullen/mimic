import React, { useState, useEffect } from 'react';
import AccessRequestModal from './AccessRequestModal';
import Modal from './Modal';

interface TableDetailProps {
  table: {
    DATABASE_NAME: string;
    SCHEMA_NAME: string;
    TABLE_NAME: string;
    FULL_TABLE_NAME: string;
    TABLE_TYPE: string;
    ROW_COUNT: number;
    SIZE_GB: number;
    CREATED: string;
    LAST_ALTERED: string;
    SYSTEM_COMMENT: string;
    USER_DESCRIPTION: string;
    AVG_RATING: number;
    RATING_COUNT: number;
  };
  onBack: () => void;
}

interface Column {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COMMENT: string;
  ORDINAL_POSITION: number;
}

interface Comment {
  COMMENT_ID: string;
  USER_NAME: string;
  COMMENT_TEXT: string;
  CREATED_AT: string;
}

interface Tag {
  TAG_ID: string;
  TAG_NAME: string;
  CREATED_BY: string;
  CREATED_AT: string;
}

interface LineageNode {
  LINEAGE_ID: string;
  SOURCE_TABLE: string;
  TARGET_TABLE: string;
  LINEAGE_TYPE: string;
  DISCOVERED_AT: string;
}

const TableDetailView: React.FC<TableDetailProps> = ({ table, onBack }) => {
  const [activeTab, setActiveTab] = useState<'metadata' | 'schema' | 'activity' | 'lineage'>('metadata');
  const [columns, setColumns] = useState<Column[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [lineage, setLineage] = useState<LineageNode[]>([]);
  const [columnAttributes, setColumnAttributes] = useState<any[]>([]);
  const [allAttributes, setAllAttributes] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [description, setDescription] = useState(table.USER_DESCRIPTION || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [justification, setJustification] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingColumnDesc, setEditingColumnDesc] = useState<string | null>(null);
  const [linkingAttribute, setLinkingAttribute] = useState<string | null>(null);
  
  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning' | 'prompt';
    onConfirm?: (value?: string) => void;
    showInput?: boolean;
    inputPlaceholder?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [modalInput, setModalInput] = useState('');

  // Modal helper functions
  const showMessage = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
      showInput: false
    });
  };

  const showPrompt = (title: string, message: string, placeholder: string, onConfirm: (value?: string) => void) => {
    setModalInput('');
    setModal({
      isOpen: true,
      title,
      message,
      type: 'prompt',
      showInput: true,
      inputPlaceholder: placeholder,
      onConfirm
    });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    setModalInput('');
  };

  useEffect(() => {
    fetchColumns();
    fetchComments();
    fetchTags();
    fetchAvailableTags();
    fetchLineage();
    fetchColumnAttributes();
    fetchAllAttributes();
    fetchContacts();
    trackPopularity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchColumns = async () => {
    try {
      const response = await fetch(`/api/columns/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}`);
      const result = await response.json();
      if (result.success) {
        setColumns(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch columns:', err);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(table.FULL_TABLE_NAME)}`);
      const result = await response.json();
      if (result.success) {
        setComments(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch(`/api/tags/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}`);
      const result = await response.json();
      if (result.success) {
        setTags(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await fetch('/api/tags');
      const result = await response.json();
      if (result.success) {
        setAvailableTags(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch available tags:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await fetch(`/api/contacts/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}`);
      const result = await response.json();
      if (result.success) {
        setContacts(result.data || []);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      setContacts([]);
    }
  };

  const fetchLineage = async () => {
    try {
      const response = await fetch(`/api/lineage/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}`);
      const result = await response.json();
      if (result.success) {
        setLineage(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch lineage:', err);
    }
  };

  const trackPopularity = async () => {
    try {
      await fetch(`/api/popularity/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to track popularity:', err);
    }
  };

  const fetchColumnAttributes = async () => {
    try {
      const response = await fetch(`/api/columns/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}/attributes`);
      const result = await response.json();
      if (result.success) {
        setColumnAttributes(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch column attributes:', err);
    }
  };

  const fetchAllAttributes = async () => {
    try {
      const response = await fetch('/api/attributes');
      const result = await response.json();
      if (result.success) {
        setAllAttributes(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch all attributes:', err);
    }
  };

  const handleLinkAttribute = async (columnName: string, attributeName: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/columns/link-attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableFullName: table.FULL_TABLE_NAME,
          columnName: columnName,
          attributeName: attributeName
        })
      });
      const result = await response.json();
      if (result.success) {
        showMessage('Success', 'Attribute linked successfully!', 'success');
        setLinkingAttribute(null);
        fetchColumnAttributes(); // Refresh
      } else {
        showMessage('Error', 'Failed to link attribute: ' + result.error, 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to link attribute', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkAttribute = async (columnName: string, attributeName: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/columns/unlink-attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableFullName: table.FULL_TABLE_NAME,
          columnName: columnName,
          attributeName: attributeName
        })
      });
      const result = await response.json();
      if (result.success) {
        showMessage('Success', 'Attribute unlinked successfully!', 'success');
        fetchColumnAttributes(); // Refresh
      } else {
        showMessage('Error', 'Failed to unlink attribute: ' + result.error, 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to unlink attribute', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!justification.trim()) {
      showMessage('Error', 'Please provide a justification for this change', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/description/${encodeURIComponent(table.FULL_TABLE_NAME)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, justification })
      });
      const result = await response.json();
      if (result.success) {
        setIsEditingDescription(false);
        setJustification('');
        showMessage('Success', 'Description change request submitted for approval', 'success');
      } else {
        showMessage('Error', 'Failed to submit request: ' + result.error, 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to submit description change', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: table.FULL_TABLE_NAME, comment: newComment })
      });
      const result = await response.json();
      if (result.success) {
        setNewComment('');
        fetchComments();
      } else {
        showMessage('Error', 'Failed to add comment: ' + result.error, 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to add comment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tagName?: string) => {
    const tagToAdd = tagName || newTag;
    if (!tagToAdd.trim()) return;
    
    showPrompt(
      'Add Tag Justification',
      `Please provide a justification for adding the tag "${tagToAdd}":`,
      'Enter justification...',
      async (justification) => {
        if (!justification || !justification.trim()) {
          showMessage('Error', 'Justification is required', 'error');
          return;
        }
        
        setLoading(true);
        try {
          const response = await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              tableFullName: table.FULL_TABLE_NAME, 
              tagName: tagToAdd,
              justification
            })
          });
          const result = await response.json();
          if (result.success) {
            setNewTag('');
            setTagSearch('');
            setShowTagDropdown(false);
            showMessage('Success', 'Tag change request submitted for approval', 'success');
          } else {
            showMessage('Error', 'Failed to submit request: ' + result.error, 'error');
          }
        } catch (err) {
          showMessage('Error', 'Failed to submit tag request', 'error');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const filteredAvailableTags = (availableTags || []).filter(tag =>
    tag.TAG_NAME && tag.TAG_NAME.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const handleDeleteTag = async (tagId: string) => {
    showPrompt(
      'Remove Tag Justification',
      'Please provide a justification for removing this tag:',
      'Enter justification...',
      async (justification) => {
        if (!justification || !justification.trim()) {
          showMessage('Error', 'Justification is required', 'error');
          return;
        }
        
        setLoading(true);
        try {
          const response = await fetch(`/api/tags/${tagId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ justification })
          });
          const result = await response.json();
          if (result.success) {
            showMessage('Success', 'Tag removal request submitted for approval', 'success');
          } else {
            showMessage('Error', 'Failed to submit request: ' + result.error, 'error');
          }
        } catch (err) {
          showMessage('Error', 'Failed to submit tag removal request', 'error');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleRating = async (rating: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: table.FULL_TABLE_NAME, rating })
      });
      const result = await response.json();
      if (result.success) {
        setUserRating(rating);
        showMessage('Success', 'Rating submitted successfully', 'success');
      } else {
        showMessage('Error', 'Failed to submit rating: ' + result.error, 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to submit rating', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span 
          key={i} 
          style={{ 
            color: i <= rating ? '#ffc107' : '#e0e0e0',
            cursor: interactive ? 'pointer' : 'default',
            fontSize: '1.5em'
          }}
          onClick={interactive ? () => handleRating(i) : undefined}
          onMouseEnter={interactive ? (e) => { e.currentTarget.style.color = '#ffc107'; } : undefined}
          onMouseLeave={interactive ? (e) => { if (i > rating) e.currentTarget.style.color = '#e0e0e0'; } : undefined}
        >
          ★
        </span>
      );
    }
    return stars;
  };

  return (
    <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', maxWidth: '100%', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={onBack}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            marginBottom: '16px'
          }}
        >
          ← Back to Catalog
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h2 style={{ margin: '0 0 8px 0' }}>{table.TABLE_NAME}</h2>
            <div style={{ color: '#6c757d', fontSize: '0.9em' }}>
              {table.DATABASE_NAME}.{table.SCHEMA_NAME}
            </div>
          </div>
          
          {/* Contacts Section */}
          {contacts && contacts.length > 0 && (
            <div style={{ 
              flex: 1,
              minWidth: '250px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ fontWeight: '600', fontSize: '0.9em', marginBottom: '8px', color: '#495057' }}>
                📞 Table Contacts
              </div>
              {contacts.map((contact, idx) => (
                <div key={idx} style={{ fontSize: '0.85em', color: '#6c757d', marginBottom: '4px' }}>
                  <strong>{contact.PURPOSE}:</strong> {contact.METHOD}
                  {contact.INHERITED && <span style={{ fontStyle: 'italic' }}> (inherited)</span>}
                </div>
              ))}
            </div>
          )}
          
          <button 
            onClick={() => setShowAccessModal(true)}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              height: 'fit-content'
            }}
          >
            🔐 Request Access
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '2px solid #e9ecef',
        marginBottom: '20px'
      }}>
        {(['metadata', 'schema', 'lineage', 'activity'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #007bff' : 'none',
              color: activeTab === tab ? '#007bff' : '#6c757d',
              fontWeight: activeTab === tab ? '600' : 'normal',
              marginBottom: '-2px'
            }}
          >
            {tab === 'metadata' && '📊 Metadata'}
            {tab === 'schema' && '📋 Schema & Glossary'}
            {tab === 'lineage' && '🔗 Lineage'}
            {tab === 'activity' && '💬 Activity'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'metadata' && (
        <div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85em', color: '#6c757d', marginBottom: '4px' }}>Type</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600' }}>
                {table.TABLE_TYPE === 'BASE TABLE' ? 'Table' : 'View'}
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85em', color: '#6c757d', marginBottom: '4px' }}>Row Count</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600' }}>
                {table.ROW_COUNT?.toLocaleString() || 'N/A'}
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85em', color: '#6c757d', marginBottom: '4px' }}>Size</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600' }}>
                {table.SIZE_GB ? `${table.SIZE_GB} GB` : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85em', color: '#6c757d', marginBottom: '4px' }}>Last Modified</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600' }}>
                {table.LAST_ALTERED ? new Date(table.LAST_ALTERED).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {table.SYSTEM_COMMENT && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1em', marginBottom: '8px' }}>System Description</h3>
              <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                {table.SYSTEM_COMMENT}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1em', margin: 0 }}>User Description</h3>
              {!isEditingDescription && (
                <button 
                  onClick={() => setIsEditingDescription(true)}
                  style={{ 
                    padding: '4px 12px', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '0.85em'
                  }}
                >
                  ✏️ Edit
                </button>
              )}
            </div>
            {isEditingDescription ? (
              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ 
                    width: '100%', 
                    minHeight: '100px', 
                    padding: '12px', 
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    marginBottom: '8px'
                  }}
                  placeholder="Add a description for this table..."
                />
                <input
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '0.9em'
                  }}
                  placeholder="Justification for this change (required)..."
                />
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={handleSaveDescription}
                    disabled={loading}
                    style={{ 
                      padding: '8px 16px', 
                      backgroundColor: '#28a745', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Submit for Approval
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditingDescription(false);
                      setDescription(table.USER_DESCRIPTION || '');
                      setJustification('');
                    }}
                    style={{ 
                      padding: '8px 16px', 
                      backgroundColor: '#6c757d', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                {description || <em style={{ color: '#6c757d' }}>No user description yet. Click Edit to add one.</em>}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '1em', marginBottom: '12px' }}>Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {tags.map(tag => (
                <span 
                  key={tag.TAG_ID}
                  style={{ 
                    padding: '6px 12px',
                    backgroundColor: '#e7f3ff',
                    color: '#004085',
                    borderRadius: '16px',
                    fontSize: '0.85em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  🏷️ {tag.TAG_NAME}
                  <button
                    onClick={() => handleDeleteTag(tag.TAG_ID)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#004085',
                      cursor: 'pointer',
                      padding: '0',
                      fontSize: '1.2em',
                      lineHeight: '1'
                    }}
                    title="Remove tag"
                  >
                    ×
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <em style={{ color: '#6c757d', fontSize: '0.9em' }}>No tags yet</em>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => {
                    setTagSearch(e.target.value);
                    setShowTagDropdown(true);
                  }}
                  onFocus={() => setShowTagDropdown(true)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && tagSearch.trim()) {
                      handleAddTag(tagSearch);
                    }
                  }}
                  placeholder="Search or type a new tag..."
                  style={{ 
                    flex: 1,
                    padding: '8px 12px',
                    border: '2px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '0.9em'
                  }}
                />
                <button
                  onClick={() => handleAddTag(tagSearch)}
                  disabled={loading || !tagSearch.trim()}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading || !tagSearch.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '0.9em',
                    opacity: loading || !tagSearch.trim() ? 0.6 : 1
                  }}
                >
                  Add Tag
                </button>
              </div>
              
              {/* Tag Dropdown */}
              {showTagDropdown && filteredAvailableTags.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: '100px',
                  backgroundColor: 'white',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  marginTop: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                  {filteredAvailableTags.map((tag, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setTagSearch(tag.TAG_NAME);
                        setShowTagDropdown(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: idx < filteredAvailableTags.length - 1 ? '1px solid #f0f0f0' : 'none',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500', color: '#212529' }}>🏷️ {tag.TAG_NAME}</div>
                      {tag.COUNT > 0 && (
                        <div style={{ fontSize: '0.8em', color: '#6c757d', marginTop: '2px' }}>
                          Used in {tag.COUNT} tables
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schema' && (
        <div>
          <h3 style={{ fontSize: '1em', marginBottom: '16px' }}>Columns & Business Glossary ({columns.length})</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            {columns.map(col => {
              const colAttrs = columnAttributes.filter(attr => attr.COLUMN_NAME === col.COLUMN_NAME);
              const isEditingThisCol = editingColumnDesc === col.COLUMN_NAME;
              
              return (
                <div 
                  key={col.COLUMN_NAME}
                  style={{ 
                    border: '2px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '16px',
                    backgroundColor: colAttrs.length > 0 ? '#f8f9fa' : 'white'
                  }}
                >
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '600', fontSize: '1.05em', color: '#212529' }}>
                          {col.COLUMN_NAME}
                        </span>
                        <span style={{ 
                          padding: '2px 8px',
                          backgroundColor: '#e7f3ff',
                          color: '#004085',
                          borderRadius: '12px',
                          fontSize: '0.75em',
                          fontWeight: '600'
                        }}>
                          {col.DATA_TYPE}
                        </span>
                        <span style={{ 
                          padding: '2px 8px', 
                          backgroundColor: col.IS_NULLABLE === 'YES' ? '#fff3cd' : '#d4edda',
                          color: col.IS_NULLABLE === 'YES' ? '#856404' : '#155724',
                          borderRadius: '12px',
                          fontSize: '0.75em',
                          fontWeight: '600'
                        }}>
                          {col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}
                        </span>
                      </div>
                      
                      {/* Column Description */}
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '0.85em', fontWeight: '600', color: '#6c757d', marginBottom: '4px' }}>
                          Description:
                        </div>
                        {isEditingThisCol ? (
                          <div>
                            <textarea
                              defaultValue={col.COMMENT || ''}
                              placeholder="Enter column description..."
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '2px solid #667eea',
                                borderRadius: '8px',
                                fontSize: '0.9em',
                                minHeight: '80px',
                                fontFamily: 'inherit',
                                marginBottom: '8px'
                              }}
                              id={`col-desc-${col.COLUMN_NAME}`}
                            />
                            <input
                              type="text"
                              placeholder="Justification for change (required)..."
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ced4da',
                                borderRadius: '8px',
                                fontSize: '0.85em',
                                marginBottom: '8px'
                              }}
                              id={`col-just-${col.COLUMN_NAME}`}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={async () => {
                                  const descElem = document.getElementById(`col-desc-${col.COLUMN_NAME}`) as HTMLTextAreaElement;
                                  const justElem = document.getElementById(`col-just-${col.COLUMN_NAME}`) as HTMLInputElement;
                                  const newDesc = descElem?.value || '';
                                  const just = justElem?.value || '';
                                  
                                  if (!just.trim()) {
                                    showMessage('Error', 'Please provide a justification', 'error');
                                    return;
                                  }
                                  
                                  // Submit column description change request
                                  try {
                                    const response = await fetch('/api/change-requests', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        requestType: 'COLUMN_DESCRIPTION',
                                        targetObject: `${table.FULL_TABLE_NAME}.${col.COLUMN_NAME}`,
                                        justification: just,
                                        proposedChange: { description: newDesc },
                                        currentValue: { description: col.COMMENT || '' }
                                      })
                                    });
                                    const result = await response.json();
                                    if (result.success) {
                                      showMessage('Success', 'Column description change request submitted for approval', 'success');
                                      setEditingColumnDesc(null);
                                    } else {
                                      showMessage('Error', 'Failed to submit request: ' + result.error, 'error');
                                    }
                                  } catch (err) {
                                    showMessage('Error', 'Failed to submit change request', 'error');
                                  }
                                }}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.85em',
                                  fontWeight: '600'
                                }}
                              >
                                Submit for Approval
                              </button>
                              <button
                                onClick={() => setEditingColumnDesc(null)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#6c757d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.85em'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                            <div style={{ flex: 1, fontSize: '0.9em', color: '#495057' }}>
                              {col.COMMENT || <em style={{ color: '#6c757d' }}>No description</em>}
                            </div>
                            <button
                              onClick={() => setEditingColumnDesc(col.COLUMN_NAME)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#667eea',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8em',
                                fontWeight: '600'
                              }}
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Glossary Attribute Section */}
                  <div style={{ marginTop: '12px' }}>
                    {/* Display linked attributes */}
                    {colAttrs.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.85em', fontWeight: '600', color: '#667eea', marginBottom: '8px' }}>
                          🏷️ Business Glossary Attributes ({colAttrs.length}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {colAttrs.map(attr => (
                            <div 
                              key={attr.ATTRIBUTE_NAME}
                              style={{ 
                                padding: '12px',
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                border: '1px solid #667eea'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>
                                    {attr.DISPLAY_NAME}
                                  </div>
                                  <div style={{ fontSize: '0.85em', color: '#6c757d', marginBottom: '8px' }}>
                                    {attr.DESCRIPTION}
                                  </div>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/attributes/${attr.ATTRIBUTE_NAME}/enumerations`);
                                        const result = await response.json();
                                        if (result.success && result.data.length > 0) {
                                          const valuesList = result.data.map((e: any) => 
                                            `• ${e.VALUE_CODE}: ${e.VALUE_DESCRIPTION}`
                                          ).join('\n\n');
                                          showMessage(
                                            `Enumerated Values for ${attr.DISPLAY_NAME}`,
                                            valuesList,
                                            'info'
                                          );
                                        } else {
                                          showMessage('No Values', 'No enumerated values defined for this attribute', 'info');
                                        }
                                      } catch (err) {
                                        showMessage('Error', 'Failed to fetch enumerated values', 'error');
                                      }
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      backgroundColor: '#667eea',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '0.8em',
                                      fontWeight: '600'
                                    }}
                                  >
                                    View Values
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleUnlinkAttribute(col.COLUMN_NAME, attr.ATTRIBUTE_NAME)}
                                  disabled={loading}
                                  title="Remove this attribute"
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.75em',
                                    opacity: loading ? 0.6 : 1
                                  }}
                                >
                                  Unlink
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Link new attribute UI */}
                    {linkingAttribute === col.COLUMN_NAME ? (
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #dee2e6'
                      }}>
                        <div style={{ fontSize: '0.85em', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
                          Link Business Glossary Attribute:
                        </div>
                        <select
                          id={`attr-select-${col.COLUMN_NAME}`}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '2px solid #667eea',
                            borderRadius: '8px',
                            fontSize: '0.9em',
                            marginBottom: '8px'
                          }}
                        >
                          <option value="">-- Select an attribute --</option>
                          {allAttributes
                            .filter(attr => !colAttrs.some(ca => ca.ATTRIBUTE_NAME === attr.ATTRIBUTE_NAME))
                            .map(attr => (
                              <option key={attr.ATTRIBUTE_NAME} value={attr.ATTRIBUTE_NAME}>
                                {attr.DISPLAY_NAME} ({attr.ATTRIBUTE_NAME})
                              </option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              const select = document.getElementById(`attr-select-${col.COLUMN_NAME}`) as HTMLSelectElement;
                              const attrName = select?.value;
                              if (attrName) {
                                handleLinkAttribute(col.COLUMN_NAME, attrName);
                              } else {
                                showMessage('Error', 'Please select an attribute', 'error');
                              }
                            }}
                            disabled={loading}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontSize: '0.85em',
                              fontWeight: '600',
                              opacity: loading ? 0.6 : 1
                            }}
                          >
                            Link Attribute
                          </button>
                          <button
                            onClick={() => setLinkingAttribute(null)}
                            disabled={loading}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontSize: '0.85em'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLinkingAttribute(col.COLUMN_NAME)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.8em',
                          fontWeight: '600'
                        }}
                      >
                        + Link Glossary Attribute
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'lineage' && (
        <div>
          <h3 style={{ fontSize: '1em', marginBottom: '16px' }}>Data Lineage</h3>
          {lineage.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              <div style={{ fontSize: '3em', marginBottom: '10px' }}>🔗</div>
              <div>No lineage information available</div>
              <div style={{ fontSize: '0.85em', marginTop: '8px' }}>
                Lineage data is automatically discovered from query logs
              </div>
            </div>
          ) : (
            <div>
              {/* Upstream Sources */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ fontSize: '0.95em', color: '#6c757d', marginBottom: '12px' }}>
                  ⬅️ Upstream Sources ({lineage.filter(l => l.TARGET_TABLE === table.FULL_TABLE_NAME).length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lineage.filter(l => l.TARGET_TABLE === table.FULL_TABLE_NAME).map(node => (
                    <div 
                      key={node.LINEAGE_ID}
                      style={{ 
                        padding: '12px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5em' }}>📊</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#007bff' }}>{node.SOURCE_TABLE}</div>
                          <div style={{ fontSize: '0.85em', color: '#6c757d', marginTop: '4px' }}>
                            Type: {node.LINEAGE_TYPE} • Discovered: {new Date(node.DISCOVERED_AT).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {lineage.filter(l => l.TARGET_TABLE === table.FULL_TABLE_NAME).length === 0 && (
                    <div style={{ padding: '12px', color: '#6c757d', fontSize: '0.9em' }}>
                      No upstream sources found
                    </div>
                  )}
                </div>
              </div>

              {/* Downstream Targets */}
              <div>
                <h4 style={{ fontSize: '0.95em', color: '#6c757d', marginBottom: '12px' }}>
                  ➡️ Downstream Targets ({lineage.filter(l => l.SOURCE_TABLE === table.FULL_TABLE_NAME).length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lineage.filter(l => l.SOURCE_TABLE === table.FULL_TABLE_NAME).map(node => (
                    <div 
                      key={node.LINEAGE_ID}
                      style={{ 
                        padding: '12px',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5em' }}>📈</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#007bff' }}>{node.TARGET_TABLE}</div>
                          <div style={{ fontSize: '0.85em', color: '#6c757d', marginTop: '4px' }}>
                            Type: {node.LINEAGE_TYPE} • Discovered: {new Date(node.DISCOVERED_AT).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {lineage.filter(l => l.SOURCE_TABLE === table.FULL_TABLE_NAME).length === 0 && (
                    <div style={{ padding: '12px', color: '#6c757d', fontSize: '0.9em' }}>
                      No downstream targets found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div>
          {/* Rating Section */}
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1em', marginBottom: '12px' }}>Rate this table</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>{renderStars(userRating, true)}</div>
              <div style={{ color: '#6c757d', fontSize: '0.9em' }}>
                Average: {table.AVG_RATING.toFixed(1)} ({table.RATING_COUNT} rating{table.RATING_COUNT !== 1 ? 's' : ''})
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 style={{ fontSize: '1em', marginBottom: '12px' }}>Comments</h3>
            
            {/* Add Comment */}
            <div style={{ marginBottom: '20px' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                style={{ 
                  width: '100%', 
                  minHeight: '80px', 
                  padding: '12px', 
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '0.9em'
                }}
              />
              <button 
                onClick={handleAddComment}
                disabled={loading || !newComment.trim()}
                style={{ 
                  marginTop: '8px',
                  padding: '8px 16px', 
                  backgroundColor: '#007bff', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: loading || !newComment.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Post Comment
              </button>
            </div>

            {/* Comments List */}
            <div>
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d', fontStyle: 'italic' }}>
                  No comments yet. Be the first to comment!
                </div>
              ) : (
                comments.map(comment => (
                  <div 
                    key={comment.COMMENT_ID}
                    style={{ 
                      padding: '12px', 
                      border: '1px solid #e9ecef',
                      borderRadius: '4px',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9em' }}>{comment.USER_NAME}</div>
                      <div style={{ color: '#6c757d', fontSize: '0.85em' }}>
                        {new Date(comment.CREATED_AT).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9em' }}>{comment.COMMENT_TEXT}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Access Request Modal */}
      {showAccessModal && (
        <AccessRequestModal 
          tableName={table.FULL_TABLE_NAME}
          onClose={() => setShowAccessModal(false)}
        />
      )}

      {/* General Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      >
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
          {modal.message}
        </div>
        {modal.showInput && (
          <div style={{ marginTop: '16px' }}>
            <textarea
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder={modal.inputPlaceholder}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #667eea',
                borderRadius: '8px',
                fontSize: '0.95em',
                minHeight: '80px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              autoFocus
            />
          </div>
        )}
        <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {modal.showInput && modal.onConfirm ? (
            <>
              <button
                onClick={() => {
                  if (modal.onConfirm) {
                    modal.onConfirm(modalInput);
                  }
                  closeModal();
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95em'
                }}
              >
                Submit
              </button>
              <button
                onClick={closeModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95em'
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={closeModal}
              style={{
                padding: '10px 20px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95em'
              }}
            >
              OK
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TableDetailView;
