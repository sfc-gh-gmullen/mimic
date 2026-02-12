import React, { useState, useEffect } from 'react';

interface DataPreviewProps {
  tableName: string;
  columns: Array<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
  }>;
}

interface PreviewData {
  hasAccess: boolean;
  data: any[];
  isSynthetic: boolean;
  error?: string;
}

const DataPreview: React.FC<DataPreviewProps> = ({ tableName, columns }) => {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rowLimit, setRowLimit] = useState(10);

  useEffect(() => {
    fetchPreview();
  }, [tableName, rowLimit]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tables/${encodeURIComponent(tableName)}/preview?limit=${rowLimit}`);
      const result = await response.json();
      
      if (result.success) {
        setPreviewData({
          hasAccess: result.hasAccess,
          data: result.data || [],
          isSynthetic: result.isSynthetic || false
        });
      } else {
        // If we don't have access, generate synthetic data
        setPreviewData({
          hasAccess: false,
          data: generateSyntheticData(columns, rowLimit),
          isSynthetic: true,
          error: result.error
        });
      }
    } catch (err) {
      console.error('Failed to fetch preview:', err);
      // Generate synthetic data on error
      setPreviewData({
        hasAccess: false,
        data: generateSyntheticData(columns, rowLimit),
        isSynthetic: true,
        error: 'Failed to fetch preview data'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSyntheticData = (cols: Array<{ COLUMN_NAME: string; DATA_TYPE: string }>, count: number): any[] => {
    const syntheticRows: any[] = [];
    
    for (let i = 0; i < count; i++) {
      const row: any = {};
      cols.forEach(col => {
        row[col.COLUMN_NAME] = generateSyntheticValue(col.DATA_TYPE, col.COLUMN_NAME, i);
      });
      syntheticRows.push(row);
    }
    
    return syntheticRows;
  };

  const generateSyntheticValue = (dataType: string, columnName: string, rowIndex: number): any => {
    const upperType = dataType.toUpperCase();
    const lowerColName = columnName.toLowerCase();
    
    // Check for common column name patterns
    if (lowerColName.includes('id')) {
      return `ID_${(rowIndex + 1).toString().padStart(5, '0')}`;
    }
    if (lowerColName.includes('name') || lowerColName.includes('title')) {
      const names = ['Sample', 'Example', 'Test', 'Demo', 'Preview'];
      return `${names[rowIndex % names.length]} ${columnName} ${rowIndex + 1}`;
    }
    if (lowerColName.includes('email')) {
      return `user${rowIndex + 1}@example.com`;
    }
    if (lowerColName.includes('phone')) {
      return `+1-555-${String(1000 + rowIndex).padStart(4, '0')}`;
    }
    if (lowerColName.includes('date') || lowerColName.includes('time') || lowerColName.includes('created') || lowerColName.includes('updated')) {
      const date = new Date();
      date.setDate(date.getDate() - rowIndex);
      return date.toISOString().split('T')[0];
    }
    if (lowerColName.includes('amount') || lowerColName.includes('price') || lowerColName.includes('cost')) {
      return `$${(Math.random() * 1000).toFixed(2)}`;
    }
    if (lowerColName.includes('status')) {
      const statuses = ['Active', 'Pending', 'Complete', 'Draft', 'Review'];
      return statuses[rowIndex % statuses.length];
    }
    if (lowerColName.includes('description') || lowerColName.includes('comment')) {
      return `Sample ${columnName} text for row ${rowIndex + 1}`;
    }
    
    // Type-based generation
    if (upperType.includes('INT') || upperType.includes('NUMBER') || upperType.includes('DECIMAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE')) {
      return Math.floor(Math.random() * 10000);
    }
    if (upperType.includes('BOOLEAN')) {
      return rowIndex % 2 === 0;
    }
    if (upperType.includes('DATE')) {
      const date = new Date();
      date.setDate(date.getDate() - rowIndex);
      return date.toISOString().split('T')[0];
    }
    if (upperType.includes('TIME')) {
      return `${String(rowIndex % 24).padStart(2, '0')}:${String((rowIndex * 7) % 60).padStart(2, '0')}:00`;
    }
    if (upperType.includes('VARIANT') || upperType.includes('OBJECT') || upperType.includes('ARRAY')) {
      return JSON.stringify({ sample: `value_${rowIndex + 1}` });
    }
    
    // Default: string value
    return `Sample_${rowIndex + 1}`;
  };

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return String(value);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '2em', marginBottom: '16px' }}>Loading preview...</div>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
        Unable to load preview data.
      </div>
    );
  }

  const displayColumns = columns.length > 0 
    ? columns.map(c => c.COLUMN_NAME)
    : (previewData.data.length > 0 ? Object.keys(previewData.data[0]) : []);

  return (
    <div>
      {/* Header with synthetic data notice */}
      {previewData.isSynthetic && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.2em' }}>ℹ️</span>
          <div>
            <strong style={{ color: '#856404' }}>Synthetic Preview Data</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9em', color: '#856404' }}>
              You don't have direct access to this table's data. Showing synthetic sample data based on the schema structure.
              {previewData.error && <span> ({previewData.error})</span>}
            </p>
          </div>
        </div>
      )}

      {!previewData.isSynthetic && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#d4edda',
          border: '1px solid #28a745',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.2em' }}>✓</span>
          <div>
            <strong style={{ color: '#155724' }}>Live Data Preview</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9em', color: '#155724' }}>
              Showing actual data from the table (limited to {rowLimit} rows).
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.9em', color: '#6c757d' }}>Rows:</label>
          <select
            value={rowLimit}
            onChange={(e) => setRowLimit(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
              fontSize: '0.9em'
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button
          onClick={fetchPreview}
          style={{
            padding: '8px 16px',
            backgroundColor: '#29B5E8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9em',
            fontWeight: '500'
          }}
        >
          Refresh
        </button>
      </div>

      {/* Data Table */}
      {previewData.data.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          color: '#6c757d'
        }}>
          No data available to display.
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: '8px'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.9em'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                {displayColumns.map((col, idx) => (
                  <th
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      borderBottom: '2px solid #dee2e6',
                      fontWeight: '600',
                      color: '#495057',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    backgroundColor: rowIdx % 2 === 0 ? 'white' : '#f8f9fa'
                  }}
                >
                  {displayColumns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #dee2e6',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: row[col] === null ? '#adb5bd' : '#212529',
                        fontStyle: row[col] === null ? 'italic' : 'normal'
                      }}
                      title={formatCellValue(row[col])}
                    >
                      {formatCellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '0.85em',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        Showing {previewData.data.length} of {rowLimit} requested rows
        {previewData.isSynthetic && ' (synthetic data)'}
      </div>
    </div>
  );
};

export default DataPreview;
