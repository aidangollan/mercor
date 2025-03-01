import { NextRequest, NextResponse } from 'next/server';

const PROXYCURL_API_KEY = 'SZG4B2ZmQGa0XtbHleH_Rw';
const PROXYCURL_API_URL = 'https://nubela.co/proxycurl/api/v2/linkedin';

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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching LinkedIn data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn data' },
      { status: 500 }
    );
  }
} 