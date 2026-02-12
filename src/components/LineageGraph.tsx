import React, { useMemo } from 'react';

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

interface GraphNode {
  id: string;
  name: string;
  database: string;
  schema: string;
  domain: string;
  x: number;
  y: number;
  isCurrent: boolean;
  direction: 'upstream' | 'current' | 'downstream';
  distance: number;
}

interface GraphEdge {
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

interface LineageGraphProps {
  lineage: LineageNode[];
  currentTable: {
    DATABASE_NAME: string;
    SCHEMA_NAME: string;
    TABLE_NAME: string;
    FULL_TABLE_NAME: string;
    TABLE_TYPE: string;
  };
  darkMode?: boolean;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const LEVEL_GAP = 220;
const NODE_GAP = 80;
const PADDING = 40;

const LineageGraph: React.FC<LineageGraphProps> = ({ lineage, currentTable, darkMode = false }) => {
  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];

    // Add current table as center node
    const currentId = currentTable.FULL_TABLE_NAME;
    nodeMap.set(currentId, {
      id: currentId,
      name: currentTable.TABLE_NAME,
      database: currentTable.DATABASE_NAME,
      schema: currentTable.SCHEMA_NAME,
      domain: currentTable.TABLE_TYPE || 'TABLE',
      x: 0,
      y: 0,
      isCurrent: true,
      direction: 'current',
      distance: 0
    });

    // Group nodes by distance
    const upstreamByDistance = new Map<number, LineageNode[]>();
    const downstreamByDistance = new Map<number, LineageNode[]>();

    lineage.forEach(edge => {
      if (edge.LINEAGE_TYPE === 'UPSTREAM') {
        const dist = edge.DISTANCE || 1;
        if (!upstreamByDistance.has(dist)) upstreamByDistance.set(dist, []);
        upstreamByDistance.get(dist)!.push(edge);
      } else {
        const dist = edge.DISTANCE || 1;
        if (!downstreamByDistance.has(dist)) downstreamByDistance.set(dist, []);
        downstreamByDistance.get(dist)!.push(edge);
      }
    });

