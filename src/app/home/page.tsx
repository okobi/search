'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function Home() {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center py-8 px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="w-full p-4 bg-gray-900/50 backdrop-blur-md rounded-lg border border-neon-purple/30 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-semibold text-gray-200">
            {status === 'loading' ? 'Loading...' : `Welcome, ${session?.user?.name || 'User'}`}
          </h1>
        </div>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-all"
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <h2 className="text-4xl font-bold text-gray-200 mb-4">Opensearch App</h2>
        <form onSubmit={handleSearch} className="w-full max-w-2xl flex flex-col items-center space-y-3">
          <div className="relative w-full">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for images, audio, or videos..."
              className="w-full p-2 pl-10 rounded-full border border-neon-purple/20 bg-gray-900/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-purple/50 transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neon-cyan"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-gray-800 text-gray-200 rounded-full hover:bg-gray-700 transition-all"
          >
            Search
          </button>
        </form>
      </main>
    </div>
  );
}