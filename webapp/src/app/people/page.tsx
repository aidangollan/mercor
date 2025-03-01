'use client';

import { useState, useEffect } from 'react';
import { Person } from '~/server/db/models/person';

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState<string>('');
  const [cloutScore, setCloutScore] = useState<number>(0);
  const [linkedinUrl, setLinkedinUrl] = useState<string>('');
  
  // Fetch all people
  const fetchPeople = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/people');
      
      if (!response.ok) {
        throw new Error('Failed to fetch people');
      }
      
      const data = await response.json();
      setPeople(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Create a new person
  const createPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          clout_score: cloutScore,
          linkedin_url: linkedinUrl,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create person');
      }
      
      // Reset form
      setName('');
      setCloutScore(0);
      setLinkedinUrl('');
      
      // Refresh people list
      fetchPeople();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  
  // Delete a person
  const deletePerson = async (name: string) => {
    try {
      const response = await fetch(`/api/people?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete person');
      }
      
      // Refresh people list
      fetchPeople();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  
  // Load people on component mount
  useEffect(() => {
    fetchPeople();
  }, []);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">People Management</h1>
      
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
      
      {/* Add Person Form */}
      <div className="bg-white shadow-md rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Add New Person</h2>
        <form onSubmit={createPerson}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clout Score
              </label>
              <input
                type="number"
                value={cloutScore}
                onChange={(e) => setCloutScore(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
          >
            Add Person
          </button>
        </form>
      </div>
      
      {/* People List */}
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">People List</h2>
        
        {loading ? (
          <p>Loading...</p>
        ) : people.length === 0 ? (
          <p>No people found. Add some using the form above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clout Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LinkedIn
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {people.map((person, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {person.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {person.clout_score}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a 
                        href={person.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {person.linkedin_url}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => deletePerson(person.name)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
