import { NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';
import { runQuery } from '~/server/db/neo4j';
import { generateText, generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const PROXYCURL_API_KEY = env.PROXYCURL_API_KEY;
const PROXYCURL_API_URL = 'https://nubela.co/proxycurl/api/v2/linkedin';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Define a schema for the analysis result
const analysisSchema = z.object({
  baseCloutRating: z.number().min(0).max(100),
  analysis: z.string(),
  networkInsights: z.string(),
  recommendations: z.array(z.string())
});

async function analyzeWithGemini(profileData: any, connectionsData?: any[]) {
  console.log('analyzeWithGemini: Starting analysis process');
  
  try {
    let connectionsPrompt = '';
    if (connectionsData && connectionsData.length > 0) {
      console.log(`analyzeWithGemini: Processing ${connectionsData.length} connections`);
      
      // Create a simplified version of connections, referencing "connection.profile" 
      // and the same field names your frontend is using (e.g. "headline" or "occupation").
      const simplifiedConnections = connectionsData.map(connection => {
        let parsedProfileData: any = {};
        try {
          if (connection.profile && typeof connection.profile === 'string') {
            parsedProfileData = JSON.parse(connection.profile);
          }
        } catch (e) {
          console.log('Error parsing connection profile data:', e);
        }

        // Construct final connection fields Gemini will see
        return {
          name: `${connection.firstName} ${connection.lastName}`.trim(),
          headline: parsedProfileData.headline || parsedProfileData.title || '',
          current_role: parsedProfileData.occupation || parsedProfileData.position || '',
          clout_score: connection.cloutScore || 0
        };
      });

      // Limit to top 5 connections to reduce tokens
      const topConnections = simplifiedConnections.slice(0, 5);
      console.log(`analyzeWithGemini: Including ${topConnections.length} connections in prompt`);
      connectionsPrompt = `\n\nKey Connections (${connectionsData.length} total, showing top 5):\n${JSON.stringify(topConnections, null, 0)}`;
    } else {
      console.log('analyzeWithGemini: No connections data available');
    }

    // Create a much more compact profile summary
    const profileSummary = {
      name: profileData.full_name || profileData.name || '',
      headline: profileData.headline || '',
      industry: profileData.industry || '',
      location: profileData.city || profileData.location || '',
      summary: profileData.summary ? profileData.summary.substring(0, 150) + (profileData.summary.length > 150 ? '...' : '') : ''
    };
    
    console.log('analyzeWithGemini: Profile summary created:', JSON.stringify(profileSummary).length, 'characters');
    console.log('analyzeWithGemini: Connection prompt length:', connectionsPrompt.length, 'characters');

    console.log('analyzeWithGemini: Generating structured output with Gemini');
    
    try {
      const { object: analysis } = await generateObject({
        model: google('gemini-2.0-flash-lite'),
        system: `You are a professional recruiter and talent evaluator. Analyze LinkedIn profiles and their networks.`,
        prompt: `Please analyze this LinkedIn profile data and its network of connections. In your analysis, provide:
1. A brief evaluation of the profile's strengths and areas for improvement.
2. A "Base Clout Rating" from 0-100 based on their experience, skills, education, and overall profile strength.
3. A dedicated section titled "Network Insights" where you analyze the quality, influence, and relevance of the profile's connections.
4. Key recommendations for improving their professional presence.

Profile Data:
${JSON.stringify(profileSummary, null, 2)}${connectionsPrompt}

Respond with a detailed analysis following the required structure.`,
        schema: analysisSchema,
        maxTokens: 1500,
      });
      
      console.log('analyzeWithGemini: Structured response received from Gemini');
      console.log('analyzeWithGemini: Analysis structure validation passed');
      console.log('analyzeWithGemini: baseCloutRating =', analysis.baseCloutRating);
      
      return {
        ...profileData,
        geminiAnalysis: analysis
      };
    } catch (err) {
      console.error('Structured generation failed:', err);
      
      // Fallback to a simpler text generation approach if structured generation fails
      console.log('analyzeWithGemini: Attempting fallback to text generation');
      
      const { text } = await generateText({
        model: google('gemini-2.0-flash-lite'),
        prompt: `You are a professional recruiter. Analyze this LinkedIn profile:
${JSON.stringify(profileSummary, null, 2)}${connectionsPrompt}

Your response MUST be valid JSON with this EXACT structure:
{
  "baseCloutRating": 50,
  "analysis": "Brief analysis of profile strengths and weaknesses",
  "networkInsights": "Brief analysis of the person's network",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

The baseCloutRating must be a number between 0 and 100. Do not include any explanations or text outside the JSON object.`,
        maxTokens: 1000,
      });
      
      console.log('analyzeWithGemini: Text generation fallback received response');
      
      try {
        // Clean up the response to ensure it's valid JSON
        let cleanText = text.trim();
        if (cleanText.startsWith("```json")) {
          cleanText = cleanText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```\n/, '').replace(/\n```$/, '');
        }
        
        console.log('analyzeWithGemini: Attempting to parse JSON response');
        const parsedAnalysis = JSON.parse(cleanText);
        console.log('analyzeWithGemini: Successfully parsed JSON response');
        
        // Validate and provide defaults for missing fields
        const validatedAnalysis = {
          baseCloutRating: typeof parsedAnalysis.baseCloutRating === 'number' ? parsedAnalysis.baseCloutRating : 50,
          analysis: parsedAnalysis.analysis || "No detailed analysis available",
          networkInsights: parsedAnalysis.networkInsights || "No network insights available",
          recommendations: Array.isArray(parsedAnalysis.recommendations) ? 
            parsedAnalysis.recommendations : ["Improve your profile with more details"]
        };
        
        console.log('analyzeWithGemini: Validated fallback analysis:', validatedAnalysis.baseCloutRating);
        
        return {
          ...profileData,
          geminiAnalysis: validatedAnalysis
        };
      } catch (parseError) {
        console.error('analyzeWithGemini: Error parsing fallback response:', parseError);
        console.log('analyzeWithGemini: Raw fallback response:', text);
        
        // Last resort fallback
        const defaultAnalysis = {
          baseCloutRating: 50,
          analysis: "Unable to analyze profile due to technical issues.",
          networkInsights: "Network analysis unavailable.",
          recommendations: ["Try again later when our analysis service is available."]
        };
        
        console.log('analyzeWithGemini: Using default analysis values');
        
        return {
          ...profileData,
          geminiAnalysis: defaultAnalysis
        };
      }
    }
  } catch (error) {
    console.error('analyzeWithGemini: Unexpected error:', error);
    
    // Final fallback for any unexpected errors
    const emergencyAnalysis = {
      baseCloutRating: 50,
      analysis: "An unexpected error occurred during analysis.",
      networkInsights: "Network analysis unavailable due to an error.",
      recommendations: ["Please refresh and try again."]
    };
    
    console.log('analyzeWithGemini: Using emergency fallback analysis');
    
    return {
      ...profileData,
      geminiAnalysis: emergencyAnalysis
    };
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
    // Extract the LinkedIn username from the URL
    const linkedinUsername = normalizedUrl.split('/').pop() || '';
    
    // Log database schema information
    console.log('========== DATABASE SCHEMA INFORMATION ==========');
    
    // Fetch the LinkedIn profile data
    console.log(`Fetching profile data for ${normalizedUrl}`);
    const profileData = await fetchProfile(normalizedUrl);
    
    // Explicitly return id, name, profile_data, and clout_score for each connection
    const connectionsQuery = `
      MATCH (p:Person {id: $linkedinUsername})-[:CONNECTED_TO]->(c:Person)
      RETURN c.id AS id,
             c.name AS name,
             c.profile_data AS profile_data,
             c.clout_score AS clout_score
    `;
    const rawConnections = await runQuery(connectionsQuery, { linkedinUsername });

    // Transform the raw Neo4j results into a friendlier array for your frontend/Gemini
    const connectionsData = rawConnections.map((row: any) => {
      // Split the name into firstName and lastName, as best as possible
      const [firstName, ...rest] = (row.name || '').split(' ');
      const lastName = rest.join(' ');

      return {
        firstName: firstName || '',
        lastName: lastName || '',
        id: row.id,
        profile: row.profile_data,
        cloutScore: row.clout_score,
      };
    });

    console.log(`Found ${connectionsData.length} connections`);

    // Analyze with Gemini
    console.log('Analyzing with Gemini...');
    const analysisResult = await analyzeWithGemini(profileData, connectionsData);
    
    // Return both the analysis result and the enriched connections
    return NextResponse.json({
      ...analysisResult,
      connections: connectionsData
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: `Error processing request: ${error}` },
      { status: 500 }
    );
  }
}