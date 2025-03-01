'use client';

import { useState, useEffect, useRef, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import Graph from react-graph-vis to avoid SSR issues
const Graph = dynamic(
  () => import('react-graph-vis'),
  {
    ssr: false,
    loading: () => <div className="h-[600px] w-full flex items-center justify-center bg-gray-100">Loading Graph...</div>
  }
);

// Interface for our Neo4j node data
interface Neo4jNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

// Interface for our Neo4j relationship data
interface Neo4jRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
}

// Interface for API response
interface GraphData {
  nodes: Neo4jNode[];
  relationships: Neo4jRelationship[];
}

// Interface for pagination data
interface PaginationData {
  page: number;
  batchSize: number;
  totalPages: number;
  nodeCount: number;
  relationshipCount: number;
  hasMore: boolean;
}

// Interface for API response
interface ApiResponse {
  data: GraphData;
  pagination: PaginationData;
}

// Interface for vis.js node
interface VisNode {
  id: string;
  label: string;
  title: string;
  value: number;
  color: string;
  shape?: string;
  font?: {
    color?: string;
    size?: number;
    face?: string;
  };
  shadow?: boolean;
  originalNode: Neo4jNode;
}

// Interface for vis.js edge
interface VisEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  arrows: 'to';
  width: number;
  color?: string;
  smooth?: boolean | {
    enabled: boolean;
    type: string;
    forceDirection?: string | boolean;
    roundness?: number;
  };
  originalRelationship: Neo4jRelationship;
}

// Interface for formatted data for vis.js
interface VisGraphData {
  nodes: VisNode[];
  edges: VisEdge[];
}

// Layout options for the graph
type LayoutType = 'force' | 'hierarchical';

interface LayoutOptions {
  improvedLayout?: boolean;
  hierarchical?: {
    direction: 'UD' | 'DU';
    sortMethod: 'directed' | 'hubsize';
    nodeSpacing: number;
    treeSpacing: number;
    levelSeparation: number;
  };
}

