import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '~/server/db/neo4j';
import { Person } from '~/server/db/models/person';
import { int } from 'neo4j-driver';

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

// Interface for Neo4j count result
interface Neo4jCountResult {
  nodeCount?: { low: number; high: number } | number;
  relationshipCount?: { low: number; high: number } | number;
}

/**
 * GET /api/graph
 * Returns the current state of the graph
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const batchSize = Math.floor(parseInt(url.searchParams.get('batchSize') || '1000'));
    const page = Math.floor(parseInt(url.searchParams.get('page') || '0'));
    
    const graphData = await getGraphData(batchSize, page);
    
    // Get total counts for pagination info
    const countResult = await runQuery(`
      MATCH (n)
      RETURN count(n) AS nodeCount
    `);
    
    const relationshipCountResult = await runQuery(`
      MATCH ()-[r]->()
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
    
    // Ensure nodeCount and relationshipCount are numbers
    const nodeCountNum = typeof nodeCount === 'object' && nodeCount !== null ? 0 : Number(nodeCount);
    const relationshipCountNum = typeof relationshipCount === 'object' && relationshipCount !== null ? 0 : Number(relationshipCount);
    
    const totalPages = Math.ceil(Math.max(nodeCountNum, relationshipCountNum) / batchSize);
    
    return NextResponse.json({
      data: graphData,
      pagination: {
        page,
        batchSize,
        totalPages,
        nodeCount,
        relationshipCount,
        hasMore: page < totalPages - 1
      }
    });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    return NextResponse.json({ error: 'Failed to fetch graph data' }, { status: 500 });
  }
}

/**
 * POST /api/graph/generate
 * Generates random nodes and relationships in the graph
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      nodeCount = 10, 
      relationshipCount = 15,
      batchSize = 500,
      clearExisting = true
    } = await request.json();
    
    // Validate input
    if (nodeCount < 1 || nodeCount > 10000) {
      return NextResponse.json(
        { error: 'nodeCount must be between 1 and 10000' },
        { status: 400 }
      );
    }
    
    if (relationshipCount < 0 || relationshipCount > 100000) {
      return NextResponse.json(
        { error: 'relationshipCount must be between 0 and 100000' },
        { status: 400 }
      );
    }
    
    if (batchSize < 1 || batchSize > 5000) {
      return NextResponse.json(
        { error: 'batchSize must be between 1 and 5000' },
        { status: 400 }
      );
    }
    
    // Convert all inputs to integers
    const nodeCountInt = Math.floor(nodeCount);
    const relationshipCountInt = Math.floor(relationshipCount);
    const batchSizeInt = Math.floor(batchSize);
    
    // First, clear the existing graph if requested
    if (clearExisting) {
      await runQuery(`
        MATCH (n)
        DETACH DELETE n
      `);
    }
    
    // Generate random people names
    const names = [
      'Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 
      'Isabella', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter', 
      'Quinn', 'Ryan', 'Sophia', 'Thomas', 'Uma', 'Victor', 'Wendy', 'Xavier', 
      'Yasmine', 'Zach'
    ];
    
    // Create nodes in batches
    const nodeBatches = Math.ceil(nodeCountInt / batchSizeInt);
    console.log(`Creating ${nodeCountInt} nodes in ${nodeBatches} batches of up to ${batchSizeInt} nodes each`);
    
    for (let batch = 0; batch < nodeBatches; batch++) {
      const currentBatchSize = Math.min(batchSizeInt, nodeCountInt - (batch * batchSizeInt));
      const batchStart = batch * batchSizeInt;
      
      // Create a batch of parameters for this batch
      const params: Record<string, any> = {};
      let cypherCreate = `UNWIND range(0, ${currentBatchSize - 1}) AS i CREATE (p:Person {`;
      
      // Add parameters for name, clout_score, and linkedin_url
      ['name', 'clout_score', 'linkedin_url'].forEach(prop => {
        params[prop] = [];
        for (let i = 0; i < currentBatchSize; i++) {
          const idx = batchStart + i;
          const randomNameIndex = Math.floor(Math.random() * names.length);
          const name = `${names[randomNameIndex]}_${idx}`;
          
          if (prop === 'name') {
            params[prop].push(name);
          } else if (prop === 'clout_score') {
            params[prop].push(Math.floor(Math.random() * 100));
          } else if (prop === 'linkedin_url') {
            params[prop].push(`https://linkedin.com/in/${name.toLowerCase()}`);
          }
        }
      });
      
      // Complete the Cypher query
      cypherCreate += `name: $name[i], clout_score: $clout_score[i], linkedin_url: $linkedin_url[i]})`;
      
      // Execute the batch creation
      await runQuery(cypherCreate, params);
      console.log(`Created batch ${batch + 1}/${nodeBatches} with ${currentBatchSize} nodes`);
    }
    
    // Create random KNOWS relationships in batches
    const relationshipTypes = ['KNOWS', 'WORKS_WITH', 'MANAGES', 'MENTORS'];
    const relationshipBatches = Math.ceil(relationshipCountInt / batchSizeInt);
    console.log(`Creating ${relationshipCountInt} relationships in ${relationshipBatches} batches of up to ${batchSizeInt} relationships each`);
    
    for (let batch = 0; batch < relationshipBatches; batch++) {
      const currentBatchSize = Math.min(batchSizeInt, relationshipCountInt - (batch * batchSizeInt));
      const randomType = relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)];
      
      // Create a batch of relationships at once
      await runQuery(`
        MATCH (p1:Person)
        MATCH (p2:Person)
        WHERE p1 <> p2
        WITH p1, p2, rand() AS r
        ORDER BY r
        LIMIT $batchSize
        MERGE (p1)-[rel:${randomType} {strength: toInteger(rand() * 10) + 1}]->(p2)
        RETURN count(rel)
      `, { batchSize: int(Math.floor(currentBatchSize)) });
      
      console.log(`Created batch ${batch + 1}/${relationshipBatches} with ${currentBatchSize} relationships of type ${randomType}`);
    }
    
    // Return the new graph data (first page only)
    const graphData = await getGraphData(1000, 0);
    
    // Get total counts
    const countResult = await runQuery(`
      MATCH (n)
      RETURN count(n) AS nodeCount
    `);
    
    const relationshipCountResult = await runQuery(`
      MATCH ()-[r]->()
      RETURN count(r) AS relationshipCount
    `);
    
    // Access the Neo4j integer values correctly
    const actualNodeCount = countResult[0] && typeof countResult[0] === 'object' && 'nodeCount' in countResult[0] 
      ? (countResult[0].nodeCount !== null && typeof countResult[0].nodeCount === 'object' && 'low' in countResult[0].nodeCount 
          ? countResult[0].nodeCount.low 
          : countResult[0].nodeCount) || 0
      : 0;
      
    const actualRelationshipCount = relationshipCountResult[0] && typeof relationshipCountResult[0] === 'object' && 'relationshipCount' in relationshipCountResult[0]
      ? (relationshipCountResult[0].relationshipCount !== null && typeof relationshipCountResult[0].relationshipCount === 'object' && 'low' in relationshipCountResult[0].relationshipCount
          ? relationshipCountResult[0].relationshipCount.low
          : relationshipCountResult[0].relationshipCount) || 0
      : 0;
    
    return NextResponse.json({ 
      message: `Generated ${actualNodeCount} nodes and ${actualRelationshipCount} relationships`,
      data: graphData,
      pagination: {
        page: 0,
        batchSize: 1000,
        totalNodes: actualNodeCount,
        totalRelationships: actualRelationshipCount
      }
    });
  } catch (error) {
    console.error('Error generating graph data:', error);
    return NextResponse.json({ error: 'Failed to generate graph data' }, { status: 500 });
  }
}

/**
 * Helper function to get the current graph data with pagination
 */
async function getGraphData(batchSize: number = 1000, page: number = 0): Promise<GraphData> {
  // Fetch nodes with pagination
  const nodesCypher = `
    MATCH (n)
    RETURN n
    SKIP $skip
    LIMIT $limit
  `;
  
  const nodesResult = await runQuery(nodesCypher, { 
    skip: int(Math.floor(page * batchSize)), 
    limit: int(Math.floor(batchSize)) 
  });
  
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
  
  // Fetch relationships with pagination - use a simpler approach
  const relationshipsCypher = `
    MATCH (n)-[r]->(m)
    RETURN n, r, m
    SKIP $skip
    LIMIT $limit
  `;
  
  // If we have no nodes, return empty result
  if (nodes.size === 0) {
    return {
      nodes: [],
      relationships: []
    };
  }
  
  const relationshipsResult = await runQuery(relationshipsCypher, { 
    skip: int(Math.floor(page * batchSize)),
    limit: int(Math.floor(batchSize))
  });
  
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