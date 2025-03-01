import neo4j, { Driver } from 'neo4j-driver';
import { env } from '~/env';

/**
 * Cache the Neo4j database connection in development. This avoids creating a new connection on every HMR update.
 */
const globalForNeo4j = globalThis as unknown as {
  neo4jDriver: Driver | undefined;
};

// Create a Neo4j driver instance
const createDriver = () => {
  const driver = neo4j.driver(
    env.NEO4J_URI,
    neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD)
  );
  return driver;
};

// Get or create the Neo4j driver
export const getNeo4jDriver = () => {
  // For development, we want to reuse the same connection
  if (env.NODE_ENV !== 'production') {
    if (!globalForNeo4j.neo4jDriver) {
      globalForNeo4j.neo4jDriver = createDriver();
    }
    return globalForNeo4j.neo4jDriver;
  }
  
  // For production, create a new driver
  return createDriver();
};

// Function to close the Neo4j driver
export const closeNeo4jDriver = async () => {
  if (globalForNeo4j.neo4jDriver) {
    await globalForNeo4j.neo4jDriver.close();
    globalForNeo4j.neo4jDriver = undefined;
  }
};

// Helper function to run a Cypher query
export const runQuery = async <T>(
  cypher: string,
  params?: Record<string, any>
): Promise<T[]> => {
  const driver = getNeo4jDriver();
  const session = driver.session();
  
  try {
    const result = await session.run(cypher, params);
    return result.records.map(record => {
      const resultObj: Record<string, any> = {};
      
      record.keys.forEach((key) => {
        const keyStr = String(key);
        const value = record.get(keyStr);
        
        // Handle Neo4j types like Node, Relationship, etc.
        if (value && typeof value === 'object' && value.properties) {
          resultObj[keyStr] = value.properties;
        } else {
          resultObj[keyStr] = value;
        }
      });
      
      return resultObj as T;
    });
  } finally {
    await session.close();
  }
};
