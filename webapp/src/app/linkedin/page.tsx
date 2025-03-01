"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function LinkedInConnectionsVerifier() {
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    // Check if the current URL has ?uploaded=true
    const params = new URLSearchParams(window.location.search);
    if (params.get("uploaded") === "true") {
      setUploaded(true);
    }
  }, []);

  const handleRedirectToLinkedIn = () => {
    // Redirect to the LinkedIn Connections page – your extension will inject its button there.
    window.location.href = "https://www.linkedin.com/mynetwork/invite-connect/connections";
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">LinkedIn Connections Upload</h1>
      <p className="mb-4">
        Click the button below to go to the LinkedIn Connections page. Make sure the
        LinkedIn Connection Uploader extension is installed.
      </p>
      {uploaded ? (
        <div className="p-4 bg-green-100 rounded">
          <p>Your connections have been uploaded successfully.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <button
          onClick={handleRedirectToLinkedIn}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded"
        >
          Go to LinkedIn Connections
        </button>
      )}
    </div>
  );
}