"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Options, Network } from "react-graph-vis";
import type { NvlOptions } from '@neo4j-nvl/base';

const Graph = dynamic(() => import("react-graph-vis"), {
  ssr: false,
  loading: () => <p>Loading Graph...</p>,
});

interface GraphData {
  nodes: Node[];
  relationships: Relationship[];
}

interface Node {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface Relationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
}

interface GraphStats {
  nodeCount: number;
  relationshipCount: number;
}

interface ApiResponse {
  data: GraphData;
  stats: GraphStats;
}

interface VisNode {
  id: string;
  label: string;
  title: string;
  color: string;
  font: { size: number };
  shape: string;
  size: number;
}

interface VisEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  arrows: string;
  title: string;
}

interface VisData {
  nodes: VisNode[];
  edges: VisEdge[];
}

const convertToVisFormat = (graphData: GraphData): VisData => {
  const visNodes = graphData.nodes.map((node) => {
    // Determine color based on clout_score or pagerank_score
    let color = "#97C2FC"; // Default color
    let size = 10; // Default size
    
    // Check for pagerank_score or clout_score
    if (node.properties.pagerank_score !== undefined || node.properties.clout_score !== undefined) {
      // Prefer pagerank_score if available, otherwise use clout_score
      const score = node.properties.pagerank_score !== undefined 
        ? parseFloat(node.properties.pagerank_score) 
        : (node.properties.clout_score !== undefined 
            ? parseFloat(node.properties.clout_score) / 100 // Normalize clout_score to 0-1 range
            : 0.5); // Default if no score available
      
      // Color based on score
      if (score > 0.7) color = "#00AA00"; // Dark green for high scores
      else if (score > 0.4) color = "#88CC00"; // Light green for medium-high scores
      else if (score > 0.2) color = "#FFCC00"; // Yellow for medium scores
      else color = "#FF6600"; // Orange for low scores
      
      // Size based on score (10-30 range)
      size = 10 + Math.round(score * 20);
    }

    // Create a more detailed tooltip
    const tooltipProperties = { ...node.properties };
    
    // Format the pagerank and clout scores for display
    if (tooltipProperties.pagerank_score !== undefined) {
      tooltipProperties.pagerank_score = parseFloat(tooltipProperties.pagerank_score).toFixed(4);
    }
    if (tooltipProperties.clout_score !== undefined) {
      tooltipProperties.clout_score = parseFloat(tooltipProperties.clout_score).toFixed(1);
    }
    
    // Remove large profile_data from tooltip to avoid overwhelming the user
    delete tooltipProperties.profile_data;
    
    const tooltip = `
      <div style="max-width: 300px; padding: 10px;">
        <h3 style="margin-top: 0;">${tooltipProperties.name || node.id}</h3>
        <p><strong>ID:</strong> ${node.id}</p>
        ${tooltipProperties.pagerank_score ? `<p><strong>PageRank:</strong> ${tooltipProperties.pagerank_score}</p>` : ''}
        ${tooltipProperties.clout_score ? `<p><strong>Clout Score:</strong> ${tooltipProperties.clout_score}</p>` : ''}
        ${tooltipProperties.connection_count ? `<p><strong>Connections:</strong> ${tooltipProperties.connection_count}</p>` : ''}
      </div>
    `;

    return {
      id: node.id,
      label: node.properties.name || node.properties.username || node.id,
      title: tooltip,
      color: color,
      font: { size: 14 },
      shape: "dot",
      size: size,
    };
  });

  const visEdges = graphData.relationships.map((rel) => ({
    id: rel.id,
    from: rel.startNodeId,
    to: rel.endNodeId,
    label: rel.type,
    arrows: "to",
    title: JSON.stringify(rel.properties, null, 2),
  }));

  return { nodes: visNodes, edges: visEdges };
};

