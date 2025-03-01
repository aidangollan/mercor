import { runQuery } from '../neo4j';

export interface Person {
  id?: string;
  name: string;
  clout_score: number;
  linkedin_url: string;
}

export class PersonModel {
  /**
   * Create a new person in the Neo4j database
   */
  static async create(person: Person): Promise<Person> {
    const cypher = `
      CREATE (p:Person {
        name: $name,
        clout_score: $clout_score,
        linkedin_url: $linkedin_url
      })
      RETURN p
    `;
    
    const result = await runQuery<{ p: Person }>(cypher, {
      name: person.name,
      clout_score: person.clout_score,
      linkedin_url: person.linkedin_url
    });
    
    return result[0]?.p || person;
  }
  
  /**
   * Get all people from the Neo4j database
   */
  static async getAll(): Promise<Person[]> {
    const cypher = `
      MATCH (p:Person)
      RETURN p
    `;
    
    const result = await runQuery<{ p: Person }>(cypher);
    return result.map(r => r.p);
  }
  
  /**
   * Get a person by name
   */
  static async getByName(name: string): Promise<Person | null> {
    const cypher = `
      MATCH (p:Person {name: $name})
      RETURN p
    `;
    
    const result = await runQuery<{ p: Person }>(cypher, { name });
    return result[0]?.p || null;
  }
  
  /**
   * Update a person's details
   */
  static async update(name: string, updates: Partial<Person>): Promise<Person | null> {
    let setClauses = [];
    const params: Record<string, any> = { name };
    
    if (updates.clout_score !== undefined) {
      setClauses.push('p.clout_score = $clout_score');
      params.clout_score = updates.clout_score;
    }
    
    if (updates.linkedin_url !== undefined) {
      setClauses.push('p.linkedin_url = $linkedin_url');
      params.linkedin_url = updates.linkedin_url;
    }
    
    if (updates.name !== undefined) {
      setClauses.push('p.name = $new_name');
      params.new_name = updates.name;
    }
    
    if (setClauses.length === 0) {
      return null;
    }
    
    const cypher = `
      MATCH (p:Person {name: $name})
      SET ${setClauses.join(', ')}
      RETURN p
    `;
    
    const result = await runQuery<{ p: Person }>(cypher, params);
    return result[0]?.p || null;
  }
  
  /**
   * Delete a person by name
   */
  static async delete(name: string): Promise<boolean> {
    const cypher = `
      MATCH (p:Person {name: $name})
      DELETE p
      RETURN count(p) as deleted
    `;
    
    const result = await runQuery<{ deleted: number }>(cypher, { name });
    return result[0]?.deleted > 0;
  }
}
