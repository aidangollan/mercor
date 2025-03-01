import { NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';
import { runQuery } from '~/server/db/neo4j';

const PROXYCURL_API_KEY = env.PROXYCURL_API_KEY;
const PROXYCURL_API_URL = 'https://nubela.co/proxycurl/api/v2/linkedin';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function analyzeWithAnthropic(profileData: any, connectionsData?: any[]) {
  try {
    let connectionsPrompt = '';
    if (connectionsData && connectionsData.length > 0) {
      connectionsPrompt = `\n\nLinkedIn Connections Data:\n${JSON.stringify(connectionsData, null, 2)}`;
    }

    const prompt = `You are a professional recruiter and talent evaluator. Please analyze this LinkedIn profile data and its network of connections. In your analysis, provide:
1. A brief evaluation of the profile's strengths and areas for improvement.
2. A "Base Clout Rating" from 0-100 based on their experience, skills, education, and overall profile strength.
3. A dedicated section titled "Network Insights" where you analyze the quality, influence, and relevance of the profile's connections.
4. Key recommendations for improving their professional presence.

Profile Data:
${JSON.stringify(profileData, null, 2)}${connectionsPrompt}

Please format your response as JSON with the following structure:
{
  "baseCloutRating": number,
  "analysis": string,
  "networkInsights": string,
  "recommendations": string[]
}`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to analyze profile with Anthropic');
    }

    const anthropicResponse = await response.json();
    let responseText = anthropicResponse.content[0].text.trim();

    // Remove markdown code fencing if present (e.g., "```json" at the start and "```" at the end)
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    }

    const analysis = JSON.parse(responseText);
    
    return {
      ...profileData,
      anthropicAnalysis: analysis
    };
  } catch (error) {
    console.error('Error analyzing with Anthropic:', error);
    throw error;
  }
}

async function fetchProfile(linkedinUrl: string) {
  const params = new URLSearchParams({
    url: linkedinUrl,
    extra: 'include',
    use_cache: 'if-present',
    fallback_to_cache: 'on-error',
  });
  const response = await fetch(`${PROXYCURL_API_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${PROXYCURL_API_KEY}`,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error fetching profile for ${linkedinUrl}: ${response.status} ${response.statusText}. Response: ${errorText}`);
    throw new Error(`Failed to fetch LinkedIn data: ${response.statusText}`);
  }
  return response.json();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const linkedinUrlParam = searchParams.get('url');

  if (!linkedinUrlParam) {
    return NextResponse.json(
      { error: 'LinkedIn URL is required' },
      { status: 400 }
    );
  }

  // Normalize the LinkedIn URL by removing trailing slashes
  const normalizedUrl = linkedinUrlParam.replace(/\/+$/, '');

  try {
    const linkedinData = await fetchProfile(normalizedUrl);

    // Retrieve connections from Neo4j associated with this profile
    const connectionsResult = await runQuery<{ c: { properties: any } }>(
      `
      MATCH (p:Person {linkedin_url: $linkedinUrl})-[:CONNECTED_TO]->(c:Connection)
      RETURN c
      `,
      { linkedinUrl: normalizedUrl }
    );
    const connectionsData = connectionsResult.map(record => record.c.properties);

    const enrichedData = await analyzeWithAnthropic(linkedinData, connectionsData);
    
    // Include connections data in the response
    return NextResponse.json({ ...enrichedData, connections: connectionsData });
  } catch (error) {
    console.error('Error processing profile:', error);
    return NextResponse.json(
      { error: 'Failed to analyze profile' },
      { status: 500 }
    );
  }
}  