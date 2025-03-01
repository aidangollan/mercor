import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Neo4j Web App",
  description: "Web application with Neo4j database integration",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-bold">
              Neo4j Web App
            </Link>
            <div className="space-x-4">
              <Link href="/" className="hover:text-gray-300">
                Home
              </Link>
              <Link href="/people" className="hover:text-gray-300">
                People
              </Link>
              <Link href="/linkedin" className="hover:text-gray-300">
                LinkedIn
              </Link>
              <Link href="/baseclout" className="hover:text-gray-300">
                BaseClout
              </Link>
            </div>
          </div>
        </nav>
        <main className="container mx-auto py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
