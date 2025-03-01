// webapp/src/app/api/connections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';
import { runQuery } from '~/server/db/neo4j';
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const PROXYCURL_API_KEY = env.PROXYCURL_API_KEY;
const PROXYCURL_API_URL = 'https://nubela.co/proxycurl/api/v2/linkedin';
const OPENAI_API_KEY = env.OPENAI_KEY;

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

// Helper function to truncate profile data to avoid token limit issues
function truncateProfileData(profileData: any): any {
  if (!profileData) return profileData;
  
  // Create a copy to avoid modifying the original
  const truncated = { ...profileData };
  
  // Truncate or remove large fields that aren't essential for analysis
  if (truncated.experiences && truncated.experiences.length > 3) {
    truncated.experiences = truncated.experiences.slice(0, 3);
  }
  
  if (truncated.education && truncated.education.length > 3) {
    truncated.education = truncated.education.slice(0, 3);
  }
  
  // Remove potentially large fields that aren't critical
  delete truncated.recommendations;
  delete truncated.activities;
  delete truncated.certifications;
  delete truncated.volunteer_work;
  delete truncated.similarly_named_profiles;
  delete truncated.people_also_viewed;
  delete truncated.articles;
  
  // Truncate long text fields
  if (truncated.summary && truncated.summary.length > 500) {
    truncated.summary = truncated.summary.substring(0, 500) + "...";
  }
  
  return truncated;
}

// Helper function to truncate connections data
function truncateConnectionsData(connectionsData: any[]): any[] {
  if (!connectionsData || connectionsData.length === 0) return connectionsData;
  
  // If there are too many connections, sample a subset
  if (connectionsData.length > 20) {
    // Take a sample of 20 connections
    const sampledConnections = [];
    const step = Math.floor(connectionsData.length / 20);
    
    for (let i = 0; i < connectionsData.length && sampledConnections.length < 20; i += step) {
      sampledConnections.push(truncateProfileData(connectionsData[i]));
    }
    
    return sampledConnections;
  }
  
  // Otherwise truncate each connection
  return connectionsData.map(connection => truncateProfileData(connection));
}

async function analyzeWithChatGPT(profileData: any, connectionsData?: any[]) {
  try {
    // Truncate data to avoid token limit issues
    const truncatedProfile = truncateProfileData(profileData);
    const truncatedConnections = connectionsData ? truncateConnectionsData(connectionsData) : undefined;
    
    // Initialize the ChatOpenAI model
    const model = new ChatOpenAI({
      openAIApiKey: OPENAI_API_KEY,
      modelName: "gpt-4-turbo-preview",
      temperature: 0.2,
      maxTokens: 1000, // Limit response size
    });

    // Create a prompt template for the analysis
    const promptTemplate = PromptTemplate.fromTemplate(`
      You are a professional recruiter and talent evaluator. Please analyze this LinkedIn profile data and its network of connections. In your analysis, provide:
      1. A brief evaluation of the profile's strengths and areas for improvement.
      2. A "Base Clout Rating" from 0-100 based on their experience, skills, education, and overall profile strength.
      3. A dedicated section titled "Network Insights" where you analyze the quality, influence, and relevance of the profile's connections.
      4. Key recommendations for improving their professional presence.

      Profile Data:
      {profileData}

      {connectionsSection}

      Please format your response as JSON with the following structure:
      {{
        "baseCloutRating": number,
        "analysis": string,
        "networkInsights": string,
        "recommendations": string[]
      }}
    `);

    // Prepare the connections section if available
    const connectionsSection = truncatedConnections && truncatedConnections.length > 0 
      ? `LinkedIn Connections Data (Sample):\n${JSON.stringify(truncatedConnections, null, 2)}`
      : "";

    // Create the chain
    const chain = promptTemplate
      .pipe(model)
      .pipe(new StringOutputParser());

    // Execute the chain
    const result = await chain.invoke({
      profileData: JSON.stringify(truncatedProfile, null, 2),
      connectionsSection
    });

    // Parse the result as JSON
    let parsedResult;
    try {
      // Extract JSON if wrapped in code blocks
      let jsonString = result.trim();
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.replace(/^```json\n/, "").replace(/\n```$/, "");
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.replace(/^```\n/, "").replace(/\n```$/, "");
      }
      parsedResult = JSON.parse(jsonString);
    } catch (error) {
      console.error("Error parsing ChatGPT response:", error);
      console.log("Raw response:", result);
      
      // Attempt to extract JSON using regex as a fallback
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          console.error("Failed to parse extracted JSON:", innerError);
          throw new Error("Failed to parse ChatGPT response as JSON");
        }
      } else {
        throw new Error("Failed to extract JSON from ChatGPT response");
      }
    }

    return {
      ...profileData,
      gptAnalysis: parsedResult
    };
  } catch (error) {
    console.error('Error analyzing with ChatGPT:', error);
    // Return a default analysis instead of throwing
    return {
      ...profileData,
      gptAnalysis: {
        baseCloutRating: 50,
        analysis: "Unable to generate detailed analysis due to data size limitations.",
        networkInsights: "Network analysis unavailable.",
        recommendations: ["Consider updating your profile for better analysis."]
      }
    };
  }
}

