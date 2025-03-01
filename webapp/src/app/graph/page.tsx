'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import only ForceGraph2D to avoid A-Frame dependency issues
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
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

// Interface for react-force-graph node
interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  labels: string[];
  properties: Record<string, any>;
}

// Interface for react-force-graph link
interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

// Interface for formatted data for react-force-graph
interface FormattedGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function GraphPage() {
  const [graphData, setGraphData] = useState<FormattedGraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState<number>(10);
  const [relationshipCount, setRelationshipCount] = useState<number>(15);
  const [generating, setGenerating] = useState<boolean>(false);
  const [isBrowser, setIsBrowser] = useState<boolean>(false);
  const graphRef = useRef<any>(null);
  
  // Check if we're in the browser
  useEffect(() => {
    setIsBrowser(true);
  }, []);
  
  // Fetch graph data
  const fetchGraphData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/graph');
      
      if (!response.ok) {
        throw new Error('Failed to fetch graph data');
      }
      
      const data: GraphData = await response.json();
      
      // Format data for react-force-graph
      const formattedData: FormattedGraphData = {
        nodes: data.nodes.map(node => ({
          id: node.id,
          name: node.properties.name || node.id,
          val: node.properties.clout_score || 5,
          color: getNodeColor(node),
          labels: node.labels,
          properties: node.properties
        })),
        links: data.relationships.map(rel => ({
          id: rel.id,
          source: rel.startNodeId,
          target: rel.endNodeId,
          type: rel.type,
          properties: rel.properties
        }))
      };
      
      setGraphData(formattedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
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
          relationshipCount
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate graph');
      }
      
      await fetchGraphData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setGenerating(false);
    }
  };
  
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
  
  // Load graph data on component mount
  useEffect(() => {
    fetchGraphData();
  }, []);
  
  // Handle node click
  const handleNodeClick = (node: any) => {
    // Focus on the node
    if (graphRef.current && node.x !== undefined && node.y !== undefined) {
      graphRef.current.centerAt(node.x, node.y, 1000);
      graphRef.current.zoom(2, 1000);
    }
    
    // You could also display more information about the node here
    console.log('Node clicked:', node);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Nodes
            </label>
            <input
              type="number"
              value={nodeCount}
              onChange={(e) => setNodeCount(Number(e.target.value))}
              min="1"
              max="1000"
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
              max="200"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        <div className="mt-4 flex space-x-4">
          <button
            onClick={generateRandomGraph}
            disabled={generating}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Random Graph'}
          </button>
          
          <button
            onClick={fetchGraphData}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Graph'}
          </button>
        </div>
      </div>
      
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
      
      {/* Graph Visualization */}
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Graph Visualization</h2>
        
        {loading ? (
          <div className="h-[600px] w-full flex items-center justify-center bg-gray-100">
            <p>Loading graph data...</p>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="h-[600px] w-full flex items-center justify-center bg-gray-100">
            <p>No graph data available. Generate a random graph to get started.</p>
          </div>
        ) : isBrowser ? (
          <div className="h-[600px] w-full border border-gray-200 rounded-md overflow-hidden">
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeLabel={node => `${node.name} (Clout: ${node.properties.clout_score})`}
              linkLabel={link => `${link.type} (Strength: ${link.properties.strength || 'N/A'})`}
              nodeColor={node => node.color}
              nodeVal={node => node.val}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.25}
              onNodeClick={handleNodeClick}
              cooldownTicks={100}
              linkWidth={link => (link.properties.strength || 1) / 2}
            />
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
