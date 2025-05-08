'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { format, isToday, isYesterday, subDays, subMonths, subYears } from 'date-fns';

type Search = {
  id: string;
  query: string;
  type: string;
  createdAt: string; // ISO string
};

type HistorySection = {
  title: string;
  searches: Search[];
};

export default function Sidebar() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<HistorySection[]>([]);

  useEffect(() => {
    console.log('Session State:', { session, status }); // Log session and status
    const fetchHistory = async () => {
      if (status !== 'authenticated' || !session?.user?.id) {
        console.log('Skipping fetch - Not authenticated or no user ID:', { status, userId: session?.user?.id });
        return;
      }

      const url = `/api/search?userId=${encodeURIComponent(session.user.id)}`; // Encode userId
      console.log('Fetching history from URL:', url); // Log the exact URL

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch search history');
        const searches: Search[] = await response.json();

        const today: Search[] = [];
        const yesterday: Search[] = [];
        const last7Days: Search[] = [];
        const last30Days: Search[] = [];
        const lastYear: Search[] = [];

        const now = new Date();
        const sevenDaysAgo = subDays(now, 7);
        const thirtyDaysAgo = subDays(now, 30);
        const oneYearAgo = subYears(now, 1);

        searches.forEach((search) => {
          const createdAt = new Date(search.createdAt);
          if (isToday(createdAt)) {
            today.push(search);
          } else if (isYesterday(createdAt)) {
            yesterday.push(search);
          } else if (createdAt >= sevenDaysAgo) {
            last7Days.push(search);
          } else if (createdAt >= thirtyDaysAgo) {
            last30Days.push(search);
          } else if (createdAt >= oneYearAgo) {
            lastYear.push(search);
          }
        });

        const sections: HistorySection[] = [];
        if (today.length > 0) sections.push({ title: 'Today', searches: today });
        if (yesterday.length > 0) sections.push({ title: 'Yesterday', searches: yesterday });
        if (last7Days.length > 0) sections.push({ title: 'Previous 7 Days', searches: last7Days });
        if (last30Days.length > 0) sections.push({ title: 'Previous 30 Days', searches: last30Days });
        if (lastYear.length > 0) sections.push({ title: 'Previous Year', searches: lastYear });

        setHistory(sections);
      } catch (error) {
        console.error('Error fetching search history:', error);
      }
    };

    fetchHistory();
  }, [session, status]);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-20 p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-all md:hidden"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div
        className={`fixed top-0 left-0 h-full bg-white shadow-lg z-10 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:w-64 w-3/4 max-w-xs overflow-y-auto`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Search History</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden text-gray-600 hover:text-gray-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {status === 'loading' ? (
            <p className="text-gray-500">Loading...</p>
          ) : !session ? (
            <p className="text-gray-500">Please sign in to view search history.</p>
          ) : history.length === 0 ? (
            <p className="text-gray-500">No search history available.</p>
          ) : (
            <div className="space-y-4">
              {history.map((section) => (
                <div key={section.title}>
                  <h3 className="text-lg font-medium text-gray-700">{section.title}</h3>
                  <ul className="mt-2 space-y-2">
                    {section.searches.map((search) => (
                      <li key={search.id}>
                        <Link
                          href={`/search?q=${encodeURIComponent(search.query)}`}
                          className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span className="truncate">{search.query}</span>
                          <span className="text-xs text-gray-400">({search.type})</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="mt-4">
                <Link
                  href="/history"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Show All
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-0 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}