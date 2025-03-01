'use client';

import { useState } from 'react';

interface AnthropicAnalysis {
  baseCloutRating: number;
  analysis: string;
  networkInsights: string;
  recommendations: string[];
}

interface ProfileData {
  anthropicAnalysis: AnthropicAnalysis;
  connections?: Array<{
    firstName: string;
    lastName: string;
    profile: string | any;
  }>;
  [key: string]: any;
}

function formatProfile(profile: string | any) {
  if (typeof profile === 'string') {
    try {
      const parsed = JSON.parse(profile);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return profile; // fallback: if parsing fails, return the raw string
    }
  }
  return JSON.stringify(profile, null, 2);
}

export default function BaseCloutPage() {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const analyzeProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProfileData(null);

    try {
      const response = await fetch(`/api/baseclout?url=${encodeURIComponent(linkedinUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze profile');
      }

      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">BaseClout Analysis</h1>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <button 
            className="underline ml-2" 
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input form */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <form onSubmit={analyzeProfile}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LinkedIn Profile URL
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://www.linkedin.com/in/username"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze Profile'}
          </button>
        </form>
      </div>

      {/* Results display */}
      {profileData && (
        <div className="bg-white shadow-md rounded p-6">
          <h2 className="text-xl font-semibold mb-4">Profile Analysis Results</h2>
          
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Base Clout Rating</h3>
              <div className="text-3xl font-bold text-blue-600">
                {profileData.anthropicAnalysis.baseCloutRating}/100
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Analysis</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {profileData.anthropicAnalysis.analysis}
              </p>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Network Insights</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {profileData.anthropicAnalysis.networkInsights}
              </p>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
              <ul className="list-disc list-inside space-y-2">
                {profileData.anthropicAnalysis.recommendations.map((rec, index) => (
                  <li key={index} className="text-gray-700">{rec}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Show Raw Profile Data as a dropdown */}
          <details className="mt-6 border p-4 rounded">
            <summary className="cursor-pointer font-semibold">Raw Profile Data</summary>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
              {JSON.stringify(profileData, null, 2)}
            </pre>
          </details>

          {/* Show Connections with dropdowns */}
          {profileData.connections && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Connections</h3>
              {profileData.connections.map((connection, index) => (
                <details key={index} className="border p-4 rounded mb-2">
                  <summary className="cursor-pointer font-semibold">
                    {connection.firstName} {connection.lastName}
                  </summary>
                  {connection.profile && (
                    <div className="mt-2">
                      <p className="font-medium">Profile Details:</p>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                        {formatProfile(connection.profile)}
                      </pre>
                    </div>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 