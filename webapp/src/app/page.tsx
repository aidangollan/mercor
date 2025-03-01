import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Neo4j Web App
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl text-center">
          Welcome to your web application with Neo4j database integration. Manage people data with name, clout score, and LinkedIn URL attributes.
        </p>
        <div className="mt-6">
          <Link
            href="/people"
            className="rounded-md bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Go to People Management
          </Link>
        </div>
      </div>
    </main>
  );
}
