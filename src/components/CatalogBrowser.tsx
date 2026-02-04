import React, { useState, useEffect, useRef, useMemo } from 'react';
import TableDetailView from './TableDetailView';
import MessageModal from './MessageModal';
import { useTheme } from '../ThemeContext';

interface CatalogEntry {
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
  COMMENT_COUNT: number;
  VIEW_COUNT: number;
  UNIQUE_VIEWERS: number;
  LAST_VIEWED: string;
}

interface Database {
  DATABASE_NAME: string;
  TABLE_COUNT: number;
}

interface Schema {
  SCHEMA_NAME: string;
  TABLE_COUNT: number;
}

interface Tag {
  TAG_NAME: string;
  TAG_DATABASE: string;
  TAG_SCHEMA: string;
  FULL_TAG_NAME: string;
  COUNT: number;
  VALUES: string[];  // Available tag values
}

const CatalogBrowser: React.FC = () => {
  const { colors } = useTheme();
  const [allCatalogData, setAllCatalogData] = useState<CatalogEntry[]>([]);
  const [catalogData, setCatalogData] = useState<CatalogEntry[]>([]);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tableTagsMap, setTableTagsMap] = useState<Record<string, {tag: string, value: string}[]>>({});
  const [loading, setLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters - selectedTags now stores "TAG_NAME:VALUE" or "TAG_NAME:*" for any value
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  
  // Autocomplete search states
  const [databaseSearch, setDatabaseSearch] = useState('');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [showDatabaseDropdown, setShowDatabaseDropdown] = useState(false);
  const [showSchemaDropdown, setShowSchemaDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  
  // Refs for dropdown management
  const databaseRef = useRef<HTMLDivElement>(null);
  const schemaRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  
  // Detail view
  const [selectedTable, setSelectedTable] = useState<CatalogEntry | null>(null);
  
  // Modal state
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

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (databaseRef.current && !databaseRef.current.contains(event.target as Node)) {
        setShowDatabaseDropdown(false);
      }
      if (schemaRef.current && !schemaRef.current.contains(event.target as Node)) {
        setShowSchemaDropdown(false);
      }
      if (tagRef.current && !tagRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch databases and tags for filters
  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const response = await fetch('/api/databases');
        const result = await response.json();
        if (result.success) {
          setDatabases(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch databases:', err);
      }
    };
    
    const fetchTags = async () => {
      setTagsLoading(true);
      try {
        const response = await fetch('/api/tags');
        const result = await response.json();
        if (result.success) {
          setAvailableTags(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      } finally {
        setTagsLoading(false);
      }
    };
    
    fetchDatabases();
    fetchTags();
  }, []);

  // Fetch schemas when database is selected
  useEffect(() => {
    const fetchSchemas = async () => {
      if (!selectedDatabase) {
        setSchemas([]);
        return;
      }
      try {
        const response = await fetch(`/api/schemas?database=${selectedDatabase}`);
        const result = await response.json();
        if (result.success) {
          setSchemas(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch schemas:', err);
      }
    };
    fetchSchemas();
  }, [selectedDatabase]);

  // Fetch all catalog data once on mount
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch all catalog data (increased limit for client-side filtering)
        const catalogResponse = await fetch('/api/catalog?limit=5000');
        const catalogResult = await catalogResponse.json();
        
        if (catalogResult.success) {
          setAllCatalogData(catalogResult.data);
          setCatalogData(catalogResult.data);
          setError(null);
        } else {
          setError(catalogResult.error);
        }

        // Fetch tag references for tables to enable client-side tag filtering
        try {
          const tagRefsResponse = await fetch('/api/tag-references');
          const tagRefsResult = await tagRefsResponse.json();
          if (tagRefsResult.success) {
            setTableTagsMap(tagRefsResult.data);
          }
        } catch (e) {
          console.log('Could not fetch tag references');
        }
        
      } catch (err) {
        console.error('Failed to fetch catalog:', err);
        setError('Failed to load catalog data');
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };

    fetchAllData();
  }, []); // Empty dependency - only fetch once on mount

  // Client-side filtering
  const filteredCatalogData = useMemo(() => {
    if (!initialLoadComplete) return [];
    
    let filtered = [...allCatalogData];
    
    // Filter by database
    if (selectedDatabase) {
      filtered = filtered.filter(entry => entry.DATABASE_NAME === selectedDatabase);
    }
    
    // Filter by schema
    if (selectedSchema) {
      filtered = filtered.filter(entry => entry.SCHEMA_NAME === selectedSchema);
    }
    
    // Filter by type
    if (selectedType) {
      filtered = filtered.filter(entry => entry.TABLE_TYPE === selectedType);
    }
    
    // Filter by tags (using tableTagsMap with tag:value format)
    if (selectedTags.length > 0) {
      filtered = filtered.filter(entry => {
        const tableTags = tableTagsMap[entry.FULL_TABLE_NAME] || [];
        return selectedTags.some(selectedTagValue => {
          const [tagName, tagValue] = selectedTagValue.split(':');
          const valueToMatch = selectedTagValue.substring(tagName.length + 1); // Handle values with colons
          
          return tableTags.some(tableTag => {
            // Match tag name
            if (tableTag.tag !== tagName) return false;
            // If value is *, match any value
            if (valueToMatch === '*') return true;
            // Otherwise match specific value
            return tableTag.value === valueToMatch;
          });
        });
      });
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.TABLE_NAME.toLowerCase().includes(query) ||
        (entry.SYSTEM_COMMENT && entry.SYSTEM_COMMENT.toLowerCase().includes(query)) ||
        (entry.USER_DESCRIPTION && entry.USER_DESCRIPTION.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allCatalogData, selectedDatabase, selectedSchema, selectedType, selectedTags, searchQuery, tableTagsMap, initialLoadComplete]);

  // Update catalogData when filters change (for display)
  useEffect(() => {
    setCatalogData(filteredCatalogData);
  }, [filteredCatalogData]);

  const handleRefreshCatalog = async () => {
    setLoading(true);
    
    setModalState({
      isOpen: true,
      title: 'Refreshing Catalog',
      message: 'Catalog refresh has been initiated. This process scans all databases and may take 1-2 minutes. You can continue using the catalog - the data will update when complete.',
      type: 'info'
    });
    
    try {
      // Increased timeout to 180 seconds for large catalogs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      
      const response = await fetch('/api/refresh-catalog', { 
        method: 'POST',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const result = await response.json();
      
      if (result.success) {
        setModalState({
          isOpen: true,
          title: 'Success',
          message: 'Catalog metadata refreshed successfully! Reloading to show updated data...',
          type: 'success'
        });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: `Failed to refresh catalog: ${result.error}`,
          type: 'error'
        });
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setModalState({
          isOpen: true,
          title: 'Refresh In Progress',
          message: 'Catalog refresh is taking longer than expected but is still running. Please wait a few minutes and reload the page to see updated data.',
          type: 'info'
        });
      } else {
        setModalState({
          isOpen: true,
          title: 'Error',
          message: 'Failed to refresh catalog. Please try again.',
          type: 'error'
        });
      }
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} style={{ color: i <= rating ? '#ffc107' : '#e0e0e0' }}>★</span>
      );
    }
    return stars;
  };

  // Filter databases based on search
  const filteredDatabases = (databases || []).filter(db => 
    db.DATABASE_NAME.toLowerCase().includes(databaseSearch.toLowerCase())
  );

  // Filter schemas based on search
  const filteredSchemas = (schemas || []).filter(schema => 
    schema.SCHEMA_NAME.toLowerCase().includes(schemaSearch.toLowerCase())
  );

  // Filter tags based on search (search in full tag name)
  const filteredTags = (availableTags || []).filter(tag => 
    tag.FULL_TAG_NAME.toLowerCase().includes(tagSearch.toLowerCase()) ||
    tag.TAG_NAME.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const handleDatabaseSelect = (dbName: string) => {
    setSelectedDatabase(dbName);
    setDatabaseSearch(dbName);
    setShowDatabaseDropdown(false);
    setSelectedSchema(''); // Reset schema when database changes
    setSchemaSearch('');
  };

  const handleSchemaSelect = (schemaName: string) => {
    setSelectedSchema(schemaName);
    setSchemaSearch(schemaName);
    setShowSchemaDropdown(false);
  };

  const handleTagSelect = (fullTagName: string) => {
    if (selectedTags.includes(fullTagName)) {
      setSelectedTags(selectedTags.filter(t => t !== fullTagName));
    } else {
      setSelectedTags([...selectedTags, fullTagName]);
    }
  };

  const clearAllFilters = () => {
    setSelectedDatabase('');
    setSelectedSchema('');
    setSelectedType('');
    setSelectedTags([]);
    setSearchQuery('');
    setDatabaseSearch('');
    setSchemaSearch('');
    setTagSearch('');
  };

  if (selectedTable) {
    return (
      <TableDetailView 
        table={selectedTable} 
        onBack={() => setSelectedTable(null)} 
      />
    );
  }

  if (loading && catalogData.length === 0) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px', 
        padding: '60px 32px', 
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        textAlign: 'center'
      }}>
        <div style={{ 
          color: 'white',
          fontSize: '1.5em',
          fontWeight: '300'
        }}>
          🔍 Loading your data catalog...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      '--bg-surface': colors.surface,
      '--bg-card': colors.cardBg,
      '--text-primary': colors.text,
      '--text-secondary': colors.textSecondary,
      '--border-color': colors.border,
      '--input-bg': colors.inputBg,
      '--input-border': colors.inputBorder,
      color: colors.text
    } as React.CSSProperties}>
      {/* Hero Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '24px', 
        padding: '48px 40px', 
        boxShadow: '0 20px 60px rgba(102, 126, 234, 0.3)',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h1 style={{ 
                margin: '0 0 12px 0', 
                color: 'white',
                fontSize: '2.5em',
                fontWeight: '700',
                letterSpacing: '-0.5px'
              }}>
                Welcome to Your Data Catalog
              </h1>
              <p style={{ 
                color: 'rgba(255,255,255,0.95)', 
                marginBottom: '0',
                fontSize: '1.15em',
                fontWeight: '300',
                maxWidth: '600px'
              }}>
                Explore and discover datasets across your entire Snowflake environment
              </p>
            </div>
            <button 
              onClick={handleRefreshCatalog}
              style={{ 
                padding: '14px 28px', 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                color: 'white', 
                border: '2px solid rgba(255,255,255,0.3)', 
                borderRadius: '12px', 
                cursor: 'pointer',
                fontSize: '1em',
                fontWeight: '600',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
              }}
            >
              🔄 Refresh Catalog
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        {/* Search Bar */}
        <div style={{ marginBottom: '24px' }}>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search tables by name or description..."
            style={{ 
              width: '100%',
              padding: '16px 20px', 
              borderRadius: '12px', 
              border: '2px solid #e9ecef',
              fontSize: '1em',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#667eea';
              e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e9ecef';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Filters with Autocomplete */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px', 
          marginBottom: '28px',
          padding: '24px',
          backgroundColor: colors.cardBg,
          borderRadius: '16px',
          border: `1px solid ${colors.border}`
        }}>
          {/* Database Autocomplete */}
          <div ref={databaseRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: '#495057', display: 'block', marginBottom: '8px' }}>
              🗄️ Database
            </label>
            <input
              type="text"
              value={databaseSearch}
              onChange={(e) => {
                setDatabaseSearch(e.target.value);
                setShowDatabaseDropdown(true);
              }}
              onFocus={() => setShowDatabaseDropdown(true)}
              placeholder="Type to search..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '2px solid #dee2e6',
                fontSize: '0.95em',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocusCapture={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => setTimeout(() => e.target.style.borderColor = '#dee2e6', 200)}
            />
            {selectedDatabase && (
              <button
                onClick={() => {
                  setSelectedDatabase('');
                  setDatabaseSearch('');
                  setSelectedSchema('');
                  setSchemaSearch('');
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2em',
                  color: '#6c757d'
                }}
              >
                ×
              </button>
            )}
            {showDatabaseDropdown && filteredDatabases.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.surface,
                border: '2px solid #667eea',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '250px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                {filteredDatabases.map(db => (
                  <div
                    key={db.DATABASE_NAME}
                    onClick={() => handleDatabaseSelect(db.DATABASE_NAME)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: '500', color: '#212529' }}>{db.DATABASE_NAME}</div>
                    <div style={{ fontSize: '0.85em', color: '#6c757d' }}>{db.TABLE_COUNT} tables</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schema Autocomplete */}
          <div ref={schemaRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: '#495057', display: 'block', marginBottom: '8px' }}>
              📂 Schema
            </label>
            <input
              type="text"
              value={schemaSearch}
              onChange={(e) => {
                setSchemaSearch(e.target.value);
                setShowSchemaDropdown(true);
              }}
              onFocus={() => setShowSchemaDropdown(true)}
              placeholder={selectedDatabase ? "Type to search..." : "Select database first"}
              disabled={!selectedDatabase}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '2px solid #dee2e6',
                fontSize: '0.95em',
                transition: 'border-color 0.2s',
                outline: 'none',
                backgroundColor: !selectedDatabase ? '#f8f9fa' : 'white',
                cursor: !selectedDatabase ? 'not-allowed' : 'text'
              }}
              onFocusCapture={(e) => selectedDatabase && (e.target.style.borderColor = '#667eea')}
              onBlur={(e) => setTimeout(() => e.target.style.borderColor = '#dee2e6', 200)}
            />
            {selectedSchema && (
              <button
                onClick={() => {
                  setSelectedSchema('');
                  setSchemaSearch('');
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2em',
                  color: '#6c757d'
                }}
              >
                ×
              </button>
            )}
            {showSchemaDropdown && selectedDatabase && filteredSchemas.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.surface,
                border: '2px solid #667eea',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '250px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                {filteredSchemas.map(schema => (
                  <div
                    key={schema.SCHEMA_NAME}
                    onClick={() => handleSchemaSelect(schema.SCHEMA_NAME)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: '500', color: '#212529' }}>{schema.SCHEMA_NAME}</div>
                    <div style={{ fontSize: '0.85em', color: '#6c757d' }}>{schema.TABLE_COUNT} tables</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Type Select */}
          <div>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: '#495057', display: 'block', marginBottom: '8px' }}>
              📋 Type
            </label>
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ 
                width: '100%',
                padding: '10px 14px', 
                borderRadius: '8px', 
                border: '2px solid #dee2e6',
                fontSize: '0.95em',
                transition: 'border-color 0.2s',
                outline: 'none',
                cursor: 'pointer'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
            >
              <option value="">All Types</option>
              <option value="BASE TABLE">Tables</option>
              <option value="VIEW">Views</option>
            </select>
          </div>

          {/* Tag Multi-Select */}
          <div ref={tagRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: '#495057', display: 'block', marginBottom: '8px' }}>
              🏷️ Snowflake Tags
            </label>
            
            {/* Selected Tags Display */}
            {selectedTags.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '8px'
              }}>
                {selectedTags.map(tagWithValue => {
                  // Format: "DB.SCHEMA.TAG:VALUE" or "DB.SCHEMA.TAG:*"
                  const colonIndex = tagWithValue.lastIndexOf(':');
                  const fullTagName = tagWithValue.substring(0, colonIndex);
                  const tagValue = tagWithValue.substring(colonIndex + 1);
                  const shortTagName = fullTagName.split('.').pop() || fullTagName;
                  const displayText = tagValue === '*' ? shortTagName : `${shortTagName}=${tagValue}`;
                  
                  return (
                    <span
                      key={tagWithValue}
                      title={tagWithValue}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        borderRadius: '16px',
                        fontSize: '0.85em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {displayText}
                      <button
                        onClick={() => handleTagSelect(tagWithValue)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '1.1em',
                          padding: '0',
                          lineHeight: '1'
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => {
                setTagSearch(e.target.value);
                setShowTagDropdown(true);
              }}
              onFocus={() => setShowTagDropdown(true)}
              placeholder="Search tags to filter..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '2px solid #dee2e6',
                fontSize: '0.95em',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocusCapture={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => setTimeout(() => {
                e.target.style.borderColor = '#dee2e6';
                setTimeout(() => setShowTagDropdown(false), 200);
              }, 200)}
            />
            
            {showTagDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.surface,
                border: '2px solid #667eea',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '350px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                {tagsLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                    <div style={{ 
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e9ecef',
                      borderTopColor: '#667eea',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginRight: '10px',
                      verticalAlign: 'middle'
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    Loading tags...
                  </div>
                ) : filteredTags.length > 0 ? (
                  filteredTags.map(tag => {
                    const isTagSelected = selectedTags.some(st => st.startsWith(tag.FULL_TAG_NAME + ':'));
                    const isExpanded = expandedTag === tag.FULL_TAG_NAME;
                    const hasValues = tag.VALUES && tag.VALUES.length > 0;
                    
                    return (
                      <div key={tag.FULL_TAG_NAME}>
                        <div
                          onClick={() => {
                            if (hasValues) {
                              setExpandedTag(isExpanded ? null : tag.FULL_TAG_NAME);
                            } else {
                              handleTagSelect(tag.FULL_TAG_NAME + ':*');
                            }
                          }}
                          style={{
                            padding: '12px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                            transition: 'background-color 0.15s',
                            backgroundColor: isTagSelected ? '#e7f3ff' : 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}
                          onMouseOver={(e) => {
                            if (!isTagSelected) e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }}
                          onMouseOut={(e) => {
                            if (!isTagSelected) e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          {hasValues ? (
                            <span style={{ 
                              fontSize: '0.8em', 
                              color: '#667eea',
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                            }}>▶</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isTagSelected}
                              readOnly
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500', color: '#212529' }}>🏷️ {tag.TAG_NAME}</div>
                            <div style={{ fontSize: '0.8em', color: '#6c757d' }}>{tag.TAG_DATABASE}.{tag.TAG_SCHEMA}</div>
                            <div style={{ fontSize: '0.75em', color: '#adb5bd' }}>
                              {tag.COUNT} tables{hasValues && ` · ${tag.VALUES.length} values`}
                            </div>
                          </div>
                        </div>
                        
                        {/* Tag Values (expandable) */}
                        {isExpanded && hasValues && (
                          <div style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                            {/* Any Value option */}
                            <div
                              onClick={() => handleTagSelect(tag.FULL_TAG_NAME + ':*')}
                              style={{
                                padding: '10px 14px 10px 40px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                backgroundColor: selectedTags.includes(tag.FULL_TAG_NAME + ':*') ? '#e7f3ff' : 'transparent'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = selectedTags.includes(tag.FULL_TAG_NAME + ':*') ? '#e7f3ff' : 'transparent'}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTags.includes(tag.FULL_TAG_NAME + ':*')}
                                readOnly
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <span style={{ fontStyle: 'italic', color: '#6c757d' }}>Any value</span>
                            </div>
                            
                            {/* Specific values */}
                            {tag.VALUES.map(value => {
                              const tagValueKey = `${tag.FULL_TAG_NAME}:${value}`;
                              const isValueSelected = selectedTags.includes(tagValueKey);
                              return (
                                <div
                                  key={value}
                                  onClick={() => handleTagSelect(tagValueKey)}
                                  style={{
                                    padding: '10px 14px 10px 40px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    backgroundColor: isValueSelected ? '#e7f3ff' : 'transparent'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = isValueSelected ? '#e7f3ff' : 'transparent'}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isValueSelected}
                                    readOnly
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                  <span style={{ color: '#212529' }}>{value}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '12px 14px', color: '#6c757d', textAlign: 'center' }}>
                    {availableTags.length === 0 ? 'No tags available' : `No tags found matching "${tagSearch}"`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active Filters & Clear Button */}
        {(selectedDatabase || selectedSchema || selectedType || selectedTags.length > 0 || searchQuery) && (
          <div style={{ 
            marginBottom: '24px', 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: '600', color: '#495057' }}>Active Filters:</span>
            {selectedDatabase && (
              <span style={{ 
                padding: '6px 12px', 
                backgroundColor: '#e7f3ff', 
                color: '#004085',
                borderRadius: '20px',
                fontSize: '0.9em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🗄️ {selectedDatabase}
              </span>
            )}
            {selectedSchema && (
              <span style={{ 
                padding: '6px 12px', 
                backgroundColor: '#fff3cd', 
                color: '#856404',
                borderRadius: '20px',
                fontSize: '0.9em'
              }}>
                📂 {selectedSchema}
              </span>
            )}
            {selectedType && (
              <span style={{ 
                padding: '6px 12px', 
                backgroundColor: '#d1ecf1', 
                color: '#0c5460',
                borderRadius: '20px',
                fontSize: '0.9em'
              }}>
                📋 {selectedType === 'BASE TABLE' ? 'Tables' : 'Views'}
              </span>
            )}
            {selectedTags.map(tagWithValue => {
              // Format: "DB.SCHEMA.TAG:VALUE" or "DB.SCHEMA.TAG:*"
              const colonIndex = tagWithValue.lastIndexOf(':');
              const fullTagName = tagWithValue.substring(0, colonIndex);
              const tagValue = tagWithValue.substring(colonIndex + 1);
              const shortTagName = fullTagName.split('.').pop() || fullTagName;
              const displayText = tagValue === '*' ? shortTagName : `${shortTagName}=${tagValue}`;
              return (
                <span key={tagWithValue} title={`${fullTagName}: ${tagValue === '*' ? 'Any value' : tagValue}`} style={{ 
                  padding: '6px 12px', 
                  backgroundColor: '#f8d7da', 
                  color: '#721c24',
                  borderRadius: '20px',
                  fontSize: '0.9em'
                }}>
                  🏷️ {displayText}
                </span>
              );
            })}
            <button
              onClick={clearAllFilters}
              style={{
                padding: '6px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.85em',
                fontWeight: '600',
                marginLeft: 'auto'
              }}
            >
              Clear All
            </button>
          </div>
        )}

        {/* Results Summary */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            fontSize: '1.1em', 
            fontWeight: '600', 
            color: '#212529'
          }}>
            {catalogData.length} {catalogData.length === 1 ? 'dataset' : 'datasets'}
          </span>
          {loading && (
            <span style={{ color: '#6c757d', fontSize: '0.9em' }}>
              <span className="spinner">⟳</span> Loading...
            </span>
          )}
        </div>

        {error && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f8d7da', 
            color: '#721c24', 
            borderRadius: '12px', 
            marginBottom: '24px',
            border: '1px solid #f5c6cb'
          }}>
            {error}
          </div>
        )}

        {/* Catalog Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '24px'
        }}>
          {catalogData.map((entry) => (
            <div 
              key={entry.FULL_TABLE_NAME}
              onClick={() => setSelectedTable(entry)}
              style={{ 
                border: `1px solid ${colors.border}`,
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: colors.surface,
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.15)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = '#667eea';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                  <h3 style={{ 
                    margin: '0 0 6px 0', 
                    fontSize: '1.15em', 
                    color: '#667eea',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: '600'
                  }}>
                    {entry.TABLE_NAME}
                  </h3>
                  <div style={{ 
                    fontSize: '0.85em', 
                    color: '#6c757d',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {entry.DATABASE_NAME}.{entry.SCHEMA_NAME}
                  </div>
                </div>
                <span style={{ 
                  padding: '4px 10px', 
                  backgroundColor: entry.TABLE_TYPE === 'BASE TABLE' ? '#e7f3ff' : '#fff3cd',
                  color: entry.TABLE_TYPE === 'BASE TABLE' ? '#004085' : '#856404',
                  borderRadius: '8px',
                  fontSize: '0.75em',
                  fontWeight: '600',
                  flexShrink: 0
                }}>
                  {entry.TABLE_TYPE === 'BASE TABLE' ? 'TABLE' : 'VIEW'}
                </span>
              </div>

              {(entry.SYSTEM_COMMENT || entry.USER_DESCRIPTION) && (
                <p style={{ 
                  margin: '12px 0', 
                  fontSize: '0.9em', 
                  color: '#495057',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: '1.5'
                }}>
                  {entry.USER_DESCRIPTION || entry.SYSTEM_COMMENT}
                </p>
              )}

              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                margin: '16px 0',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '0.75em', color: '#6c757d', marginBottom: '4px' }}>Rows</div>
                  <div style={{ fontSize: '0.95em', fontWeight: '600', color: '#212529' }}>
                    {entry.ROW_COUNT ? entry.ROW_COUNT.toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75em', color: '#6c757d', marginBottom: '4px' }}>Size</div>
                  <div style={{ fontSize: '0.95em', fontWeight: '600', color: '#212529' }}>
                    {entry.SIZE_GB ? `${entry.SIZE_GB} GB` : 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: '1px solid #e9ecef'
              }}>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85em', color: '#6c757d' }}>
                  {entry.AVG_RATING > 0 && (
                    <span>{renderStars(Math.round(entry.AVG_RATING))} ({entry.RATING_COUNT})</span>
                  )}
                  {entry.COMMENT_COUNT > 0 && <span>💬 {entry.COMMENT_COUNT}</span>}
                  {entry.VIEW_COUNT > 0 && <span>👁️ {entry.VIEW_COUNT}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {catalogData.length === 0 && !loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 20px',
            color: '#6c757d'
          }}>
            <div style={{ fontSize: '4em', marginBottom: '20px' }}>🔍</div>
            <h3 style={{ color: '#495057', fontWeight: '600', marginBottom: '8px' }}>No datasets found</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        )}
      </div>

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

export default CatalogBrowser;
