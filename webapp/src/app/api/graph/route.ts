import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '~/server/db/neo4j';
import { Person } from '~/server/db/models/person';

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
export async function GET() {
  try {
    const cypher = `
      MATCH (n)
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN n, r, m
    `;
    
    const result = await runQuery(cypher);
    
    // Process the results to create a graph structure
    const nodes = new Map<string, Node>();
    const relationships: Relationship[] = [];
    
    result.forEach((record: any) => {
      // Process node n
      if (record.n) {
        // Use elementId for Neo4j 5+ or create a unique ID if not available
        const nodeId = typeof record.n === 'object' && record.n.elementId 
          ? record.n.elementId.toString() 
          : `node-${Object.keys(nodes).length}`;
          
        if (!nodes.has(nodeId)) {
          nodes.set(nodeId, {
            id: nodeId,
            labels: Array.isArray(record.n.labels) ? record.n.labels : [],
            properties: record.n
          });
        }
      }
      
      // Process node m
      if (record.m) {
        // Use elementId for Neo4j 5+ or create a unique ID if not available
        const nodeId = typeof record.m === 'object' && record.m.elementId 
          ? record.m.elementId.toString() 
          : `node-${Object.keys(nodes).length}`;
          
        if (!nodes.has(nodeId)) {
          nodes.set(nodeId, {
            id: nodeId,
            labels: Array.isArray(record.m.labels) ? record.m.labels : [],
            properties: record.m
          });
        }
      }
      
      // Process relationship r
      if (record.r) {
        const relId = typeof record.r === 'object' && record.r.elementId 
          ? record.r.elementId.toString() 
          : `rel-${relationships.length}`;
          
        // Get start and end node IDs
        const startNodeId = typeof record.n === 'object' && record.n.elementId 
          ? record.n.elementId.toString() 
          : `node-${Object.keys(nodes).length-2}`;
          
        const endNodeId = typeof record.m === 'object' && record.m.elementId 
          ? record.m.elementId.toString() 
          : `node-${Object.keys(nodes).length-1}`;
          
        relationships.push({
          id: relId,
          type: typeof record.r.type === 'string' ? record.r.type : 'RELATED_TO',
          startNodeId: startNodeId,
          endNodeId: endNodeId,
          properties: record.r
        });
      }
    });
    
    const graphData: GraphData = {
      nodes: Array.from(nodes.values()),
      relationships: relationships
    };
    
    return NextResponse.json(graphData);
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
    const { nodeCount = 10, relationshipCount = 15 } = await request.json();
    
    // Validate input
    if (nodeCount < 1 || nodeCount > 1000) {
      return NextResponse.json(
        { error: 'nodeCount must be between 1 and 1000' },
        { status: 400 }
      );
    }
    
    if (relationshipCount < 0 || relationshipCount > 200) {
      return NextResponse.json(
        { error: 'relationshipCount must be between 0 and 200' },
        { status: 400 }
      );
    }
    
    // First, clear the existing graph
    await runQuery(`
      MATCH (n)
      DETACH DELETE n
    `);
    
    // Generate random people
    const names = [
      'Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 
      'Isabella', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter', 
      'Quinn', 'Ryan', 'Sophia', 'Thomas', 'Uma', 'Victor', 'Wendy', 'Xavier', 
      'Yasmine', 'Zach'
    ];
    
    // Create random people nodes
    for (let i = 0; i < nodeCount; i++) {
      const randomIndex = Math.floor(Math.random() * names.length);
      const name = `${names[randomIndex]}_${i}`;
      const cloutScore = Math.floor(Math.random() * 100);
      const linkedinUrl = `https://linkedin.com/in/${name.toLowerCase()}`;
      
      const person: Person = {
        name,
        clout_score: cloutScore,
        linkedin_url: linkedinUrl
      };
      
      await runQuery(`
        CREATE (p:Person {
          name: $name,
          clout_score: $clout_score,
          linkedin_url: $linkedin_url
        })
      `, person);
    }
    
    // Create random KNOWS relationships
    const relationshipTypes = ['KNOWS', 'WORKS_WITH', 'MANAGES', 'MENTORS'];
    
    for (let i = 0; i < relationshipCount; i++) {
      const randomType = relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)];
      const randomStrength = Math.floor(Math.random() * 10) + 1;
      
      await runQuery(`
        MATCH (p1:Person), (p2:Person)
        WHERE p1 <> p2 AND NOT (p1)-[:${randomType}]->(p2)
        WITH p1, p2
        ORDER BY rand()
        LIMIT 1
        CREATE (p1)-[r:${randomType} {strength: $strength}]->(p2)
        RETURN p1, r, p2
      `, { strength: randomStrength });
    }
    
    // Return the new graph data
    const graphData = await getGraphData();
    return NextResponse.json({ 
      message: `Generated ${nodeCount} nodes and ${relationshipCount} relationships`,
      graph: graphData
    });
  } catch (error) {
    console.error('Error generating graph data:', error);
    return NextResponse.json({ error: 'Failed to generate graph data' }, { status: 500 });
  }
}

/**
 * Helper function to get the current graph data
 */
async function getGraphData(): Promise<GraphData> {
  const cypher = `
    MATCH (n)
    OPTIONAL MATCH (n)-[r]->(m)
    RETURN n, r, m
  `;
  
  const result = await runQuery(cypher);
  
  // Process the results to create a graph structure
  const nodes = new Map<string, Node>();
  const relationships: Relationship[] = [];
  
  result.forEach((record: any) => {
    // Process node n
    if (record.n) {
      // Use elementId for Neo4j 5+ or create a unique ID if not available
      const nodeId = typeof record.n === 'object' && record.n.elementId 
        ? record.n.elementId.toString() 
        : `node-${Object.keys(nodes).length}`;
        
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          labels: Array.isArray(record.n.labels) ? record.n.labels : [],
          properties: record.n
        });
      }
    }
    
    // Process node m
    if (record.m) {
      // Use elementId for Neo4j 5+ or create a unique ID if not available
      const nodeId = typeof record.m === 'object' && record.m.elementId 
        ? record.m.elementId.toString() 
        : `node-${Object.keys(nodes).length}`;
        
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          labels: Array.isArray(record.m.labels) ? record.m.labels : [],
          properties: record.m
        });
      }
    }
    
    // Process relationship r
    if (record.r) {
      const relId = typeof record.r === 'object' && record.r.elementId 
        ? record.r.elementId.toString() 
        : `rel-${relationships.length}`;
        
      // Get start and end node IDs
      const startNodeId = typeof record.n === 'object' && record.n.elementId 
        ? record.n.elementId.toString() 
        : `node-${Object.keys(nodes).length-2}`;
        
      const endNodeId = typeof record.m === 'object' && record.m.elementId 
        ? record.m.elementId.toString() 
        : `node-${Object.keys(nodes).length-1}`;
        
      relationships.push({
        id: relId,
        type: typeof record.r.type === 'string' ? record.r.type : 'RELATED_TO',
        startNodeId: startNodeId,
        endNodeId: endNodeId,
        properties: record.r
      });
    }
  });
  
  return {
    nodes: Array.from(nodes.values()),
    relationships: relationships
  };
}