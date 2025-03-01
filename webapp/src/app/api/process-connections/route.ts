// webapp/src/app/api/process-connections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDriver } from '~/lib/neo4j';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connections, source = 'linkedin' } = body;

    if (!connections || !Array.isArray(connections) || connections.length === 0) {
      return NextResponse.json(
        { error: 'No connections provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Processing ${connections.length} connections from ${source}`);

    // Connect to Neo4j
    const driver = getDriver();
    const session = driver.session();

    try {
      // Process connections in batches to avoid overwhelming the database
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < connections.length; i += batchSize) {
        batches.push(connections.slice(i, i + batchSize));
      }
      
      let processedCount = 0;
      
      for (const batch of batches) {
        // Create nodes for each connection if they don't exist
        await session.executeWrite(async (tx) => {
          for (const username of batch) {
            // Skip empty usernames
            if (!username) continue;
            
            // Create or merge the node for this connection
            await tx.run(
              `
              MERGE (person:Person {username: $username})
              ON CREATE SET person.source = $source, 
                           person.createdAt = datetime(),
                           person.clout_score = 0
              RETURN person
              `,
              { username, source }
            );
            
            processedCount++;
          }
        });
      }
      
      // Create relationships between the connections
      if (connections.length > 1) {
        await session.executeWrite(async (tx) => {
          // Create relationships in batches
          for (let i = 0; i < connections.length; i++) {
            const username1 = connections[i];
            if (!username1) continue;
            
            // Create relationships with a subset of other connections to avoid creating too many relationships
            const maxRelationships = Math.min(20, connections.length - 1); // Cap at 20 relationships per user
            const relationshipIndices = new Set<number>();
            
            // Select random connections to create relationships with
            while (relationshipIndices.size < maxRelationships) {
              const randomIndex = Math.floor(Math.random() * connections.length);
              if (randomIndex !== i) { // Don't create relationship with self
                relationshipIndices.add(randomIndex);
              }
            }
            
            // Create the relationships
            for (const index of relationshipIndices) {
              const username2 = connections[index];
              if (!username2) continue;
              
              await tx.run(
                `
                MATCH (person1:Person {username: $username1})
                MATCH (person2:Person {username: $username2})
                MERGE (person1)-[r:CONNECTED_TO]-(person2)
                ON CREATE SET r.createdAt = datetime()
                RETURN r
                `,
                { username1, username2 }
              );
            }
          }
        });
      }
      
      // Close the session
      await session.close();
      
      return NextResponse.json(
        { 
          success: true, 
          processed: processedCount,
          message: `Successfully processed ${processedCount} connections` 
        },
        { headers: corsHeaders }
      );
    } catch (dbError) {
      console.error('Database error processing connections:', dbError);
      await session.close();
      
      return NextResponse.json(
        { error: 'Database error processing connections' },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error('Error processing connections:', error);
    
    return NextResponse.json(
      { error: 'Failed to process connections request' },
      { status: 500, headers: corsHeaders }
    );
  }
}
