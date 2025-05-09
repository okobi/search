'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type SearchEntry = {
  id: string;
  query: string;
  type: string;
  createdAt: string;
};

export default function SearchHistorySidebar({ refresh }: { refresh: () => void }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSearchHistory = async () => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    try {
      const res = await fetch('/api/search-history', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to fetch search history');
      }
      const data = await res.json();
      setSearchHistory(data);
    } catch (err) {
      console.error('Error fetching search history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch search history');
    }
  };

  const deleteSearch = async (id: string) => {
    try {
      const res = await fetch(`/api/search-history?id=${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to delete search');
      }
      fetchSearchHistory();
    } catch (err) {
      console.error('Error deleting search:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete search');
    }
  };

  const clearAllHistory = async () => {
    try {
      const res = await fetch('/api/search-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to clear search history');
      }
      setSearchHistory([]);
      fetchSearchHistory();
    } catch (err) {
      console.error('Error clearing search history:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear search history');
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSearchHistory();
    }
  }, [status, session]);

  useEffect(() => {
    refresh();
    fetchSearchHistory();
  }, [refresh]);

  const handleSearchClick = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const toggleSidebar = () => {
    setIsOpen((prev) => !prev);
  };

  if (status === 'loading' || status !== 'authenticated') {
    return null;
  }

  const sidebarWidth = isOpen ? 'w-60' : 'w-0';
  const toggleButtonClass = isOpen ? 'hidden' : 'block';

  return (
    <div className="fixed top-0 left-0 h-full z-20">
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 left-0 p-2 bg-transparent border border-neon-cyan text-neon-cyan rounded-full hover:bg-neon-cyan/20 transition-all duration-300 focus:outline-none ${toggleButtonClass} z-30`}
      >
        <svg
          className={`w-4 h-4 transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>

      <div
        className={`h-full bg-gray-900/70 backdrop-blur-md border-r border-neon-purple/30 transition-all duration-300 ease-in-out ${sidebarWidth} overflow-hidden`}
      >
        <div className="relative p-3 h-full flex flex-col">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-200">History</h2>
            {searchHistory.length > 0 && (
              <div className="flex justify-end mt-10">
                <button
                  onClick={clearAllHistory}
                  className="text-xs text-neon-pink hover:text-neon-pink/80 transition-colors duration-200"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-neon-pink mb-2">{error}</p>}
          {searchHistory.length === 0 && !error && (
            <p className="text-xs text-gray-500">No history yet</p>
          )}
          <div className="flex-1 overflow-y-auto">
            {searchHistory.map((search, index) => (
              <div
                key={search.id}
                className={`mb-2 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 group relative transition-all duration-300 ${
                  index === 0 ? 'animate-slide-in' : ''
                }`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => handleSearchClick(search.query)}
                >
                  <p className="text-sm text-gray-200 truncate">{search.query}</p>
                  <p className="text-xs text-gray-500">
                    {search.type} |{' '}
                    {new Date(search.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => deleteSearch(search.id)}
                  className="absolute top-1/2 right-2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 text-neon-pink hover:text-neon-pink/80 transition-opacity duration-200"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {isOpen && (
            <button
              onClick={toggleSidebar}
              className="absolute top-3 right-3 p-2 bg-transparent border border-neon-cyan text-neon-cyan rounded-full hover:bg-neon-cyan/20 transition-all duration-300 focus:outline-none z-10"
            >
              <svg
                className="w-4 h-4 transform rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}