import React, { useState, useEffect } from 'react';
import AccessRequestModal from './AccessRequestModal';
import Modal from './Modal';
import LineageGraph from './LineageGraph';
import DataPreview from './DataPreview';
import { useTheme } from '../ThemeContext';

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
  SOURCE_TABLE: string;
  SOURCE_DATABASE: string;
  SOURCE_SCHEMA: string;
  SOURCE_NAME: string;
  SOURCE_DOMAIN: string;
  TARGET_TABLE: string;
  TARGET_DATABASE: string;
  TARGET_SCHEMA: string;
  TARGET_NAME: string;
  TARGET_DOMAIN: string;
  LINEAGE_TYPE: 'UPSTREAM' | 'DOWNSTREAM';
  DISTANCE: number;
}

const TableDetailView: React.FC<TableDetailProps> = ({ table, onBack }) => {
  const { colors, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'metadata' | 'schema' | 'preview' | 'activity' | 'lineage'>('metadata');
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
  
  // Data Product state
  const [currentDataProduct, setCurrentDataProduct] = useState<string | null>(null);
  const [availableDataProducts, setAvailableDataProducts] = useState<string[]>([]);
  const [selectedDataProduct, setSelectedDataProduct] = useState('');
  const [newDataProductName, setNewDataProductName] = useState('');
  const [showDataProductDropdown, setShowDataProductDropdown] = useState(false);
  const [dataProductLoading, setDataProductLoading] = useState(false);

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
    fetchCurrentDataProduct();
    fetchAvailableDataProducts();
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

  // Data Product fetch functions
  const fetchCurrentDataProduct = async () => {
    try {
      const response = await fetch(`/api/tables/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}/data-product`);
      const result = await response.json();
      if (result.success && result.data) {
        setCurrentDataProduct(result.data.dataProduct);
        setSelectedDataProduct(result.data.dataProduct || '');
      }
    } catch (err) {
      console.error('Failed to fetch current data product:', err);
    }
  };

  const fetchAvailableDataProducts = async () => {
    try {
      const response = await fetch('/api/data-products');
      const result = await response.json();
      if (result.success) {
        setAvailableDataProducts(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch available data products:', err);
    }
  };

  const handleSetDataProduct = async (productName: string, isNewProduct: boolean = false) => {
    if (!productName.trim()) return;
    
    setDataProductLoading(true);
    try {
      const response = await fetch(`/api/tables/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}/data-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataProduct: productName.trim() })
      });
      const result = await response.json();
      if (result.success) {
        const trimmedName = productName.trim();
        setCurrentDataProduct(trimmedName);
        setNewDataProductName('');
        
        // For new products, immediately add to local state (Snowflake metadata may take time to update)
        if (isNewProduct && !availableDataProducts.includes(trimmedName)) {
          setAvailableDataProducts(prev => [...prev, trimmedName].sort());
        }
        
        // Also refresh from API (may get additional products from other sources)
        await fetchAvailableDataProducts();
        setSelectedDataProduct(trimmedName);
        
        if (isNewProduct) {
          // For new products, keep dropdown open so user can see it was added
          showMessage('Success', `Created "${trimmedName}" and assigned to this ${table.TABLE_TYPE === 'BASE TABLE' ? 'table' : 'view'}. The new Data Product is now available for other tables.`, 'success');
        } else {
          setShowDataProductDropdown(false);
          showMessage('Success', result.message, 'success');
        }
      } else {
        showMessage('Error', result.error || 'Failed to set Data Product', 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to set Data Product', 'error');
    } finally {
      setDataProductLoading(false);
    }
  };

  const handleRemoveDataProduct = async () => {
    setDataProductLoading(true);
    try {
      const response = await fetch(`/api/tables/${table.DATABASE_NAME}/${table.SCHEMA_NAME}/${table.TABLE_NAME}/data-product`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        setCurrentDataProduct(null);
        setSelectedDataProduct('');
        showMessage('Success', result.message, 'success');
      } else {
        showMessage('Error', result.error || 'Failed to remove Data Product', 'error');
      }
    } catch (err) {
      showMessage('Error', 'Failed to remove Data Product', 'error');
    } finally {
      setDataProductLoading(false);
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
    <div style={{ background: colors.surface, borderRadius: '8px', padding: '20px', boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)', maxWidth: '100%', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={onBack}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: colors.primary, 
            color: colors.primaryText, 
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
            <h2 style={{ margin: '0 0 8px 0', color: colors.text }}>{table.TABLE_NAME}</h2>
            <div style={{ color: colors.textMuted, fontSize: '0.9em' }}>
              {table.DATABASE_NAME}.{table.SCHEMA_NAME}
            </div>
          </div>
          
          {/* Contacts Section */}
          {contacts && contacts.length > 0 && (
            <div style={{ 
              flex: 1,
              minWidth: '250px',
              padding: '12px',
              backgroundColor: colors.cardBg,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ fontWeight: '600', fontSize: '0.9em', marginBottom: '8px', color: colors.textSecondary }}>
                📞 Table Contacts
              </div>
              {contacts.map((contact, idx) => (
                <div key={idx} style={{ fontSize: '0.85em', color: colors.textMuted, marginBottom: '4px' }}>
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
              backgroundColor: colors.primary, 
              color: colors.primaryText, 
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
        borderBottom: `2px solid ${colors.border}`,
        marginBottom: '20px'
      }}>
        {(['metadata', 'schema', 'preview', 'lineage', 'activity'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? `2px solid ${colors.primary}` : 'none',
              color: activeTab === tab ? colors.primary : colors.textMuted,
              fontWeight: activeTab === tab ? '600' : 'normal',
              marginBottom: '-2px'
            }}
          >
            {tab === 'metadata' && '📊 Metadata'}
            {tab === 'schema' && '📋 Schema & Glossary'}
            {tab === 'preview' && '👁️ Data Preview'}
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
            <div style={{ padding: '15px', backgroundColor: colors.cardBg, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: '0.85em', color: colors.textMuted, marginBottom: '4px' }}>Type</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600', color: colors.text }}>
                {table.TABLE_TYPE === 'BASE TABLE' ? 'Table' : 'View'}
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: colors.cardBg, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: '0.85em', color: colors.textMuted, marginBottom: '4px' }}>Row Count</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600', color: colors.text }}>
                {table.ROW_COUNT?.toLocaleString() || 'N/A'}
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: colors.cardBg, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: '0.85em', color: colors.textMuted, marginBottom: '4px' }}>Size</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600', color: colors.text }}>
                {table.SIZE_GB ? `${table.SIZE_GB} GB` : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: colors.cardBg, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: '0.85em', color: colors.textMuted, marginBottom: '4px' }}>Last Modified</div>
              <div style={{ fontSize: '1.1em', fontWeight: '600', color: colors.text }}>
                {table.LAST_ALTERED ? new Date(table.LAST_ALTERED).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Data Product Section */}
          <div style={{ 
            marginBottom: '24px', 
            padding: '20px', 
            backgroundColor: colors.surface,
            borderRadius: '8px',
            border: `2px solid ${colors.border}`
          }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '12px' }}>
              📦 Data Product
            </label>
            
            {currentDataProduct && !showDataProductDropdown ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '8px 16px',
                  backgroundColor: colors.primary,
                  color: colors.primaryText,
                  borderRadius: '20px',
                  fontWeight: '600',
                  fontSize: '0.95em'
                }}>
                  {currentDataProduct}
                </span>
                <button
                  onClick={() => setShowDataProductDropdown(true)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: colors.primary,
                    border: `1px solid ${colors.primary}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85em'
                  }}
                >
                  Change
                </button>
                <button
                  onClick={handleRemoveDataProduct}
                  disabled={dataProductLoading}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: colors.error,
                    border: `1px solid ${colors.error}`,
                    borderRadius: '4px',
                    cursor: dataProductLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.85em',
                    opacity: dataProductLoading ? 0.6 : 1
                  }}
                >
                  {dataProductLoading ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ) : !showDataProductDropdown ? (
              <div>
                <p style={{ color: colors.textMuted, marginBottom: '12px', fontSize: '0.9em' }}>
                  This {table.TABLE_TYPE === 'BASE TABLE' ? 'table' : 'view'} is not assigned to a Data Product.
                </p>
                <button
                  onClick={() => setShowDataProductDropdown(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: colors.primary,
                    color: colors.primaryText,
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  + Add to Data Product
                </button>
              </div>
            ) : null}

            {/* Data Product Dropdown/Modal */}
            {showDataProductDropdown && (
              <div style={{
                padding: '16px',
                backgroundColor: colors.cardBg,
                borderRadius: '8px',
                border: `2px solid ${colors.primary}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9em', color: colors.textSecondary }}>
                    Select Existing Data Product
                  </label>
                  <select
                    value={selectedDataProduct}
                    onChange={(e) => setSelectedDataProduct(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `2px solid ${colors.inputBorder}`,
                      backgroundColor: colors.inputBg,
                      color: selectedDataProduct ? colors.text : colors.textMuted,
                      fontSize: '0.95em',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">-- Select a Data Product --</option>
                    {availableDataProducts.map(dp => (
                      <option key={dp} value={dp}>{dp}</option>
                    ))}
                  </select>
                  {selectedDataProduct && selectedDataProduct !== currentDataProduct && (
                    <button
                      onClick={() => handleSetDataProduct(selectedDataProduct)}
                      disabled={dataProductLoading}
                      style={{
                        marginTop: '8px',
                        padding: '8px 16px',
                        backgroundColor: colors.success,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: dataProductLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.9em',
                        fontWeight: '600',
                        opacity: dataProductLoading ? 0.6 : 1
                      }}
                    >
                      {dataProductLoading ? 'Saving...' : 'Apply'}
                    </button>
                  )}
                </div>

                <div style={{ 
                  borderTop: `1px solid ${colors.border}`, 
                  paddingTop: '16px',
                  marginTop: '16px'
                }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '0.9em', color: colors.textSecondary }}>
                    Or Create New Data Product
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newDataProductName}
                      onChange={(e) => setNewDataProductName(e.target.value)}
                      placeholder="Enter new Data Product name..."
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `2px solid ${colors.inputBorder}`,
                        backgroundColor: colors.inputBg,
                        color: colors.text,
                        fontSize: '0.95em'
                      }}
                    />
                    <button
                      onClick={() => handleSetDataProduct(newDataProductName, true)}
                      disabled={dataProductLoading || !newDataProductName.trim()}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: newDataProductName.trim() ? colors.primary : colors.inputBorder,
                        color: colors.primaryText,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (dataProductLoading || !newDataProductName.trim()) ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        opacity: (dataProductLoading || !newDataProductName.trim()) ? 0.6 : 1
                      }}
                    >
                      Create & Add
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setShowDataProductDropdown(false);
                      setNewDataProductName('');
                      setSelectedDataProduct(currentDataProduct || '');
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      color: colors.textMuted,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85em'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {table.SYSTEM_COMMENT && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1em', marginBottom: '8px', color: colors.text }}>System Description</h3>
              <div style={{ padding: '12px', backgroundColor: colors.cardBg, borderRadius: '4px', border: `1px solid ${colors.border}`, color: colors.text }}>
                {table.SYSTEM_COMMENT}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1em', margin: 0, color: colors.text }}>User Description</h3>
              {!isEditingDescription && (
                <button 
                  onClick={() => setIsEditingDescription(true)}
                  style={{ 
                    padding: '4px 12px', 
                    backgroundColor: colors.primary, 
                    color: colors.primaryText, 
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
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    marginBottom: '8px',
                    backgroundColor: colors.inputBg,
                    color: colors.text
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
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    backgroundColor: colors.inputBg,
                    color: colors.text
                  }}
                  placeholder="Justification for this change (required)..."
                />
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={handleSaveDescription}
                    disabled={loading}
                    style={{ 
                      padding: '8px 16px', 
                      backgroundColor: colors.success, 
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
                      backgroundColor: 'transparent', 
                      color: colors.textMuted, 
                      border: `1px solid ${colors.border}`, 
                      borderRadius: '4px', 
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px', backgroundColor: colors.cardBg, borderRadius: '4px', border: `1px solid ${colors.border}`, color: colors.text }}>
                {description || <em style={{ color: colors.textMuted }}>No user description yet. Click Edit to add one.</em>}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '1em', marginBottom: '12px', color: colors.text }}>Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {tags.map(tag => (
                <span 
                  key={tag.TAG_ID}
                  style={{ 
                    padding: '6px 12px',
                    backgroundColor: isDarkMode ? colors.primary + '30' : '#e7f3ff',
                    color: colors.primary,
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
                      color: colors.primary,
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
                <em style={{ color: colors.textMuted, fontSize: '0.9em' }}>No tags yet</em>
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
                    border: `2px solid ${colors.inputBorder}`,
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    backgroundColor: colors.inputBg,
                    color: colors.text
                  }}
                />
                <button
                  onClick={() => handleAddTag(tagSearch)}
                  disabled={loading || !tagSearch.trim()}
                  style={{ 
                    padding: '8px 16px',
                    backgroundColor: colors.primary,
                    color: colors.primaryText,
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
                  backgroundColor: colors.cardBg,
                  border: `2px solid ${colors.primary}`,
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
                        borderBottom: idx < filteredAvailableTags.length - 1 ? `1px solid ${colors.border}` : 'none',
                        transition: 'background-color 0.15s',
                        backgroundColor: colors.cardBg
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.surface}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.cardBg}
                    >
                      <div style={{ fontWeight: '500', color: colors.text }}>🏷️ {tag.TAG_NAME}</div>
                      {tag.COUNT > 0 && (
                        <div style={{ fontSize: '0.8em', color: colors.textMuted, marginTop: '2px' }}>
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
          <h3 style={{ fontSize: '1em', marginBottom: '16px', color: colors.text }}>Columns & Business Glossary ({columns.length})</h3>
          <div style={{ display: 'grid', gap: '16px' }}>
            {columns.map(col => {
              const colAttrs = columnAttributes.filter(attr => attr.COLUMN_NAME === col.COLUMN_NAME);
              const isEditingThisCol = editingColumnDesc === col.COLUMN_NAME;
              
              return (
                <div 
                  key={col.COLUMN_NAME}
                  style={{ 
                    border: `2px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '16px',
                    backgroundColor: colAttrs.length > 0 ? (isDarkMode ? colors.surface : '#f8f9fa') : colors.cardBg
                  }}
                >
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '600', fontSize: '1.05em', color: colors.text }}>
                          {col.COLUMN_NAME}
                        </span>
                        <span style={{ 
                          padding: '2px 8px',
                          backgroundColor: isDarkMode ? colors.primary + '30' : '#e7f3ff',
                          color: colors.primary,
                          borderRadius: '12px',
                          fontSize: '0.75em',
                          fontWeight: '600'
                        }}>
                          {col.DATA_TYPE}
                        </span>
                        <span style={{ 
                          padding: '2px 8px', 
                          backgroundColor: col.IS_NULLABLE === 'YES' ? (isDarkMode ? '#856404' + '40' : '#fff3cd') : (isDarkMode ? '#155724' + '40' : '#d4edda'),
                          color: col.IS_NULLABLE === 'YES' ? (isDarkMode ? '#ffc107' : '#856404') : (isDarkMode ? '#28a745' : '#155724'),
                          borderRadius: '12px',
                          fontSize: '0.75em',
                          fontWeight: '600'
                        }}>
                          {col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}
                        </span>
                      </div>
                      
                      {/* Column Description */}
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textMuted, marginBottom: '4px' }}>
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
                                border: `2px solid ${colors.primary}`,
                                borderRadius: '8px',
                                fontSize: '0.9em',
                                minHeight: '80px',
                                fontFamily: 'inherit',
                                marginBottom: '8px',
                                backgroundColor: colors.inputBg,
                                color: colors.text
                              }}
                              id={`col-desc-${col.COLUMN_NAME}`}
                            />
                            <input
                              type="text"
                              placeholder="Justification for change (required)..."
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: `1px solid ${colors.inputBorder}`,
                                borderRadius: '8px',
                                fontSize: '0.85em',
                                marginBottom: '8px',
                                backgroundColor: colors.inputBg,
                                color: colors.text
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
                                  backgroundColor: colors.success,
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
                                  backgroundColor: 'transparent',
                                  color: colors.textMuted,
                                  border: `1px solid ${colors.border}`,
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
                            <div style={{ flex: 1, fontSize: '0.9em', color: colors.textSecondary }}>
                              {col.COMMENT || <em style={{ color: colors.textMuted }}>No description</em>}
                            </div>
                            <button
                              onClick={() => setEditingColumnDesc(col.COLUMN_NAME)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: colors.primary,
                                color: colors.primaryText,
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
                        <div style={{ fontSize: '0.85em', fontWeight: '600', color: colors.primary, marginBottom: '8px' }}>
                          🏷️ Business Glossary Attributes ({colAttrs.length}):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {colAttrs.map(attr => (
                            <div 
                              key={attr.ATTRIBUTE_NAME}
                              style={{ 
                                padding: '12px',
                                backgroundColor: colors.cardBg,
                                borderRadius: '8px',
                                border: `1px solid ${colors.primary}`
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', color: colors.textSecondary, marginBottom: '4px' }}>
                                    {attr.DISPLAY_NAME}
                                  </div>
                                  <div style={{ fontSize: '0.85em', color: colors.textMuted, marginBottom: '8px' }}>
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
                                      backgroundColor: colors.primary,
                                      color: colors.primaryText,
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
                                    backgroundColor: colors.error,
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
                        backgroundColor: colors.cardBg,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <div style={{ fontSize: '0.85em', fontWeight: '600', marginBottom: '8px', color: colors.textSecondary }}>
                          Link Business Glossary Attribute:
                        </div>
                        <select
                          id={`attr-select-${col.COLUMN_NAME}`}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: `2px solid ${colors.primary}`,
                            borderRadius: '8px',
                            fontSize: '0.9em',
                            marginBottom: '8px',
                            backgroundColor: colors.inputBg,
                            color: colors.text
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
                              backgroundColor: colors.success,
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
                              backgroundColor: 'transparent',
                              color: colors.textMuted,
                              border: `1px solid ${colors.border}`,
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
                          backgroundColor: colors.primary,
                          color: colors.primaryText,
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

      {activeTab === 'preview' && (
        <div>
          <h3 style={{ fontSize: '1em', marginBottom: '16px', color: colors.text }}>Data Preview</h3>
          <DataPreview 
            tableName={table.FULL_TABLE_NAME}
            columns={columns.map(c => ({ COLUMN_NAME: c.COLUMN_NAME, DATA_TYPE: c.DATA_TYPE }))}
          />
        </div>
      )}

      {activeTab === 'lineage' && (
        <div>
          <h3 style={{ fontSize: '1em', marginBottom: '16px' }}>Data Lineage</h3>
          <LineageGraph 
            lineage={lineage} 
            currentTable={table} 
            darkMode={false} 
          />
        </div>
      )}

      {activeTab === 'activity' && (
        <div>
          {/* Rating Section */}
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: colors.cardBg, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
            <h3 style={{ fontSize: '1em', marginBottom: '12px', color: colors.text }}>Rate this table</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>{renderStars(userRating, true)}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.9em' }}>
                Average: {table.AVG_RATING.toFixed(1)} ({table.RATING_COUNT} rating{table.RATING_COUNT !== 1 ? 's' : ''})
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 style={{ fontSize: '1em', marginBottom: '12px', color: colors.text }}>Comments</h3>
            
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
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '4px',
                  fontSize: '0.9em',
                  backgroundColor: colors.inputBg,
                  color: colors.text
                }}
              />
              <button 
                onClick={handleAddComment}
                disabled={loading || !newComment.trim()}
                style={{ 
                  marginTop: '8px',
                  padding: '8px 16px', 
                  backgroundColor: colors.primary, 
                  color: colors.primaryText, 
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
                <div style={{ textAlign: 'center', padding: '20px', color: colors.textMuted, fontStyle: 'italic' }}>
                  No comments yet. Be the first to comment!
                </div>
              ) : (
                comments.map(comment => (
                  <div 
                    key={comment.COMMENT_ID}
                    style={{ 
                      padding: '12px', 
                      border: `1px solid ${colors.border}`,
                      borderRadius: '4px',
                      marginBottom: '12px',
                      backgroundColor: colors.cardBg
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9em', color: colors.text }}>{comment.USER_NAME}</div>
                      <div style={{ color: colors.textMuted, fontSize: '0.85em' }}>
                        {new Date(comment.CREATED_AT).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9em', color: colors.text }}>{comment.COMMENT_TEXT}</div>
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
                border: `2px solid ${colors.primary}`,
                borderRadius: '8px',
                fontSize: '0.95em',
                minHeight: '80px',
                fontFamily: 'inherit',
                resize: 'vertical',
                backgroundColor: colors.inputBg,
                color: colors.text
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
                  backgroundColor: colors.primary,
                  color: colors.primaryText,
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
                  backgroundColor: 'transparent',
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
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
                backgroundColor: colors.primary,
                color: colors.primaryText,
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
