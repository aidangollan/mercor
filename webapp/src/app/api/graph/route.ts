import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '~/server/db/neo4j';

// Interface for graph data
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

/**
 * GET /api/graph
 * Returns the current state of the graph
 */
export async function GET(request: NextRequest) {
  try {
    const graphData = await getGraphData();
    
    // Get total counts for statistics
    const countResult = await runQuery(`
      MATCH (n:Person)
      RETURN count(n) AS nodeCount
    `);
    
    const relationshipCountResult = await runQuery(`
      MATCH (:Person)-[r]->(:Person)
      RETURN count(r) AS relationshipCount
    `);
    
    // Access the Neo4j integer values correctly
    const nodeCount = countResult[0] && typeof countResult[0] === 'object' && 'nodeCount' in countResult[0] 
      ? (countResult[0].nodeCount !== null && typeof countResult[0].nodeCount === 'object' && 'low' in countResult[0].nodeCount 
          ? countResult[0].nodeCount.low 
          : countResult[0].nodeCount) || 0
      : 0;
      
    const relationshipCount = relationshipCountResult[0] && typeof relationshipCountResult[0] === 'object' && 'relationshipCount' in relationshipCountResult[0]
      ? (relationshipCountResult[0].relationshipCount !== null && typeof relationshipCountResult[0].relationshipCount === 'object' && 'low' in relationshipCountResult[0].relationshipCount
          ? relationshipCountResult[0].relationshipCount.low
          : relationshipCountResult[0].relationshipCount) || 0
      : 0;
    
    return NextResponse.json({
      data: graphData,
      stats: {
        nodeCount,
        relationshipCount
      }
    });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    return NextResponse.json({ error: 'Failed to fetch graph data' }, { status: 500 });
  }
}

/**
 * Helper function to get the current graph data without pagination
 */
async function getGraphData(): Promise<GraphData> {
  // Fetch all nodes
  const nodesCypher = `
    MATCH (n:Person)
    RETURN n
  `;
  
  const nodesResult = await runQuery(nodesCypher);
  
  // Process nodes
  const nodes = new Map<string, Node>();
  
  nodesResult.forEach((record: any) => {
    if (record.n) {
      // Extract the node's internal ID from Neo4j
      let nodeId;
      
      if (typeof record.n === 'object') {
        if (record.n.identity !== undefined) {
          // Use the Neo4j internal ID if available
          nodeId = record.n.identity.toString();
        } else if (record.n.elementId !== undefined) {
          // Fallback to elementId if available
          nodeId = record.n.elementId.toString();
        } else {
          // Generate a unique ID if neither is available
          nodeId = `node-${nodes.size}`;
        }
      } else {
        nodeId = `node-${nodes.size}`;
      }
        
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          labels: Array.isArray(record.n.labels) ? record.n.labels : [],
          properties: record.n.properties || record.n
        });
      }
    }
  });
  
  // Fetch all relationships
  const relationshipsCypher = `
    MATCH (n:Person)-[r]->(m:Person)
    RETURN n, r, m
  `;
  
  // If we have no nodes, return empty result
  if (nodes.size === 0) {
    return {
      nodes: [],
      relationships: []
    };
  }
  
  const relationshipsResult = await runQuery(relationshipsCypher);
  
  // Process relationships and any additional nodes
  const relationships: Relationship[] = [];
  
  relationshipsResult.forEach((record: any) => {
    // Process additional nodes that might be connected
    if (record.n) {
      // Extract the node's internal ID from Neo4j
      let nodeId;
      
      if (typeof record.n === 'object') {
        if (record.n.identity !== undefined) {
          // Use the Neo4j internal ID if available
          nodeId = record.n.identity.toString();
        } else if (record.n.elementId !== undefined) {
          // Fallback to elementId if available
          nodeId = record.n.elementId.toString();
        } else {
          // Generate a unique ID if neither is available
          nodeId = `node-${nodes.size}`;
        }
      } else {
        nodeId = `node-${nodes.size}`;
      }
        
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          labels: Array.isArray(record.n.labels) ? record.n.labels : [],
          properties: record.n.properties || record.n
        });
      }
    }
    
    if (record.m) {
      // Extract the node's internal ID from Neo4j
      let nodeId;
      
      if (typeof record.m === 'object') {
        if (record.m.identity !== undefined) {
          // Use the Neo4j internal ID if available
          nodeId = record.m.identity.toString();
        } else if (record.m.elementId !== undefined) {
          // Fallback to elementId if available
          nodeId = record.m.elementId.toString();
        } else {
          // Generate a unique ID if neither is available
          nodeId = `node-${nodes.size}`;
        }
      } else {
        nodeId = `node-${nodes.size}`;
      }
        
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          labels: Array.isArray(record.m.labels) ? record.m.labels : [],
          properties: record.m.properties || record.m
        });
      }
    }
    
    // Process relationship
    if (record.r) {
      // Extract the relationship's internal ID from Neo4j
      let relId;
      
      if (typeof record.r === 'object') {
        if (record.r.identity !== undefined) {
          // Use the Neo4j internal ID if available
          relId = record.r.identity.toString();
        } else if (record.r.elementId !== undefined) {
          // Fallback to elementId if available
          relId = record.r.elementId.toString();
        } else {
          // Generate a unique ID if neither is available
          relId = `rel-${relationships.length}`;
        }
      } else {
        relId = `rel-${relationships.length}`;
      }
        
      // Get start and end node IDs
      let startNodeId = null;
      if (typeof record.n === 'object') {
        if (record.n.identity !== undefined) {
          startNodeId = record.n.identity.toString();
        } else if (record.n.elementId !== undefined) {
          startNodeId = record.n.elementId.toString();
        }
      }
      
      let endNodeId = null;
      if (typeof record.m === 'object') {
        if (record.m.identity !== undefined) {
          endNodeId = record.m.identity.toString();
        } else if (record.m.elementId !== undefined) {
          endNodeId = record.m.elementId.toString();
        }
      }
      
      // Only add relationship if we have both start and end nodes
      if (startNodeId && endNodeId) {
        relationships.push({
          id: relId,
          type: record.r && typeof record.r.type === 'string' ? record.r.type : 'RELATED_TO',
          startNodeId: startNodeId,
          endNodeId: endNodeId,
          properties: record.r && record.r.properties ? record.r.properties : record.r
        });
      }
    }
  });
  
  return {
    nodes: Array.from(nodes.values()),
    relationships: relationships
  };
}