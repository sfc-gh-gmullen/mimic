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
  const { colors, isDarkMode } = useTheme();
  const [allCatalogData, setAllCatalogData] = useState<CatalogEntry[]>([]);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tableTagsMap, setTableTagsMap] = useState<Record<string, {tag: string, value: string}[]>>({});
  const [tableContactsMap, setTableContactsMap] = useState<Record<string, {PURPOSE: string, METHOD: string}[]>>({});
  const [tableGlossaryMap, setTableGlossaryMap] = useState<Record<string, {ATTRIBUTE_NAME: string, DISPLAY_NAME: string, DESCRIPTION?: string}[]>>({});
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
  const [selectedDataProduct, setSelectedDataProduct] = useState('');
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  
  // Autocomplete search states
  const [databaseSearch, setDatabaseSearch] = useState('');
  const [showDatabaseDropdown, setShowDatabaseDropdown] = useState(false);
  const [showSchemaDropdown, setShowSchemaDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  
  // Refs for dropdown management
  const databaseRef = useRef<HTMLDivElement>(null);
  const schemaRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  
  // Detail view
  const [selectedTable, setSelectedTable] = useState<CatalogEntry | null>(null);
  
  // View mode: 'cards' or 'list' (organized by Data Products)
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  
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

  // Pagination state
  const [displayCount, setDisplayCount] = useState<number | 'all'>(20);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const showMoreRef = useRef<HTMLDivElement>(null);
  const showMoreOptions = [10, 20, 50, 100, 'all'] as const;
  
  // Tag value filter state
  const [selectedTagValueFilter, setSelectedTagValueFilter] = useState<string>('');
  const [showTagValueDropdown, setShowTagValueDropdown] = useState(false);
  const tagValueRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (databaseRef.current && !databaseRef.current.contains(event.target as Node)) {
        setShowDatabaseDropdown(false);
      }
      if (schemaRef.current && !schemaRef.current.contains(event.target as Node)) {
        setShowSchemaDropdown(false);
      }
      if (typeRef.current && !typeRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
      if (tagRef.current && !tagRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
      if (showMoreRef.current && !showMoreRef.current.contains(event.target as Node)) {
        setShowMoreDropdown(false);
      }
      if (tagValueRef.current && !tagValueRef.current.contains(event.target as Node)) {
        setShowTagValueDropdown(false);
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

        // Fetch contacts for tables to display in catalog list
        try {
          const contactsResponse = await fetch('/api/contacts-bulk');
          const contactsResult = await contactsResponse.json();
          if (contactsResult.success) {
            setTableContactsMap(contactsResult.data);
          }
        } catch (e) {
          console.log('Could not fetch contacts');
        }

        // Fetch glossary attributes for tables to display as tags
        try {
          const glossaryResponse = await fetch('/api/glossary-bulk');
          const glossaryResult = await glossaryResponse.json();
          if (glossaryResult.success) {
            setTableGlossaryMap(glossaryResult.data);
          }
        } catch (e) {
          console.log('Could not fetch glossary attributes');
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
          const [tagName] = selectedTagValue.split(':');
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
    
    // Filter by tag value (standalone filter for any tag with specific value)
    if (selectedTagValueFilter) {
      filtered = filtered.filter(entry => {
        const tableTags = tableTagsMap[entry.FULL_TABLE_NAME] || [];
        return tableTags.some(tableTag => tableTag.value === selectedTagValueFilter);
      });
    }
    
    // Filter by Data Product
    if (selectedDataProduct) {
      filtered = filtered.filter(entry => {
        const tableTags = tableTagsMap[entry.FULL_TABLE_NAME] || [];
        const dataProductTag = tableTags.find(t => 
          t.tag.toUpperCase().includes('DATA_PRODUCT') || 
          t.tag.toUpperCase().includes('DATAPRODUCT')
        );
        return dataProductTag && dataProductTag.value === selectedDataProduct;
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
  }, [allCatalogData, selectedDatabase, selectedSchema, selectedType, selectedTags, selectedTagValueFilter, selectedDataProduct, searchQuery, tableTagsMap, initialLoadComplete]);

  // Compute available Data Products from tags
  const availableDataProducts = useMemo(() => {
    const products = new Set<string>();
    Object.values(tableTagsMap).forEach(tags => {
      tags.forEach(tag => {
        if ((tag.tag.toUpperCase().includes('DATA_PRODUCT') || 
             tag.tag.toUpperCase().includes('DATAPRODUCT')) && tag.value) {
          products.add(tag.value);
        }
      });
    });
    return Array.from(products).sort();
  }, [tableTagsMap]);


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

  // Filter tags based on search (search in full tag name)
  const filteredTags = (availableTags || []).filter(tag => 
    tag.FULL_TAG_NAME.toLowerCase().includes(tagSearch.toLowerCase()) ||
    tag.TAG_NAME.toLowerCase().includes(tagSearch.toLowerCase())
  );

  // Get tag values from selected tags only for the tag value filter
  const allTagValues = useMemo(() => {
    if (selectedTags.length === 0) {
      return []; // No values if no tags selected
    }
    
    // Extract full tag names from selectedTags (format: "DB.SCHEMA.TAG:VALUE")
    const selectedTagNames = new Set(
      selectedTags.map(st => st.substring(0, st.lastIndexOf(':')))
    );
    
    // Only get values from selected tags
    const valuesSet = new Set<string>();
    (availableTags || []).forEach(tag => {
      if (selectedTagNames.has(tag.FULL_TAG_NAME)) {
        (tag.VALUES || []).forEach(value => valuesSet.add(value));
      }
    });
    return Array.from(valuesSet).sort();
  }, [availableTags, selectedTags]);

  const handleDatabaseSelect = (dbName: string) => {
    setSelectedDatabase(dbName);
    setDatabaseSearch(dbName);
    setShowDatabaseDropdown(false);
    setSelectedSchema(''); // Reset schema when database changes
  };

  const handleSchemaSelect = (schemaName: string) => {
    setSelectedSchema(schemaName);
    setShowSchemaDropdown(false);
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setShowTypeDropdown(false);
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
    setSelectedDataProduct('');
    setSelectedTags([]);
    setSelectedTagValueFilter('');
    setSearchQuery('');
    setDatabaseSearch('');
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

  if (loading && allCatalogData.length === 0) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #29B5E8 0%, #11567F 100%)',
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

  // Compute displayed data based on pagination - use filteredCatalogData directly for correctness
  const displayedData = displayCount === 'all' || typeof displayCount !== 'number' 
    ? filteredCatalogData 
    : filteredCatalogData.slice(0, displayCount);
  const hasMoreResults = filteredCatalogData.length > displayedData.length;

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
      {/* Hero Section - Snowflake Brand */}
      <div style={{ 
        background: 'linear-gradient(135deg, #29B5E8 0%, #11567F 100%)',
        borderRadius: '24px', 
        padding: '48px 40px', 
        boxShadow: '0 20px 60px rgba(41, 181, 232, 0.3)',
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
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(113,211,220,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
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
                letterSpacing: '-0.5px',
                fontFamily: "'Lato', sans-serif"
              }}>
                Welcome to Your Data Catalog
              </h1>
              <p style={{ 
                color: 'rgba(255,255,255,0.95)', 
                marginBottom: '0',
                fontSize: '1.15em',
                fontWeight: '300',
                maxWidth: '600px',
                fontFamily: "'Lato', sans-serif"
              }}>
                Explore and discover datasets across your entire Snowflake environment
              </p>
            </div>
            <button 
              onClick={handleRefreshCatalog}
              style={{ 
                padding: '14px 28px', 
                backgroundColor: '#71D3DC',
                color: '#003545', 
                border: 'none', 
                borderRadius: '80px', 
                cursor: 'pointer',
                fontSize: '0.9em',
                fontWeight: '700',
                fontFamily: "'Lato', sans-serif",
                textTransform: 'uppercase',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#29B5E8';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#71D3DC';
                e.currentTarget.style.color = '#003545';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
              }}
            >
              REFRESH CATALOG
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ background: colors.cardBg, borderRadius: '20px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
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
              border: `2px solid ${colors.inputBorder}`,
              backgroundColor: colors.inputBg,
              color: colors.text,
              fontSize: '1em',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#29B5E8';
              e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = colors.inputBorder;
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
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
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
                border: `2px solid ${colors.inputBorder}`,
                backgroundColor: colors.inputBg,
                color: colors.text,
                fontSize: '0.95em',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocusCapture={(e) => e.target.style.borderColor = '#29B5E8'}
              onBlur={(e) => setTimeout(() => e.target.style.borderColor = colors.inputBorder, 200)}
            />
            {selectedDatabase && (
              <button
                onClick={() => {
                  setSelectedDatabase('');
                  setDatabaseSearch('');
                  setSelectedSchema('');
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2em',
                  color: colors.textMuted
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
                backgroundColor: colors.cardBg,
                border: '2px solid #29B5E8',
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
                      borderBottom: `1px solid ${colors.border}`,
                      transition: 'background-color 0.15s',
                      backgroundColor: colors.cardBg
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.surface}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = colors.cardBg}
                  >
                    <div style={{ fontWeight: '500', color: colors.text }}>{db.DATABASE_NAME}</div>
                    <div style={{ fontSize: '0.85em', color: colors.textSecondary }}>{db.TABLE_COUNT} tables</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schema Dropdown */}
          <div ref={schemaRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
              📂 Schema
            </label>
            <div
              onClick={() => selectedDatabase && setShowSchemaDropdown(!showSchemaDropdown)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `2px solid ${colors.inputBorder}`,
                backgroundColor: !selectedDatabase ? colors.surface : colors.inputBg,
                color: selectedSchema ? colors.text : colors.textMuted,
                fontSize: '0.95em',
                cursor: selectedDatabase ? 'pointer' : 'not-allowed',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: selectedDatabase ? 1 : 0.6
              }}
            >
              <span>{selectedSchema || (selectedDatabase ? 'All Schemas' : 'Select database first')}</span>
              {selectedDatabase && <span style={{ fontSize: '0.8em' }}>{showSchemaDropdown ? '▲' : '▼'}</span>}
            </div>
            {selectedSchema && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSchema('');
                }}
                style={{
                  position: 'absolute',
                  right: '30px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2em',
                  color: colors.textMuted
                }}
              >
                ×
              </button>
            )}
            {showSchemaDropdown && selectedDatabase && schemas.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.cardBg,
                border: '2px solid #29B5E8',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '250px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                <div
                  onClick={() => handleSchemaSelect('')}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${colors.border}`,
                    transition: 'background-color 0.15s',
                    backgroundColor: selectedSchema === '' ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg,
                    fontStyle: 'italic',
                    color: colors.textMuted
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.surface}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = selectedSchema === '' ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg}
                >
                  All Schemas
                </div>
                {schemas.map(schema => (
                  <div
                    key={schema.SCHEMA_NAME}
                    onClick={() => handleSchemaSelect(schema.SCHEMA_NAME)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${colors.border}`,
                      transition: 'background-color 0.15s',
                      backgroundColor: selectedSchema === schema.SCHEMA_NAME ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg
                    }}
                    onMouseOver={(e) => {
                      if (selectedSchema !== schema.SCHEMA_NAME) e.currentTarget.style.backgroundColor = colors.surface;
                    }}
                    onMouseOut={(e) => {
                      if (selectedSchema !== schema.SCHEMA_NAME) e.currentTarget.style.backgroundColor = colors.cardBg;
                    }}
                  >
                    <div style={{ fontWeight: '500', color: colors.text }}>{schema.SCHEMA_NAME}</div>
                    <div style={{ fontSize: '0.85em', color: colors.textSecondary }}>{schema.TABLE_COUNT} tables</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Type Dropdown */}
          <div ref={typeRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
              📋 Type
            </label>
            <div
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `2px solid ${colors.inputBorder}`,
                backgroundColor: colors.inputBg,
                color: selectedType ? colors.text : colors.textMuted,
                fontSize: '0.95em',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{selectedType === 'BASE TABLE' ? 'Tables' : selectedType === 'VIEW' ? 'Views' : 'All Types'}</span>
              <span style={{ fontSize: '0.8em' }}>{showTypeDropdown ? '▲' : '▼'}</span>
            </div>
            {selectedType && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedType('');
                }}
                style={{
                  position: 'absolute',
                  right: '30px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2em',
                  color: colors.textMuted
                }}
              >
                ×
              </button>
            )}
            {showTypeDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.cardBg,
                border: '2px solid #29B5E8',
                borderRadius: '8px',
                marginTop: '4px',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                {[
                  { value: '', label: 'All Types' },
                  { value: 'BASE TABLE', label: 'Tables' },
                  { value: 'VIEW', label: 'Views' }
                ].map(option => (
                  <div
                    key={option.value}
                    onClick={() => handleTypeSelect(option.value)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${colors.border}`,
                      transition: 'background-color 0.15s',
                      backgroundColor: selectedType === option.value ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg,
                      color: colors.text,
                      fontWeight: selectedType === option.value ? '600' : '400'
                    }}
                    onMouseOver={(e) => {
                      if (selectedType !== option.value) e.currentTarget.style.backgroundColor = colors.surface;
                    }}
                    onMouseOut={(e) => {
                      if (selectedType !== option.value) e.currentTarget.style.backgroundColor = colors.cardBg;
                    }}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data Product Filter */}
          {availableDataProducts.length > 0 && (
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
                📦 Data Product
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
                <option value="">All Data Products</option>
                {availableDataProducts.map(product => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
              {selectedDataProduct && (
                <button
                  onClick={() => setSelectedDataProduct('')}
                  style={{
                    position: 'absolute',
                    right: '30px',
                    top: '38px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2em',
                    color: colors.textMuted
                  }}
                >
                  ×
                </button>
              )}
                </div>
              )}

          {/* Tag Multi-Select */}
          <div ref={tagRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
              🏷️ Snowflake Tags
            </label>
            
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
              onFocusCapture={(e) => e.target.style.borderColor = '#29B5E8'}
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
                border: '2px solid #29B5E8',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '350px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                {tagsLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: colors.textMuted }}>
                    <div style={{ 
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e9ecef',
                      borderTopColor: '#29B5E8',
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
                            borderBottom: `1px solid ${colors.border}`,
                            transition: 'background-color 0.15s',
                            backgroundColor: isTagSelected ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}
                          onMouseOver={(e) => {
                            if (!isTagSelected) e.currentTarget.style.backgroundColor = colors.surface;
                          }}
                          onMouseOut={(e) => {
                            if (!isTagSelected) e.currentTarget.style.backgroundColor = colors.cardBg;
                          }}
                        >
                          {hasValues ? (
                            <span style={{ 
                              fontSize: '0.8em', 
                              color: '#29B5E8',
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
                            <div style={{ fontWeight: '500', color: colors.text }}>🏷️ {tag.TAG_NAME}</div>
                            <div style={{ fontSize: '0.8em', color: colors.textMuted }}>{tag.TAG_DATABASE}.{tag.TAG_SCHEMA}</div>
                            <div style={{ fontSize: '0.75em', color: colors.textMuted }}>
                              {tag.COUNT} tables{hasValues && ` · ${tag.VALUES.length} values`}
                            </div>
                          </div>
                        </div>
                        
                        {/* Tag Values (expandable) */}
                        {isExpanded && hasValues && (
                          <div style={{ backgroundColor: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
                            {/* Any Value option */}
                            <div
                              onClick={() => handleTagSelect(tag.FULL_TAG_NAME + ':*')}
                              style={{
                                padding: '10px 14px 10px 40px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                backgroundColor: selectedTags.includes(tag.FULL_TAG_NAME + ':*') ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : 'transparent'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.border}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = selectedTags.includes(tag.FULL_TAG_NAME + ':*') ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : 'transparent'}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTags.includes(tag.FULL_TAG_NAME + ':*')}
                                readOnly
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <span style={{ fontStyle: 'italic', color: colors.textMuted }}>Any value</span>
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
                                    backgroundColor: isValueSelected ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : 'transparent'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.border}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = isValueSelected ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : 'transparent'}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isValueSelected}
                                    readOnly
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                  <span style={{ color: colors.text }}>{value}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '12px 14px', color: colors.textMuted, textAlign: 'center' }}>
                    {availableTags.length === 0 ? 'No tags available' : `No tags found matching "${tagSearch}"`}
                  </div>
                )}
              </div>
            )}
            
            {/* Selected Tags Display - below dropdown */}
            {selectedTags.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '8px'
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
                        backgroundColor: '#29B5E8',
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
          </div>

          {/* Tag Value Filter */}
          <div ref={tagValueRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.85em', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
              🎯 Tag Value
            </label>
            <div
              onClick={() => selectedTags.length > 0 && setShowTagValueDropdown(!showTagValueDropdown)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `2px solid ${colors.inputBorder}`,
                backgroundColor: selectedTags.length === 0 ? colors.surface : colors.inputBg,
                color: selectedTagValueFilter ? colors.text : colors.textMuted,
                fontSize: '0.95em',
                cursor: selectedTags.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: selectedTags.length > 0 ? 1 : 0.6
              }}
            >
              <span>{selectedTagValueFilter || (selectedTags.length > 0 ? 'Filter by tag value...' : 'Select tags first')}</span>
              {selectedTags.length > 0 && <span style={{ fontSize: '0.8em' }}>{showTagValueDropdown ? '▲' : '▼'}</span>}
            </div>
            {selectedTagValueFilter && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTagValueFilter('');
                }}
                style={{
                  position: 'absolute',
                  right: '30px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2em',
                  color: colors.textMuted
                }}
              >
                ×
              </button>
            )}
            {showTagValueDropdown && allTagValues.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.cardBg,
                border: '2px solid #29B5E8',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '250px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                {allTagValues.map(value => (
                  <div
                    key={value}
                    onClick={() => {
                      setSelectedTagValueFilter(value);
                      setShowTagValueDropdown(false);
                    }}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${colors.border}`,
                      transition: 'background-color 0.15s',
                      backgroundColor: selectedTagValueFilter === value ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg,
                      color: colors.text
                    }}
                    onMouseOver={(e) => {
                      if (selectedTagValueFilter !== value) e.currentTarget.style.backgroundColor = colors.surface;
                    }}
                    onMouseOut={(e) => {
                      if (selectedTagValueFilter !== value) e.currentTarget.style.backgroundColor = colors.cardBg;
                    }}
                  >
                    {value}
                  </div>
                ))}
              </div>
            )}
            {showTagValueDropdown && allTagValues.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: colors.cardBg,
                border: '2px solid #29B5E8',
                borderRadius: '8px',
                marginTop: '4px',
                padding: '12px 14px',
                color: colors.textMuted,
                textAlign: 'center',
                zIndex: 1000
              }}>
                No values available for selected tags
              </div>
            )}
          </div>
        </div>

        {/* Active Filters & Clear Button */}
        {(selectedDatabase || selectedSchema || selectedType || selectedDataProduct || selectedTags.length > 0 || selectedTagValueFilter || searchQuery) && (
          <div style={{ 
            marginBottom: '24px', 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: '600', color: colors.textSecondary }}>Active Filters:</span>
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
            {selectedDataProduct && (
              <span style={{ 
                padding: '6px 12px', 
                backgroundColor: '#e7f3ff', 
                color: '#004085',
                borderRadius: '20px',
                fontSize: '0.9em'
              }}>
                📦 {selectedDataProduct}
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
            {selectedTagValueFilter && (
              <span style={{ 
                padding: '6px 12px', 
                backgroundColor: isDarkMode ? '#4a3f00' : '#e2e3ff',
                color: isDarkMode ? '#ffd700' : '#3f4470',
                borderRadius: '20px',
                fontSize: '0.9em'
              }}>
                🎯 Value: {selectedTagValueFilter}
              </span>
            )}
            <button
              onClick={clearAllFilters}
              style={{
                padding: '6px 16px',
                backgroundColor: colors.textMuted,
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
            color: colors.text
          }}>
            {filteredCatalogData.length} {filteredCatalogData.length === 1 ? 'dataset' : 'datasets'}
          </span>
          {loading && (
            <span style={{ color: colors.textMuted, fontSize: '0.9em' }}>
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

        {/* View Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '0.9em', color: colors.textMuted }}>
            {filteredCatalogData.length} results found
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '8px 16px',
                backgroundColor: viewMode === 'cards' ? '#29B5E8' : (isDarkMode ? '#374151' : '#f0f0f0'),
                color: viewMode === 'cards' ? 'white' : colors.text,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85em',
                fontWeight: viewMode === 'cards' ? '600' : 'normal',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ▦ Cards
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 16px',
                backgroundColor: viewMode === 'list' ? '#29B5E8' : (isDarkMode ? '#374151' : '#f0f0f0'),
                color: viewMode === 'list' ? 'white' : colors.text,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85em',
                fontWeight: viewMode === 'list' ? '600' : 'normal',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ☰ List by Data Product
            </button>
          </div>
        </div>

        {/* Card View */}
        {viewMode === 'cards' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '24px'
          }}>
          {displayedData.map((entry) => (
            <div 
              key={entry.FULL_TABLE_NAME}
              onClick={() => setSelectedTable(entry)}
              style={{ 
                border: `1px solid ${colors.border}`,
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: isDarkMode ? '#374151' : 'white',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.15)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = '#29B5E8';
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
                    color: '#29B5E8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: '600'
                  }}>
                    {entry.TABLE_NAME}
                  </h3>
                  <div style={{ 
                    fontSize: '0.85em', 
                    color: colors.textMuted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {entry.DATABASE_NAME}.{entry.SCHEMA_NAME}
                  </div>
                </div>
                <span style={{ 
                  padding: '4px 10px', 
                  backgroundColor: entry.TABLE_TYPE === 'BASE TABLE' ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : (isDarkMode ? '#4a3f00' : '#fff3cd'),
                  color: entry.TABLE_TYPE === 'BASE TABLE' ? (isDarkMode ? '#7eb8ff' : '#004085') : (isDarkMode ? '#ffd700' : '#856404'),
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
                  color: colors.textSecondary,
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
                backgroundColor: isDarkMode ? '#2d3748' : '#f8f9fa',
                borderRadius: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '0.75em', color: colors.textMuted, marginBottom: '4px' }}>Rows</div>
                  <div style={{ fontSize: '0.95em', fontWeight: '600', color: colors.text }}>
                    {entry.ROW_COUNT ? entry.ROW_COUNT.toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75em', color: colors.textMuted, marginBottom: '4px' }}>Size</div>
                  <div style={{ fontSize: '0.95em', fontWeight: '600', color: colors.text }}>
                    {entry.SIZE_GB ? `${entry.SIZE_GB} GB` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              {tableTagsMap[entry.FULL_TABLE_NAME] && tableTagsMap[entry.FULL_TABLE_NAME].length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px',
                  marginBottom: '12px'
                }}>
                  {tableTagsMap[entry.FULL_TABLE_NAME].slice(0, 3).map((tagRef, idx) => {
                    const shortTagName = tagRef.tag.split('.').pop() || tagRef.tag;
                    const displayText = tagRef.value ? `${shortTagName}=${tagRef.value}` : shortTagName;
                    return (
                      <span
                        key={idx}
                        title={`${tagRef.tag}${tagRef.value ? '=' + tagRef.value : ''}`}
                        style={{
                          padding: '3px 8px',
                          backgroundColor: isDarkMode ? '#1e3a5f' : '#e7f3ff',
                          color: isDarkMode ? '#7eb8ff' : '#004085',
                          borderRadius: '12px',
                          fontSize: '0.75em',
                          fontWeight: '500'
                        }}
                      >
                        🏷️ {displayText}
                      </span>
                    );
                  })}
                  {tableTagsMap[entry.FULL_TABLE_NAME].length > 3 && (
                    <span style={{
                      padding: '3px 8px',
                      backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
                      color: colors.textMuted,
                      borderRadius: '12px',
                      fontSize: '0.75em'
                    }}>
                      +{tableTagsMap[entry.FULL_TABLE_NAME].length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Contacts Section */}
              {tableContactsMap[entry.FULL_TABLE_NAME] && tableContactsMap[entry.FULL_TABLE_NAME].length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px', 
                  marginTop: '8px',
                  fontSize: '0.8em'
                }}>
                  {tableContactsMap[entry.FULL_TABLE_NAME].map((contact, idx) => {
                    const icon = contact.PURPOSE === 'DATA_OWNER' ? '👤' : 
                                 contact.PURPOSE === 'STEWARD' ? '🛡️' : 
                                 contact.PURPOSE === 'DOMAIN_EXPERT' ? '🎓' : '📞';
                    const label = contact.PURPOSE === 'DATA_OWNER' ? 'Owner' :
                                  contact.PURPOSE === 'STEWARD' ? 'Steward' :
                                  contact.PURPOSE === 'DOMAIN_EXPERT' ? 'Expert' : contact.PURPOSE;
                    return (
                      <span
                        key={idx}
                        title={`${contact.PURPOSE}: ${contact.METHOD}`}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: isDarkMode ? '#1e3a5f' : '#e8f4fd',
                          color: isDarkMode ? '#7eb8ff' : '#1e5f8a',
                          borderRadius: '8px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '150px'
                        }}
                      >
                        {icon} {label}: {contact.METHOD.split('@')[0]}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Glossary Terms Section */}
              {tableGlossaryMap[entry.FULL_TABLE_NAME] && tableGlossaryMap[entry.FULL_TABLE_NAME].length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px',
                  marginTop: '8px'
                }}>
                  {tableGlossaryMap[entry.FULL_TABLE_NAME].slice(0, 3).map((glossary, idx) => (
                    <span
                      key={idx}
                      title={glossary.DESCRIPTION || glossary.DISPLAY_NAME}
                      style={{
                        padding: '3px 8px',
                        backgroundColor: isDarkMode ? '#2d4a3e' : '#d4edda',
                        color: isDarkMode ? '#7ed6a5' : '#155724',
                        borderRadius: '12px',
                        fontSize: '0.75em',
                        fontWeight: '500'
                      }}
                    >
                      📚 {glossary.DISPLAY_NAME}
                    </span>
                  ))}
                  {tableGlossaryMap[entry.FULL_TABLE_NAME].length > 3 && (
                    <span style={{
                      padding: '3px 8px',
                      backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
                      color: colors.textMuted,
                      borderRadius: '12px',
                      fontSize: '0.75em'
                    }}>
                      +{tableGlossaryMap[entry.FULL_TABLE_NAME].length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: `1px solid ${colors.border}`
              }}>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.85em', color: colors.textMuted }}>
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
        )}

        {/* List View organized by Data Product */}
        {viewMode === 'list' && (
          <div>
            {(() => {
              // Group tables by Data Product tag
              const dataProductGroups: Record<string, CatalogEntry[]> = { 'Ungrouped': [] };
              
              displayedData.forEach(entry => {
                const tags = tableTagsMap[entry.FULL_TABLE_NAME] || [];
                const dataProductTag = tags.find(t => 
                  t.tag.toUpperCase().includes('DATA_PRODUCT') || 
                  t.tag.toUpperCase().includes('DATAPRODUCT')
                );
                
                if (dataProductTag && dataProductTag.value) {
                  if (!dataProductGroups[dataProductTag.value]) {
                    dataProductGroups[dataProductTag.value] = [];
                  }
                  dataProductGroups[dataProductTag.value].push(entry);
                } else {
                  dataProductGroups['Ungrouped'].push(entry);
                }
              });

              // Sort groups alphabetically, but keep Ungrouped last
              const sortedGroups = Object.keys(dataProductGroups)
                .filter(g => g !== 'Ungrouped' && dataProductGroups[g].length > 0)
                .sort();
              if (dataProductGroups['Ungrouped'].length > 0) {
                sortedGroups.push('Ungrouped');
              }

              return sortedGroups.map(groupName => (
                <div key={groupName} style={{ marginBottom: '24px' }}>
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: groupName === 'Ungrouped' 
                      ? (isDarkMode ? '#374151' : '#f0f0f0')
                      : (isDarkMode ? '#1e3a5f' : '#e7f3ff'),
                    borderRadius: '8px 8px 0 0',
                    borderBottom: `2px solid ${groupName === 'Ungrouped' ? colors.border : '#29B5E8'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '1.2em' }}>
                      {groupName === 'Ungrouped' ? '📁' : '📦'}
                    </span>
                    <span style={{ 
                      fontWeight: '600', 
                      fontSize: '1.1em',
                      color: groupName === 'Ungrouped' ? colors.textMuted : (isDarkMode ? '#7eb8ff' : '#004085')
                    }}>
                      {groupName}
                    </span>
                    <span style={{ 
                      fontSize: '0.85em', 
                      color: colors.textMuted,
                      marginLeft: 'auto'
                    }}>
                      {dataProductGroups[groupName].length} items
                    </span>
                  </div>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    backgroundColor: isDarkMode ? '#1f2937' : 'white',
                    border: `1px solid ${colors.border}`,
                    borderTop: 'none'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: isDarkMode ? '#374151' : '#f8f9fa' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.85em', color: colors.textMuted }}>Name</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.85em', color: colors.textMuted }}>Type</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.85em', color: colors.textMuted }}>Owner</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.85em', color: colors.textMuted }}>Steward</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.85em', color: colors.textMuted }}>Rows</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', fontSize: '0.85em', color: colors.textMuted }}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataProductGroups[groupName].map((entry, idx) => {
                        const contacts = tableContactsMap[entry.FULL_TABLE_NAME] || [];
                        const owner = contacts.find(c => c.PURPOSE === 'DATA_OWNER');
                        const steward = contacts.find(c => c.PURPOSE === 'STEWARD');
                        
                        return (
                          <tr 
                            key={entry.FULL_TABLE_NAME}
                            onClick={() => setSelectedTable(entry)}
                            style={{ 
                              cursor: 'pointer',
                              backgroundColor: idx % 2 === 0 
                                ? (isDarkMode ? '#1f2937' : 'white')
                                : (isDarkMode ? '#111827' : '#f8f9fa'),
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#e7f3ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 
                              ? (isDarkMode ? '#1f2937' : 'white')
                              : (isDarkMode ? '#111827' : '#f8f9fa')}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: '500', color: '#29B5E8' }}>{entry.TABLE_NAME}</div>
                              <div style={{ fontSize: '0.8em', color: colors.textMuted }}>{entry.DATABASE_NAME}.{entry.SCHEMA_NAME}</div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                padding: '2px 8px',
                                backgroundColor: entry.TABLE_TYPE === 'BASE TABLE' 
                                  ? (isDarkMode ? '#1e3a5f' : '#e7f3ff')
                                  : (isDarkMode ? '#4a3f00' : '#fff3cd'),
                                color: entry.TABLE_TYPE === 'BASE TABLE'
                                  ? (isDarkMode ? '#7eb8ff' : '#004085')
                                  : (isDarkMode ? '#ffd700' : '#856404'),
                                borderRadius: '4px',
                                fontSize: '0.8em'
                              }}>
                                {entry.TABLE_TYPE === 'BASE TABLE' ? 'TABLE' : 'VIEW'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.85em', color: colors.textSecondary }}>
                              {owner ? owner.METHOD.split('@')[0] : '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.85em', color: colors.textSecondary }}>
                              {steward ? steward.METHOD.split('@')[0] : '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.85em', color: colors.textSecondary }}>
                              {entry.ROW_COUNT ? entry.ROW_COUNT.toLocaleString() : '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.85em' }}>
                              {entry.AVG_RATING > 0 ? (
                                <span>{renderStars(Math.round(entry.AVG_RATING))}</span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Show More Results Button */}
        {hasMoreResults && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: '32px',
            position: 'relative',
            display: 'inline-block',
            width: '100%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: colors.textMuted, fontSize: '0.9em' }}>
                Showing {displayedData.length} of {filteredCatalogData.length} results
              </span>
              <div style={{ position: 'relative' }} ref={showMoreRef}>
                <button
                  onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                  style={{
                    padding: '12px 27px',
                    backgroundColor: '#29B5E8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '80px',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    fontWeight: '700',
                    fontFamily: "'Lato', sans-serif",
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(41, 181, 232, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#11567F';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#29B5E8';
                  }}
                >
                  SHOW MORE RESULTS
                  <span style={{ fontSize: '0.8em' }}>{showMoreDropdown ? '▲' : '▼'}</span>
                </button>
                {showMoreDropdown && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    minWidth: '120px',
                    zIndex: 1000
                  }}>
                    {showMoreOptions.map((option) => (
                      <div
                        key={option}
                        onClick={() => {
                          setDisplayCount(option);
                          setShowMoreDropdown(false);
                        }}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          borderBottom: `1px solid ${colors.border}`,
                          backgroundColor: displayCount === option ? (isDarkMode ? '#1e3a5f' : '#e7f3ff') : colors.cardBg,
                          color: colors.text,
                          fontWeight: displayCount === option ? '600' : '400',
                          textAlign: 'center'
                        }}
                        onMouseOver={(e) => {
                          if (displayCount !== option) e.currentTarget.style.backgroundColor = colors.surface;
                        }}
                        onMouseOut={(e) => {
                          if (displayCount !== option) e.currentTarget.style.backgroundColor = colors.cardBg;
                        }}
                      >
                        {option === 'all' ? 'Show All' : `Show ${option}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {filteredCatalogData.length === 0 && !loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 20px',
            color: colors.textMuted
          }}>
            <div style={{ fontSize: '4em', marginBottom: '20px' }}>🔍</div>
            <h3 style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: '8px' }}>No datasets found</h3>
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
