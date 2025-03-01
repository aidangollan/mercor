// webapp/src/app/api/connections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';
import { runQuery } from '~/server/db/neo4j';

const PROXYCURL_API_KEY = env.PROXYCURL_API_KEY;
const PROXYCURL_API_URL = 'https://nubela.co/proxycurl/api/v2/linkedin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

async function fetchProfile(linkedinUrl: string) {
  const params = new URLSearchParams({
    url: linkedinUrl,
    extra: 'include',
    // add any other parameters as needed
    use_cache: 'if-present',
    fallback_to_cache: 'on-error',
  });
  const response = await fetch(`${PROXYCURL_API_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${PROXYCURL_API_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch profile data for ${linkedinUrl}`);
  }
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Received connections upload request body:", body);
    const { usernames, uploader } = body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json(
        { error: 'No usernames provided' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Fetch profiles for each connection username
    const connectionProfiles = await Promise.all(
      usernames.map(async (username: string) => {
        const linkedinUrl = `https://www.linkedin.com/in/${username}`;
        try {
          const profile = await fetchProfile(linkedinUrl);
          return { username, profile };
        } catch (error) {
          console.error(`Error fetching profile for ${username}:`, error);
          return {
            username,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })
    );
    
    console.log("Fetched connection profiles:", connectionProfiles);
    
    // Use a hardcoded uploader username (or one provided via payload) to associate these connections
    const uploaderUsername = uploader || 'john-doe';
    const uploaderLinkedinUrl = `https://www.linkedin.com/in/${uploaderUsername}`;
    
    // Ensure the uploader Person exists in Neo4j (if not, create it)
    await runQuery(
      `
      MERGE (p:Person {linkedin_url: $uploaderLinkedinUrl})
      ON CREATE SET p.name = $uploaderUsername, p.clout_score = 0
      `,
      { uploaderLinkedinUrl, uploaderUsername }
    );
    
    // Filter out only the valid connections (ones where the profile contains an ID)
    // and include full profile data by serializing it into a JSON string.
    const validConnections = connectionProfiles
      .filter(cp => cp.profile && (cp.profile.id || cp.profile.public_identifier))
      .map(cp => ({
        linkedin_id: cp.profile.id || cp.profile.public_identifier,
        firstName: cp.profile.first_name || cp.username,
        lastName: cp.profile.last_name || '',
        profile: JSON.stringify(cp.profile)
      }));
    
    console.log("Valid connections after filtering:", validConnections);
    
    if (validConnections.length > 0) {
      await runQuery(
        `
        MATCH (p:Person {linkedin_url: $uploaderLinkedinUrl})
        WITH p, $connections AS conns
        UNWIND conns AS conn
        MERGE (c:Connection {linkedin_id: conn.linkedin_id})
        ON CREATE SET c.firstName = conn.firstName, c.lastName = conn.lastName, c.profile = conn.profile
        ON MATCH SET c.profile = conn.profile
        MERGE (p)-[:CONNECTED_TO]->(c)
        `,
        { uploaderLinkedinUrl, connections: validConnections }
      );
      console.log(`Saved ${validConnections.length} connections to Neo4j for uploader ${uploaderLinkedinUrl}`);
    } else {
      console.warn("No valid connections found to save.");
    }
    
    return NextResponse.json(
      { profiles: connectionProfiles },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error processing connections:', error);
    return NextResponse.json(
      { error: 'Failed to process connections' },
      { status: 500, headers: corsHeaders }
    );
  }
}