export default function GraphPage() {
  const [graphData, setGraphData] = useState<VisGraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState<number>(10);
  const [relationshipCount, setRelationshipCount] = useState<number>(100);
  const [generating, setGenerating] = useState<boolean>(false);
  const [isBrowser, setIsBrowser] = useState<boolean>(false);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [batchSize, setBatchSize] = useState<number>(1000);
  
  // Graph layout controls
  const [nodeRepulsion, setNodeRepulsion] = useState<number>(1000);
  const [linkDistance, setLinkDistance] = useState<number>(100);
  const [layoutType, setLayoutType] = useState<LayoutType>('force');
  const [springLength, setSpringLength] = useState<number>(250);
  const [springConstant, setSpringConstant] = useState<number>(0.04);
  const [damping, setDamping] = useState<number>(0.09);
  const [showConnections, setShowConnections] = useState<boolean>(false);
  
  // Node details display
  const [selectedNode, setSelectedNode] = useState<VisNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<VisEdge | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState<boolean>(false);
  
  const graphRef = useRef<any>(null);

  // Network graph options for vis.js
  const [graphOptions, setGraphOptions] = useState({
    nodes: {
      shape: 'dot',
      scaling: {
        min: 10,
        max: 30,
        label: {
          enabled: true,
          min: 14,
          max: 30,
          maxVisible: 30,
          drawThreshold: 5
        }
      },
      font: {
        size: 12,
        face: 'Tahoma'
      },
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.2)',
        size: 5
      }
    },
    edges: {
      width: 2,
      selectionWidth: 3,
      color: {
        color: '#848484',
        highlight: '#848484',
        hover: '#848484'
      },
      smooth: {
        enabled: true,
        type: 'continuous',
        roundness: 0.5
      },
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.1)',
        size: 3
      },
      hidden: true
    },
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -2000,
        centralGravity: 0.3,
        springLength: 250,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 0.1
      },
      solver: 'barnesHut',
      stabilization: {
        enabled: true,
        iterations: 1000,
        updateInterval: 100,
        onlyDynamicEdges: false,
        fit: true
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      hideEdgesOnDrag: true,
      navigationButtons: true,
      keyboard: true,
      multiselect: true
    },
    layout: {
      improvedLayout: true
    },
    // Disable WebGL rendering
    renderingMode: 'canvas'
  });
  
  // Check if we're in the browser
  useEffect(() => {
    setIsBrowser(true);
  }, []);
  
  // Update relationship count when node count changes
  useEffect(() => {
    // Set relationship count to 10x the node count as a default
    setRelationshipCount(Math.min(nodeCount * 10, 10000));
  }, [nodeCount]);
  
  // Update graph options based on user settings
  useEffect(() => {
    setGraphOptions(prevOptions => {
      const newOptions = { ...prevOptions };
      
      // Update physics options based on user preferences
      if (layoutType === 'force') {
        newOptions.physics = {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -nodeRepulsion * 2,
            centralGravity: 0.3,
            springLength: springLength,
            springConstant: springConstant,
            damping: damping,
            avoidOverlap: 0.1
          },
          solver: 'barnesHut',
          stabilization: {
            enabled: true,
            iterations: 1000,
            updateInterval: 100,
            onlyDynamicEdges: false,
            fit: true
          }
        };
        // Reset layout to default for force-directed
        newOptions.layout = {
          improvedLayout: true
        };
      } else if (layoutType === 'hierarchical') {
        newOptions.physics = {
          enabled: false,
          barnesHut: {
            gravitationalConstant: -1000,
            centralGravity: 0.3,
            springLength: 250,
            springConstant: 0.04,
            damping: 0.09,
            avoidOverlap: 0
          },
          solver: 'barnesHut',
          stabilization: {
            enabled: true,
            iterations: 1000,
            updateInterval: 100,
            onlyDynamicEdges: false,
            fit: true
          }
        };
        // Cast the layout object to any to avoid TypeScript errors
        // This is necessary because the type definition might not include all properties
        (newOptions.layout as LayoutOptions) = {
          hierarchical: {
            direction: 'UD',
            sortMethod: 'directed',
            nodeSpacing: 150,
            treeSpacing: 200,
            levelSeparation: linkDistance * 2
          }
        };
      }
      
      // Update edge visibility based on showConnections state
      newOptions.edges = {
        ...newOptions.edges,
        hidden: !showConnections
      };
      
      return newOptions;
    });
  }, [layoutType, nodeRepulsion, linkDistance, springLength, springConstant, damping, showConnections]);
  
  // Get color based on node type
  const getNodeColor = (node: Neo4jNode): string => {
    if (node.labels.includes('Person')) {
      // Color based on clout score
      const cloutScore = node.properties.clout_score || 0;
      if (cloutScore > 75) return '#4CAF50'; // Green for high clout
      if (cloutScore > 50) return '#2196F3'; // Blue for medium-high clout
      if (cloutScore > 25) return '#FFC107'; // Amber for medium-low clout
      return '#F44336'; // Red for low clout
    }
    return '#9C27B0'; // Purple for other node types
  };

  // Get node shape based on node type
  const getNodeShape = (node: Neo4jNode): string => {
    if (node.labels.includes('Person')) {
      return 'dot';
    } else if (node.labels.includes('Company')) {
      return 'square';
    } else if (node.labels.includes('Project')) {
      return 'diamond';
    }
    return 'dot'; // Default shape
  };

  // Format data for vis.js
  const formatDataForVis = (data: GraphData): VisGraphData => {
    return {
      nodes: data.nodes.map(node => ({
        id: node.id,
        label: node.properties.name || node.id,
        title: `${node.properties.name || node.id}\nClout: ${node.properties.clout_score || 'N/A'}`,
        value: node.properties.clout_score || 5,
        color: getNodeColor(node),
        shape: getNodeShape(node),
        shadow: true,
        originalNode: node
      })),
      edges: data.relationships.map(rel => ({
        id: rel.id,
        from: rel.startNodeId,
        to: rel.endNodeId,
        label: rel.type,
        arrows: 'to',
        width: (rel.properties.strength || 1) / 2,
        smooth: {
          enabled: true,
          type: 'curvedCW',
          roundness: 0.2
        },
        originalRelationship: rel
      }))
    };
  };
  
  // Fetch graph data
  const fetchGraphData = async (page: number = 0, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        // Reset graph data if not appending
        if (!append) {
          setGraphData({ nodes: [], edges: [] });
        }
      }
      
      const response = await fetch(`/api/graph?page=${page}&batchSize=${batchSize}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch graph data');
      }
      
      const apiResponse: ApiResponse = await response.json();
      const data = apiResponse.data;
      
      // Update pagination information
      setPagination(apiResponse.pagination);
      
      // Format data for vis.js
      const formattedData = formatDataForVis(data);
      
      // If appending, merge with existing data
      if (append && graphData.nodes.length > 0) {
        // Create maps to track existing nodes and edges to avoid duplicates
        const existingNodes = new Map(graphData.nodes.map(node => [node.id, node]));
        const existingEdges = new Map(graphData.edges.map(edge => [edge.id, edge]));
        
        // Add new nodes if they don't already exist
        formattedData.nodes.forEach(node => {
          if (!existingNodes.has(node.id)) {
            existingNodes.set(node.id, node);
          }
        });
        
        // Add new edges if they don't already exist
        formattedData.edges.forEach(edge => {
          if (!existingEdges.has(edge.id)) {
            existingEdges.set(edge.id, edge);
          }
        });
        
        // Update graph data with merged data
        setGraphData({
          nodes: Array.from(existingNodes.values()),
          edges: Array.from(existingEdges.values())
        });
      } else {
        // Just set the new data
        setGraphData(formattedData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Handle node click
  const handleNodeClick = (params: any) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node = graphData.nodes.find(n => n.id === nodeId);
      
      if (node) {
        console.log('Node clicked:', node);
        setSelectedNode(node);
        setSelectedEdge(null);
        setShowDetailsPanel(true);
      }
    } else if (params.edges.length > 0) {
      const edgeId = params.edges[0];
      const edge = graphData.edges.find(e => e.id === edgeId);
      
      if (edge) {
        console.log('Edge clicked:', edge);
        setSelectedEdge(edge);
        setSelectedNode(null);
        setShowDetailsPanel(true);
      }
    } else {
      // Clicked on empty space
      setSelectedNode(null);
      setSelectedEdge(null);
      setShowDetailsPanel(false);
    }
  };

  // Handle node hover
  const handleNodeHover = (params: any) => {
    if (params.node) {
      const nodeId = params.node;
      const node = graphData.nodes.find(n => n.id === nodeId);
      
      if (node && graphRef.current && graphRef.current.Network) {
        // Highlight connected nodes
        const connectedNodes = getConnectedNodes(nodeId);
        graphRef.current.Network.selectNodes(connectedNodes);
      }
    }
  };

  // Handle node blur (mouse leave)
  const handleNodeBlur = () => {
    if (graphRef.current && graphRef.current.Network) {
      // Clear selection if not showing details panel
      if (!showDetailsPanel) {
        graphRef.current.Network.unselectAll();
      }
    }
  };

  // Get connected nodes to a given node
  const getConnectedNodes = (nodeId: string): string[] => {
    const connectedNodes = new Set<string>();
    connectedNodes.add(nodeId);
    
    // Find all edges connected to this node
    graphData.edges.forEach(edge => {
      if (edge.from === nodeId) {
        connectedNodes.add(edge.to);
      } else if (edge.to === nodeId) {
        connectedNodes.add(edge.from);
      }
    });
    
    return Array.from(connectedNodes);
  };

  // Focus on a specific node
  const focusOnNode = (nodeId: string) => {
    if (graphRef.current && graphRef.current.Network) {
      graphRef.current.Network.focus(nodeId, {
        scale: 1.5,
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad'
        }
      });
    }
  };
  
  // Load graph data on component mount
  useEffect(() => {
    fetchGraphData();
  }, []);
  
  // Events for the graph
  const events = {
    select: handleNodeClick,
    hoverNode: handleNodeHover,
    blurNode: handleNodeBlur,
    stabilizationIterationsDone: () => {
      console.log('Stabilization completed');
    }
  };
  
  // Load next batch of data
  const loadMoreData = async () => {
    if (pagination && pagination.hasMore) {
      await fetchGraphData(pagination.page + 1, true);
    }
  };
  
  // Generate random graph data
  const generateRandomGraph = async () => {
    try {
      setGenerating(true);
      const response = await fetch('/api/graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeCount,
          relationshipCount,
          batchSize: 500, // Use a reasonable batch size for generation
          clearExisting: true
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate graph');
      }
      
      // Reset and fetch first page of data
      await fetchGraphData(0, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setGenerating(false);
    }
  };
  
  // Reset graph layout
  const resetGraphLayout = () => {
    setSpringLength(250);
    setSpringConstant(0.04);
    setDamping(0.09);
    setNodeRepulsion(1000);
    setLinkDistance(100);
    setLayoutType('force');
    
    // If we have a network instance, stabilize it
    if (graphRef.current && graphRef.current.Network) {
      graphRef.current.Network.stabilize();
    }
  };
  
  // Apply force to spread nodes
  const applyForceSpread = () => {
    setNodeRepulsion(prev => prev * 1.5);
    setSpringLength(prev => prev * 1.5);
    
    // If we have a network instance, stabilize it
    if (graphRef.current && graphRef.current.Network) {
      graphRef.current.Network.stabilize();
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Graph Visualization</h1>
        <Link
          href="/"
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
        >
          Back to Home
        </Link>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <button 
            className="underline ml-2" 
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Generate Random Graph Form */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Generate Random Graph</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Nodes
            </label>
            <input
              type="number"
              value={nodeCount}
              onChange={(e) => setNodeCount(Number(e.target.value))}
              min="1"
              max="10000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Relationships
            </label>
            <input
              type="number"
              value={relationshipCount}
              onChange={(e) => setRelationshipCount(Number(e.target.value))}
              min="0"
              max="100000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              Recommended: {nodeCount * 10} (10x the number of nodes)
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Size
            </label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              min="100"
              max="5000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              Controls how many items are loaded per page
            </p>
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={generateRandomGraph}
            disabled={generating}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Random Graph'}
          </button>
          
          <button
            onClick={() => fetchGraphData(0, false)}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Graph'}
          </button>
          
          <button
            onClick={applyForceSpread}
            className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded"
          >
            Spread Out Nodes
          </button>
          
          <button
            onClick={resetGraphLayout}
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
          >
            Reset Layout
          </button>
        </div>
      </div>
      
      {/* Graph Layout Controls */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Graph Layout Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Layout Type
            </label>
            <select 
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value as LayoutType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="force">Force-Directed</option>
              <option value="hierarchical">Hierarchical</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Show Connections
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                id="showConnections"
                checked={showConnections}
                onChange={(e) => setShowConnections(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="showConnections" className="ml-2 block text-sm text-gray-900">
                {showConnections ? 'Connections Visible' : 'Connections Hidden'}
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Node Repulsion: {nodeRepulsion}
            </label>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={nodeRepulsion}
              onChange={(e) => setNodeRepulsion(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values push nodes further apart
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spring Length: {springLength}
            </label>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={springLength}
              onChange={(e) => setSpringLength(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Controls the ideal distance between connected nodes
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spring Constant: {springConstant.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={springConstant}
              onChange={(e) => setSpringConstant(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Controls the stiffness of the springs
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Damping: {damping.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={damping}
              onChange={(e) => setDamping(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values slow down node movement (more stable)
            </p>
          </div>
          
          <div>
            <button
              onClick={() => {
                if (graphRef.current && graphRef.current.Network) {
                  graphRef.current.Network.stabilize();
                }
              }}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 px-4 rounded"
            >
              Stabilize Network
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Restarts the physics simulation with current settings
            </p>
          </div>
        </div>
      </div>
      
      {/* Pagination Info */}
      {pagination && (
        <div className="bg-white shadow-md rounded p-4 mb-6">
          <div className="flex flex-wrap justify-between items-center">
            <div className="text-sm">
              <span className="font-medium">Page:</span> {pagination.page + 1} of {pagination.totalPages || 1}
              {' | '}
              <span className="font-medium">Nodes:</span> {graphData.nodes.length} of {pagination.nodeCount}
              {' | '}
              <span className="font-medium">Relationships:</span> {graphData.edges.length} of {pagination.relationshipCount}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => fetchGraphData(0, false)}
                disabled={loading || pagination.page === 0}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                First
              </button>
              
              <button
                onClick={() => fetchGraphData(Math.max(0, pagination.page - 1), false)}
                disabled={loading || pagination.page === 0}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              
              <button
                onClick={() => fetchGraphData(pagination.page + 1, false)}
                disabled={loading || !pagination.hasMore}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
              
              <button
                onClick={loadMoreData}
                disabled={loadingMore || !pagination.hasMore}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Graph Legend */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">Legend</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
            <span>High Clout (75-100)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
            <span>Medium-High Clout (50-75)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-amber-500 mr-2"></div>
            <span>Medium-Low Clout (25-50)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
            <span>Low Clout (0-25)</span>
          </div>
        </div>
      </div>
      
      {/* Node Details Panel */}
      {showDetailsPanel && (selectedNode || selectedEdge) && (
        <div className="bg-white shadow-md rounded p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {selectedNode ? 'Node Details' : 'Edge Details'}
            </h2>
            <button
              onClick={() => setShowDetailsPanel(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
          
          {selectedNode && (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">ID</p>
                  <p className="font-mono">{selectedNode.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Labels</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.originalNode.labels.map((label, i) => (
                      <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Properties</p>
                <div className="bg-gray-50 p-3 rounded overflow-auto max-h-60">
                  <pre className="text-xs">
                    {JSON.stringify(selectedNode.originalNode.properties, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Connected Nodes</p>
                <div className="max-h-40 overflow-y-auto">
                  {graphData.edges
                    .filter(edge => edge.from === selectedNode.id || edge.to === selectedNode.id)
                    .map((edge, i) => {
                      const connectedNodeId = edge.from === selectedNode.id ? edge.to : edge.from;
                      const connectedNode = graphData.nodes.find(n => n.id === connectedNodeId);
                      const direction = edge.from === selectedNode.id ? 'outgoing' : 'incoming';
                      
                      return (
                        <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded">
                          <div>
                            <span className="font-medium">{connectedNode?.label || connectedNodeId}</span>
                            <span className="mx-2 text-gray-500">
                              {direction === 'outgoing' ? '→' : '←'}
                            </span>
                            <span className="text-xs text-gray-500">{edge.label}</span>
                          </div>
                          <button
                            onClick={() => focusOnNode(connectedNodeId)}
                            className="text-blue-500 hover:text-blue-700 text-xs"
                          >
                            Focus
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
          
          {selectedEdge && (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">ID</p>
                  <p className="font-mono">{selectedEdge.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <p>{selectedEdge.label}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">From</p>
                  <button
                    onClick={() => {
                      const node = graphData.nodes.find(n => n.id === selectedEdge?.from);
                      if (node) {
                        setSelectedNode(node);
                        setSelectedEdge(null);
                        focusOnNode(node.id);
                      }
                    }}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {graphData.nodes.find(n => n.id === selectedEdge.from)?.label || selectedEdge.from}
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">To</p>
                  <button
                    onClick={() => {
                      const node = graphData.nodes.find(n => n.id === selectedEdge?.to);
                      if (node) {
                        setSelectedNode(node);
                        setSelectedEdge(null);
                        focusOnNode(node.id);
                      }
                    }}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {graphData.nodes.find(n => n.id === selectedEdge.to)?.label || selectedEdge.to}
                  </button>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Properties</p>
                <div className="bg-gray-50 p-3 rounded overflow-auto max-h-60">
                  <pre className="text-xs">
                    {JSON.stringify(selectedEdge.originalRelationship.properties, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Graph Visualization */}
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Graph Visualization</h2>
        
        {loading && !graphData.nodes.length ? (
          <div className="h-[600px] w-full flex items-center justify-center bg-gray-100">
            <p>Loading graph data...</p>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="h-[600px] w-full flex items-center justify-center bg-gray-100">
            <p>No graph data available. Generate a random graph to get started.</p>
          </div>
        ) : isBrowser ? (
          <div className="h-[600px] w-full border border-gray-200 rounded-md overflow-hidden">
            <Graph
              key="graph-visualization"
              graph={graphData}
              options={graphOptions}
              events={events}
              getNetwork={(network) => {
                // Store network in component for later use
                graphRef.current = network;
              }}
              style={{ height: '100%', width: '100%' }}
            />
            
            {/* Loading indicator for "Load More" */}
            {loadingMore && (
              <div className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-full shadow-md">
                Loading more data...
              </div>
            )}
          </div>
        ) : (
          <div className="h-[600px] w-full flex items-center justify-center bg-gray-100">
            <p>Initializing graph visualization...</p>
          </div>
        )}
      </div>
    </div>
  );
}