// Function to add a node with clout score to the graph
async function addNodeWithCloutToGraph(nodeType: string, data: any, cloutScore: number) {
  try {
    // Extract LinkedIn username from profile URL if available
    let linkedinUsername = null;
    if (data.profile_url) {
      // Extract username from linkedin.com/in/USERNAME format
      const match = data.profile_url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
      if (match && match[1]) {
        linkedinUsername = match[1].toLowerCase();
      }
    }
    
    // Use LinkedIn username as primary identifier if available, otherwise fall back to other IDs
    let nodeId = linkedinUsername || data.public_identifier || data.linkedin_id || data.id;
    if (!nodeId) {
      console.warn('No identifier found for node, generating random ID');
      nodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    const name = data.first_name && data.last_name 
      ? `${data.first_name} ${data.last_name}`
      : data.firstName && data.lastName 
        ? `${data.firstName} ${data.lastName}` 
        : data.name || nodeId;

    // Create or update the node in Neo4j with the clout score
    await runQuery(
      `
      MERGE (n:${nodeType} {id: $nodeId})
      ON CREATE SET 
        n.name = $name,
        n.clout_score = $cloutScore,
        n.profile_data = $profileData,
        n.created_at = datetime(),
        n.linkedin_username = $linkedinUsername
      ON MATCH SET 
        n.name = $name,
        n.clout_score = $cloutScore,
        n.profile_data = $profileData,
        n.updated_at = datetime(),
        n.linkedin_username = $linkedinUsername
      RETURN n
      `,
      { 
        nodeId, 
        name, 
        cloutScore, 
        profileData: JSON.stringify(data),
        linkedinUsername
      }
    );

    return nodeId;
  } catch (error) {
    console.error(`Error adding ${nodeType} node to graph:`, error);
    throw error;
  }
}

// Function to run a simple PageRank-like algorithm on the graph
async function runSimplePageRankAlgorithm() {
  try {
    console.log('Running simple PageRank-like algorithm on the graph...');
    
    // First check if the graph has any nodes
    const countResult = await runQuery(`
      MATCH (n:Person)
      RETURN count(n) AS nodeCount
    `);
    
    const nodeCount = countResult[0] && typeof countResult[0] === 'object' && 'nodeCount' in countResult[0] 
      ? (countResult[0].nodeCount !== null && typeof countResult[0].nodeCount === 'object' && 'low' in countResult[0].nodeCount 
          ? countResult[0].nodeCount.low 
          : countResult[0].nodeCount) || 0
      : 0;
    
    if (nodeCount === 0) {
      console.log('No nodes found in the graph, skipping PageRank calculation.');
      return;
    }
    
    // Fetch all nodes and their connections
    const nodesResult = await runQuery(`
      MATCH (n:Person)
      RETURN n.id AS id, n.name AS name, n.clout_score AS cloutScore
    `);
    
    const connectionsResult = await runQuery(`
      MATCH (n:Person)-[r:CONNECTED_TO]->(m:Person)
      RETURN n.id AS sourceId, m.id AS targetId
    `);
    
    // Build the graph structure
    const nodes = new Map();
    nodesResult.forEach((record: any) => {
      if (record.id) {
        nodes.set(record.id, {
          id: record.id,
          name: record.name || record.id,
          cloutScore: record.cloutScore || 50,
          outLinks: [],
          inLinks: [],
          pageRank: 1.0 / nodeCount, // Initial PageRank value
          newPageRank: 0.0
        });
      }
    });
    
    // Add connections to the graph
    connectionsResult.forEach((record: any) => {
      if (record.sourceId && record.targetId) {
        const sourceNode = nodes.get(record.sourceId);
        const targetNode = nodes.get(record.targetId);
        
        if (sourceNode && targetNode) {
          sourceNode.outLinks.push(record.targetId);
          targetNode.inLinks.push(record.sourceId);
        }
      }
    });
    
    // PageRank parameters
    const dampingFactor = 0.85;
    const maxIterations = 20;
    const tolerance = 0.0001;
    
    // Run PageRank iterations
    let iteration = 0;
    let converged = false;
    
    while (iteration < maxIterations && !converged) {
      let totalDiff = 0.0;
      
      // Reset new PageRank values
      nodes.forEach(node => {
        node.newPageRank = 0.0;
      });
      
      // Calculate new PageRank values
      nodes.forEach(node => {
        // Add the damping factor component
        node.newPageRank = (1.0 - dampingFactor) / nodeCount;
        
        // Add the contribution from incoming links
        node.inLinks.forEach(inLinkId => {
          const inNode = nodes.get(inLinkId);
          if (inNode && inNode.outLinks.length > 0) {
            node.newPageRank += dampingFactor * inNode.pageRank / inNode.outLinks.length;
          }
        });
      });
      
      // Update PageRank values and check for convergence
      nodes.forEach(node => {
        const diff = Math.abs(node.pageRank - node.newPageRank);
        totalDiff += diff;
        node.pageRank = node.newPageRank;
      });
      
      converged = totalDiff < tolerance;
      iteration++;
      
      console.log(`PageRank iteration ${iteration}: total difference = ${totalDiff}`);
    }
    
    console.log(`PageRank algorithm completed in ${iteration} iterations, converged: ${converged}`);
    
    // Normalize PageRank values to a 0-100 scale for clout scores
    let minPageRank = Number.MAX_VALUE;
    let maxPageRank = Number.MIN_VALUE;
    
    nodes.forEach(node => {
      minPageRank = Math.min(minPageRank, node.pageRank);
      maxPageRank = Math.max(maxPageRank, node.pageRank);
    });
    
    const range = maxPageRank - minPageRank;
    
    // Update clout scores in the database
    for (const node of nodes.values()) {
      // Normalize to 0-100 scale
      const normalizedScore = range > 0 
        ? Math.round(((node.pageRank - minPageRank) / range) * 100)
        : 50; // Default if all scores are the same
      
      // Update the node in the database
      await runQuery(`
        MATCH (n:Person {id: $nodeId})
        SET n.pagerank_score = $pageRankScore,
            n.clout_score = $normalizedScore
        RETURN n
      `, {
        nodeId: node.id,
        pageRankScore: node.pageRank,
        normalizedScore: normalizedScore
      });
    }
    
    console.log('Node clout scores updated based on PageRank results');
    
    return {
      iterations: iteration,
      converged: converged,
      nodeCount: nodes.size
    };
  } catch (error) {
    console.error('Error running simple PageRank algorithm:', error);
    return null;
  }
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
    
    // Fetch the uploader's profile data
    let uploaderProfileData;
    try {
      uploaderProfileData = await fetchProfile(uploaderLinkedinUrl);
      console.log("Fetched uploader profile:", uploaderProfileData);
    } catch (error) {
      console.error(`Error fetching uploader profile for ${uploaderUsername}:`, error);
      uploaderProfileData = { 
        name: uploaderUsername,
        public_identifier: uploaderUsername
      };
    }
    
    // Filter out only the valid connections (ones where the profile contains an ID)
    const validConnections = connectionProfiles
      .filter(cp => cp.profile && (cp.profile.id || cp.profile.public_identifier))
      .map(cp => cp.profile);
    
    console.log("Valid connections after filtering:", validConnections.length);
    
    // Run clout analysis on the uploader using ChatGPT
    let uploaderAnalysis;
    let uploaderCloutScore = 50; // Default score
    try {
      
      uploaderAnalysis = await analyzeWithChatGPT(uploaderProfileData, validConnections);
      uploaderCloutScore = uploaderAnalysis.gptAnalysis?.baseCloutRating || 50;
    } catch (error) {
      console.error('Error analyzing uploader with ChatGPT:', error);
      uploaderAnalysis = {
        ...uploaderProfileData,
        gptAnalysis: {
          baseCloutRating: 50,
          analysis: "Unable to generate detailed analysis due to an error.",
          networkInsights: "Network analysis unavailable.",
          recommendations: ["Consider updating your profile for better analysis."]
        }
      };
    }
    
    // Add the uploader to the graph with their clout score
    let uploaderId;
    try {
      uploaderId = await addNodeWithCloutToGraph('Person', uploaderProfileData, uploaderCloutScore);
      console.log(`Added uploader to graph with ID: ${uploaderId} and clout score: ${uploaderCloutScore}`);
    } catch (error) {
      console.error('Error adding uploader to graph:', error);
      return NextResponse.json(
        { error: 'Failed to add uploader to graph' },
        { status: 500, headers: corsHeaders }
      );
    }
    
    // Process each connection: analyze with ChatGPT and add to graph
    const processedConnections = [];
    const failedConnections = [];
    
    // Process connections in batches to avoid overwhelming the system
    // Increased batch size for faster processing
    const batchSize = 200;
    
    // Create a map of analyzed connections for quick lookup
    const analyzedConnectionsMap = new Map();
    
    // First, analyze the sample of connections in parallel
    if (validConnections.length > 0) {
      console.log(`Analyzing a sample of ${validConnections.length} connections...`);
      const analysisResults = await Promise.allSettled(
        validConnections.map(async (connectionProfile) => {
          try {
            const connectionAnalysis = await analyzeWithChatGPT(connectionProfile);
            const connectionCloutScore = connectionAnalysis.gptAnalysis?.baseCloutRating || 50;
            
            // Extract LinkedIn username from profile URL if available
            let linkedinUsername = null;
            if (connectionProfile.profile_url) {
              const match = connectionProfile.profile_url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
              if (match && match[1]) {
                linkedinUsername = match[1].toLowerCase();
              }
            }
            
            // Store the result in the map using LinkedIn username as primary identifier
            const connectionId = linkedinUsername || 
                                connectionProfile.public_identifier || 
                                connectionProfile.linkedin_id || 
                                connectionProfile.id;
            
            analyzedConnectionsMap.set(connectionId, {
              analysis: connectionAnalysis.gptAnalysis,
              cloutScore: connectionCloutScore
            });
            
            return { connectionId, connectionProfile, connectionAnalysis, connectionCloutScore };
          } catch (error) {
            console.error(`Error analyzing connection:`, error);
            return { error };
          }
        })
      );
      
      console.log(`Completed analysis of sample connections.`);
    }
    
    // Calculate average clout score from analyzed connections
    let averageCloutScore = 50; // Default
    if (analyzedConnectionsMap.size > 0) {
      const totalCloutScore = Array.from(analyzedConnectionsMap.values())
        .reduce((sum, data) => sum + data.cloutScore, 0);
      averageCloutScore = Math.round(totalCloutScore / analyzedConnectionsMap.size);
      console.log(`Average clout score from analyzed connections: ${averageCloutScore}`);
    }
    
    // Now process all connections in batches
    for (let i = 0; i < validConnections.length; i += batchSize) {
      const batch = validConnections.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(validConnections.length/batchSize)}, size: ${batch.length}`);
      
      // Process each connection in the batch
      const batchResults = await Promise.allSettled(
        batch.map(async (connectionProfile) => {
          try {
            // Extract LinkedIn username from profile URL if available
            let linkedinUsername = null;
            if (connectionProfile.profile_url) {
              const match = connectionProfile.profile_url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
              if (match && match[1]) {
                linkedinUsername = match[1].toLowerCase();
              }
            }
            
            // Use LinkedIn username as primary identifier
            const connectionId = linkedinUsername || 
                                connectionProfile.public_identifier || 
                                connectionProfile.linkedin_id || 
                                connectionProfile.id;
            
            // Check if we already analyzed this connection
            let connectionCloutScore = averageCloutScore;
            let connectionAnalysis = null;
            
            if (analyzedConnectionsMap.has(connectionId)) {
              const analysisData = analyzedConnectionsMap.get(connectionId);
              connectionCloutScore = analysisData.cloutScore;
              connectionAnalysis = analysisData.analysis;
            }
            
            // Add the connection to the graph with their clout score
            const graphConnectionId = await addNodeWithCloutToGraph('Person', connectionProfile, connectionCloutScore);
            
            // Create relationship between uploader and connection
            await runQuery(
              `
              MATCH (p1:Person {id: $uploaderId})
              MATCH (p2:Person {id: $connectionId})
              MERGE (p1)-[r:CONNECTED_TO]->(p2)
              ON CREATE SET r.created_at = datetime(),
                           r.source = 'linkedin'
              ON MATCH SET r.updated_at = datetime()
              `,
              { uploaderId, connectionId: graphConnectionId }
            );
            
            console.log(`Added connection to graph with ID: ${graphConnectionId} and clout score: ${connectionCloutScore}`);
            
            return {
              id: graphConnectionId,
              profile: connectionProfile,
              cloutScore: connectionCloutScore,
              analysis: connectionAnalysis
            };
          } catch (error) {
            console.error(`Error processing connection:`, error);
            return {
              profile: connectionProfile,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          processedConnections.push(result.value);
        } else {
          failedConnections.push({
            profile: batch[index],
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
      
      console.log(`Completed batch. Total processed so far: ${processedConnections.length}`);
    }
    
    // Run PageRank algorithm after all connections have been processed
    let pageRankResults = null;

    return NextResponse.json(
      { 
        uploader: {
          id: uploaderId,
          profile: uploaderProfileData,
          cloutScore: uploaderCloutScore,
          analysis: uploaderAnalysis.gptAnalysis
        },
        connections: processedConnections,
        failedConnections: failedConnections,
        totalProcessed: processedConnections.length,
        totalFailed: failedConnections.length,
        pageRankCompleted: pageRankResults !== null,
        pageRankStats: pageRankResults
      },
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