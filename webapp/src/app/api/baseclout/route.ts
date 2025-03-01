import { NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';

const PROXYCURL_API_KEY = env.PROXYCURL_API_KEY;
const PROXYCURL_API_URL = 'https://nubela.co/proxycurl/api/v2/linkedin';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function analyzeWithAnthropic(profileData: any) {
  try {
    const prompt = `You are a professional recruiter and talent evaluator. Please analyze this LinkedIn profile data and provide:
1. A brief evaluation of the profile's strengths and areas for improvement
2. A "Base Clout Rating" from 0-100 based on their experience, skills, education, and overall profile strength
3. Key recommendations for improving their professional presence

Here's the profile data:
${JSON.stringify(profileData, null, 2)}

Please format your response as JSON with the following structure:
{
  "baseCloutRating": number,
  "analysis": string,
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
    const analysis = JSON.parse(anthropicResponse.content[0].text);
    
    return {
      ...profileData,
      anthropicAnalysis: analysis
    };
  } catch (error) {
    console.error('Error analyzing with Anthropic:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const linkedinUrl = searchParams.get('url');

  if (!linkedinUrl) {
    return NextResponse.json(
      { error: 'LinkedIn URL is required' },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      url: linkedinUrl,
      extra: 'include',
      github_profile_id: 'include',
      facebook_profile_id: 'include',
      twitter_profile_id: 'include',
      personal_contact_number: 'include',
      personal_email: 'include',
      inferred_salary: 'include',
      skills: 'include',
      use_cache: 'if-present',
      fallback_to_cache: 'on-error',
    });

    const response = await fetch(`${PROXYCURL_API_URL}?${params}`, {
      headers: {
        'Authorization': `Bearer ${PROXYCURL_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch LinkedIn data');
    }

    const linkedinData = await response.json();
    const enrichedData = await analyzeWithAnthropic(linkedinData);
    
    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Error processing profile:', error);
    return NextResponse.json(
      { error: 'Failed to analyze profile' },
      { status: 500 }
    );
  }
} 