export default function GraphPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [visData, setVisData] = useState<VisData>({ nodes: [], edges: [] });
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const networkRef = useRef<Network | null>(null);

  const options: NvlOptions = {
    layout: {
      hierarchical: {
        enabled: false,
        direction: "UD",
        sortMethod: "hubsize"
      },
      improvedLayout: true,
    },
    edges: {
      color: "#000000",
      smooth: {
        enabled: true,
        type: "continuous",
        forceDirection: "none",
        roundness: 0.5
      },
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 1,
          type: "arrow"
        }
      }
    },
    physics: {
      stabilization: {
        iterations: 200,
      },
      barnesHut: {
        gravitationalConstant: -80000,
        centralGravity: 0.3,
        springLength: 95,
        springConstant: 0.04,
        damping: 0.09,
      },
    },
    interaction: {
      navigationButtons: true,
      keyboard: true,
      tooltipDelay: 300,
      hover: true,
    },
    nodes: {
      scaling: {
        min: 10,
        max: 30,
        label: {
          enabled: true,
          min: 14,
          max: 24
        }
      }
    },
  };

  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/graph');
      if (!response.ok) {
        throw new Error(`Error fetching graph data: ${response.status} ${response.statusText}`);
      }
      const result: ApiResponse = await response.json();
      setGraphData(result.data);
      setStats(result.stats);
      
      // Convert to vis.js format
      const visFormatData = convertToVisFormat(result.data);
      setVisData(visFormatData);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const events = {
    select: function(event: any) {
      const { nodes, edges } = event;
      console.log("Selected nodes:", nodes);
      console.log("Selected edges:", edges);
    },
    stabilized: function() {
      console.log("Graph stabilized");
    },
    doubleClick: function(event: any) {
      const { nodes } = event;
      if (nodes.length > 0) {
        const nodeId = nodes[0];
        const node = graphData?.nodes.find(n => n.id === nodeId);
        if (node) {
          alert(`Node Details:\n${JSON.stringify(node.properties, null, 2)}`);
        }
      }
    },
  };

  const getNetwork = (network: Network) => {
    networkRef.current = network;
  };

  const zoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale() * 1.2;
      const position = networkRef.current.getViewPosition();
      networkRef.current.moveTo({ 
        position: position,
        scale: scale 
      });
    }
  };

  const zoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale() / 1.2;
      const position = networkRef.current.getViewPosition();
      networkRef.current.moveTo({ 
        position: position,
        scale: scale 
      });
    }
  };

  const resetView = () => {
    if (networkRef.current) {
      networkRef.current.fit();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white p-4 shadow-md mb-4">
        <h1 className="text-2xl font-bold mb-2">Neo4j Graph Visualization</h1>
        
        {stats && (
          <div className="text-sm text-gray-600 mb-2">
            <span className="mr-4">Nodes: {stats.nodeCount}</span>
            <span>Relationships: {stats.relationshipCount}</span>
          </div>
        )}
        
        <div className="flex space-x-2 mb-2">
          <button 
            onClick={zoomIn}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded"
          >
            Zoom In
          </button>
          <button 
            onClick={zoomOut}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded"
          >
            Zoom Out
          </button>
          <button 
            onClick={resetView}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded"
          >
            Reset View
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          <p>Node size and color indicate influence based on PageRank algorithm:</p>
          <div className="flex items-center mt-1">
            <span className="inline-block w-4 h-4 bg-[#00AA00] mr-2"></span>
            <span className="mr-4">High influence</span>
            <span className="inline-block w-4 h-4 bg-[#88CC00] mr-2"></span>
            <span className="mr-4">Medium-high influence</span>
            <span className="inline-block w-4 h-4 bg-[#FFCC00] mr-2"></span>
            <span className="mr-4">Medium influence</span>
            <span className="inline-block w-4 h-4 bg-[#FF6600] mr-2"></span>
            <span>Low influence</span>
          </div>
        </div>
      </div>
      
      <div className="flex-grow bg-gray-100 p-4 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="text-xl">Loading graph data...</div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>Error: {error}</p>
          </div>
        )}
        
        {!loading && !error && visData.nodes.length === 0 && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            <p>No graph data available. The database may be empty.</p>
          </div>
        )}
        
        {!loading && !error && visData.nodes.length > 0 && (
          <div className="w-full h-full border border-gray-300 rounded">
            <Graph
              graph={visData}
              options={options}
              events={events}
              getNetwork={getNetwork}
              style={{ height: "100%" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}