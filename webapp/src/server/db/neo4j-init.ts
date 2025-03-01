import { getNeo4jDriver } from './neo4j';

/**
 * Initialize Neo4j database with constraints and indexes
 */
export async function initializeNeo4jDatabase() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  
  try {
    // Create constraint on Person name (must be unique)
    await session.run(`
      CREATE CONSTRAINT person_name_unique IF NOT EXISTS
      FOR (p:Person)
      REQUIRE p.name IS UNIQUE
    `);
    
    // Create index on clout_score for faster queries
    await session.run(`
      CREATE INDEX person_clout_score IF NOT EXISTS
      FOR (p:Person)
      ON (p.clout_score)
    `);
    
    console.log('Neo4j database initialized with constraints and indexes');
  } catch (error) {
    console.error('Error initializing Neo4j database:', error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Function to be called during application startup
 */
export async function setupNeo4jDatabase() {
  try {
    await initializeNeo4jDatabase();
    console.log('Neo4j database setup completed successfully');
  } catch (error) {
    console.error('Failed to set up Neo4j database:', error);
  }
}
