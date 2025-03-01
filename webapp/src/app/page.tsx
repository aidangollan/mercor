"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function HomePage() {
  const searchParams = useSearchParams();
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    if (searchParams.get("uploaded") === "true") {
      setUploaded(true);
    }
  }, [searchParams]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      {uploaded && (
        <div className="p-4 mb-4 bg-green-100 rounded">
          <p className="text-green-800">Your LinkedIn connections have been uploaded successfully.</p>
        </div>
      )}
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Neo4j Web App
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl text-center">
          Welcome to your web application with Neo4j database integration. Manage people data with name, clout score, and LinkedIn URL attributes.
        </p>
        <div className="flex flex-col md:flex-row gap-4 mt-6">
          <Link
            href="/people"
            className="rounded-md bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Go to People Management
          </Link>
          <Link
            href="/graph"
            className="rounded-md bg-green-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
          >
            View Graph Visualization
          </Link>
          <Link
            href="/linkedin"
            className="rounded-md bg-purple-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
          >
            Verify LinkedIn Connections
          </Link>
        </div>
      </div>
    </main>
  );
}