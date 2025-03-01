"use client";

import React, { useState } from "react";
import { Prove } from "@plutoxyz/web-proofs";
import Link from "next/link";

type ProofResult = { proof: string | null; error: string | null };

export default function LinkedInConnectionsVerifier() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pluto manifest URL – ensure this file exists in your public folder.
  const manifestUrl = "/pluto-manifest.json";

  const handleStartVerification = () => {
    setIsVerifying(true);
    setError(null);
    setProofResult(null);
  };

  const handleProofComplete = (result: ProofResult): void => {
    setProofResult(result);
    setIsVerifying(false);
  };

  const handleProofError = (err: any): void => {
    console.error("Proof generation failed:", err);
    setError("Failed to generate proof. Please try again.");
    setIsVerifying(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">LinkedIn Connections Verifier</h1>
      <p className="mb-4">
        Verify your LinkedIn connections with cryptographic proof without exposing your complete list.
      </p>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">How it Works:</h2>
        <ol className="list-decimal list-inside">
          <li>Click the "Verify My LinkedIn Connections" button below</li>
          <li>Log in to your LinkedIn account when prompted</li>
          <li>Your connections data is fetched and verified cryptographically</li>
          <li>The generated proof confirms your connection count and details</li>
        </ol>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Privacy Notice:</h3>
        <p>
          Your login credentials are never stored. Only a cryptographic proof derived from your connections is generated, ensuring your complete list remains private.
        </p>
      </div>

      {!isVerifying && !proofResult && (
        <button 
          onClick={handleStartVerification}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded"
        >
          Verify My LinkedIn Connections
        </button>
      )}

      {isVerifying && (
        <div className="mt-4">
          <p>Verification in progress...</p>
          <Prove 
            manifestUrl={manifestUrl}
          />
        </div>
      )}

      {proofResult && (
        <div className="mt-6 p-4 bg-green-100 rounded">
          <h2 className="text-2xl font-bold mb-2">Verification Complete!</h2>
          <p>Your LinkedIn connections have been verified.</p>
          <div className="mt-4">
            <h3 className="font-semibold">Proof Details:</h3>
            <pre className="bg-gray-200 p-2 rounded text-sm overflow-x-auto">
              {JSON.stringify(proofResult, null, 2)}
            </pre>
          </div>
          <button 
            onClick={handleStartVerification}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded"
          >
            Verify Again
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-100 rounded">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={handleStartVerification}
            className="mt-4 bg-red-600 hover:bg-red-500 text-white font-medium py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="mt-8">
        <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
      </div>
    </div>
  );
}