    // Process upstream nodes (left side, negative x)
    const maxUpstreamDist = Math.max(0, ...Array.from(upstreamByDistance.keys()));
    upstreamByDistance.forEach((edges, distance) => {
      edges.forEach((edge, idx) => {
        const nodeId = edge.SOURCE_TABLE;
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId,
            name: edge.SOURCE_NAME,
            database: edge.SOURCE_DATABASE,
            schema: edge.SOURCE_SCHEMA,
            domain: edge.SOURCE_DOMAIN || 'TABLE',
            x: -distance,
            y: idx,
            isCurrent: false,
            direction: 'upstream',
            distance: distance
          });
        }
      });
    });

    // Process downstream nodes (right side, positive x)
    downstreamByDistance.forEach((edges, distance) => {
      edges.forEach((edge, idx) => {
        const nodeId = edge.TARGET_TABLE;
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId,
            name: edge.TARGET_NAME,
            database: edge.TARGET_DATABASE,
            schema: edge.TARGET_SCHEMA,
            domain: edge.TARGET_DOMAIN || 'TABLE',
            x: distance,
            y: idx,
            isCurrent: false,
            direction: 'downstream',
            distance: distance
          });
        }
      });
    });

    // Calculate actual positions
    const levelCounts = new Map<number, number>();
    nodeMap.forEach(node => {
      const count = levelCounts.get(node.x) || 0;
      levelCounts.set(node.x, count + 1);
    });

    // Assign y positions within each level
    const levelCurrentY = new Map<number, number>();
    const sortedNodes = Array.from(nodeMap.values()).sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      return a.id.localeCompare(b.id);
    });

    sortedNodes.forEach(node => {
      const count = levelCounts.get(node.x) || 1;
      const currentY = levelCurrentY.get(node.x) || 0;
      node.y = currentY - (count - 1) / 2;
      levelCurrentY.set(node.x, currentY + 1);
    });

    // Calculate SVG dimensions
    const minX = Math.min(...Array.from(nodeMap.values()).map(n => n.x));
    const maxX = Math.max(...Array.from(nodeMap.values()).map(n => n.x));
    const minY = Math.min(...Array.from(nodeMap.values()).map(n => n.y));
    const maxY = Math.max(...Array.from(nodeMap.values()).map(n => n.y));

    const width = (maxX - minX + 1) * LEVEL_GAP + NODE_WIDTH + PADDING * 2;
    const height = (maxY - minY + 1) * NODE_GAP + NODE_HEIGHT + PADDING * 2;

    // Convert relative positions to absolute pixel positions
    const offsetX = -minX * LEVEL_GAP + PADDING + NODE_WIDTH / 2;
    const offsetY = -minY * NODE_GAP + PADDING + NODE_HEIGHT / 2;

    nodeMap.forEach(node => {
      node.x = node.x * LEVEL_GAP + offsetX;
      node.y = node.y * NODE_GAP + offsetY;
    });

    // Create edges
    lineage.forEach(edge => {
      const sourceNode = nodeMap.get(edge.SOURCE_TABLE);
      const targetNode = nodeMap.get(edge.TARGET_TABLE);
      if (sourceNode && targetNode) {
        edgeList.push({
          source: edge.SOURCE_TABLE,
          target: edge.TARGET_TABLE,
          sourceX: sourceNode.x + NODE_WIDTH / 2,
          sourceY: sourceNode.y,
          targetX: targetNode.x - NODE_WIDTH / 2,
          targetY: targetNode.y
        });
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
      svgWidth: Math.max(width, 600),
      svgHeight: Math.max(height, 200)
    };
  }, [lineage, currentTable]);

  const getNodeColor = (node: GraphNode) => {
    if (node.isCurrent) return darkMode ? '#e5e7eb' : '#374151';
    if (node.direction === 'upstream') return darkMode ? '#94a3b8' : '#64748b';
    return darkMode ? '#cbd5e1' : '#94a3b8';
  };

  const getNodeBg = (node: GraphNode) => {
    if (node.isCurrent) return darkMode ? 'rgba(229, 231, 235, 0.15)' : 'rgba(55, 65, 81, 0.1)';
    if (node.direction === 'upstream') return darkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.1)';
    return darkMode ? 'rgba(203, 213, 225, 0.15)' : 'rgba(148, 163, 184, 0.1)';
  };

  const getDomainIcon = (domain: string) => {
    switch (domain?.toUpperCase()) {
      case 'VIEW': return '👁️';
      case 'STAGE': return '📁';
      case 'DYNAMIC TABLE': return '⚡';
      default: return '📊';
    }
  };

  const textColor = darkMode ? '#e5e7eb' : '#374151';
  const subtextColor = darkMode ? '#9ca3af' : '#6b7280';
  const bgColor = darkMode ? '#1f2937' : '#f9fafb';
  const borderColor = darkMode ? '#374151' : '#e5e7eb';

  if (nodes.length <= 1) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '60px 20px', 
        color: subtextColor,
        backgroundColor: bgColor,
        borderRadius: '8px',
        border: `1px solid ${borderColor}`
      }}>
        <div style={{ fontSize: '3em', marginBottom: '16px' }}>🔗</div>
        <div style={{ fontSize: '1.1em', marginBottom: '8px' }}>No lineage information available</div>
        <div style={{ fontSize: '0.9em' }}>
          Lineage is tracked via SNOWFLAKE.CORE.GET_LINEAGE()
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: bgColor, 
      borderRadius: '8px', 
      border: `1px solid ${borderColor}`,
      overflow: 'auto'
    }}>
      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        gap: '24px', 
        padding: '12px 16px',
        borderBottom: `1px solid ${borderColor}`,
        fontSize: '0.85em',
        color: subtextColor
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: darkMode ? '#94a3b8' : '#64748b' }} />
          <span>Upstream Sources</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: darkMode ? '#e5e7eb' : '#374151' }} />
          <span>Current Table</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: darkMode ? '#cbd5e1' : '#94a3b8' }} />
          <span>Downstream Targets</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>
          <span>📊 Table</span>
          <span>👁️ View</span>
          <span>📁 Stage</span>
          <span>⚡ Dynamic</span>
        </div>
      </div>

      {/* Graph */}
      <svg 
        width={svgWidth} 
        height={svgHeight}
        style={{ display: 'block', minWidth: '100%' }}
      >
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon 
              points="0 0, 10 3.5, 0 7" 
              fill={darkMode ? '#6b7280' : '#9ca3af'} 
            />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, idx) => {
          const midX = (edge.sourceX + edge.targetX) / 2;
          const path = `M ${edge.sourceX} ${edge.sourceY} 
                        C ${midX} ${edge.sourceY}, 
                          ${midX} ${edge.targetY}, 
                          ${edge.targetX} ${edge.targetY}`;
          return (
            <path
              key={idx}
              d={path}
              fill="none"
              stroke={darkMode ? '#4b5563' : '#d1d5db'}
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <g key={node.id} transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}>
            {/* Node background */}
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx="8"
              ry="8"
              fill={getNodeBg(node)}
              stroke={getNodeColor(node)}
              strokeWidth={node.isCurrent ? 3 : 2}
            />
            
            {/* Icon */}
            <text
              x="12"
              y={NODE_HEIGHT / 2 + 1}
              fontSize="18"
              dominantBaseline="middle"
            >
              {getDomainIcon(node.domain)}
            </text>

            {/* Table name */}
            <text
              x="38"
              y={NODE_HEIGHT / 2 - 8}
              fontSize="13"
              fontWeight={node.isCurrent ? '600' : '500'}
              fill={textColor}
              dominantBaseline="middle"
            >
              {node.name.length > 16 ? node.name.substring(0, 14) + '...' : node.name}
            </text>

            {/* Schema info */}
            <text
              x="38"
              y={NODE_HEIGHT / 2 + 10}
              fontSize="10"
              fill={subtextColor}
              dominantBaseline="middle"
            >
              {node.database}.{node.schema}
            </text>

            {/* Domain badge */}
            <rect
              x={NODE_WIDTH - 50}
              y="6"
              width="44"
              height="16"
              rx="3"
              fill={getNodeColor(node)}
              opacity="0.2"
            />
            <text
              x={NODE_WIDTH - 28}
              y="14"
              fontSize="8"
              fill={getNodeColor(node)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight="600"
            >
              {node.domain?.substring(0, 6).toUpperCase() || 'TABLE'}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default LineageGraph;
