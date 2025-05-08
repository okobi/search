'use client';

import { JSX, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';

interface SearchBarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  exactPhrase: string;
  setExactPhrase: (value: string) => void;
  excludeWords: string;
  setExcludeWords: (value: string) => void;
  licenseFilter: string;
  setLicenseFilter: (value: string) => void;
  sourceFilter: 'all' | 'openverse' | 'pixabay' | undefined;
  setSourceFilter?: (value: 'all' | 'openverse' | 'pixabay') => void;
  sortBy: 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc';
  setSortBy: (value: 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc') => void;
  showAdvancedSearch: boolean;
  setShowAdvancedSearch: (value: boolean) => void;
  handleSearch: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function SearchBar({
  searchInput,
  setSearchInput,
  exactPhrase,
  setExactPhrase,
  excludeWords,
  setExcludeWords,
  licenseFilter,
  setLicenseFilter,
  sourceFilter = 'all',
  setSourceFilter,
  sortBy,
  setSortBy,
  showAdvancedSearch,
  setShowAdvancedSearch,
  handleSearch,
}: SearchBarProps) {
  const [logoutLoading, setLogoutLoading] = useState(false);
  const { status } = useSession();

  // Compute the list of applied filters
  const appliedFilters: JSX.Element[] = [];

  if (exactPhrase) {
    appliedFilters.push(<li key="exact">Exact Phrase: "{exactPhrase}"</li>);
  }
  if (excludeWords) {
    appliedFilters.push(<li key="exclude">Exclude Words: {excludeWords}</li>);
  }
  if (sourceFilter && sourceFilter !== 'all') {
    appliedFilters.push(<li key="source">Source: {sourceFilter.charAt(0).toUpperCase() + sourceFilter.slice(1)}</li>);
  }
  if (sourceFilter && (sourceFilter === 'all' || sourceFilter === 'openverse') && licenseFilter !== 'all') {
    appliedFilters.push(<li key="license">License: {licenseFilter.toUpperCase()}</li>);
  }
  if (sortBy !== 'relevance') {
    appliedFilters.push(
      <li key="sort">
        Sort By: {
          sortBy === 'size' ? 'Size (Largest First)' :
          sortBy === 'title-asc' ? 'Title (A-Z)' :
          sortBy === 'title-desc' ? 'Title (Z-A)' :
          sortBy === 'source-asc' ? 'Source (Openverse to Pixabay)' :
          'Source (Pixabay to Openverse)'
        }
      </li>
    );
  }

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await signOut({ redirect: false });
      window.location.href = '/'; // Hard redirect to sign-in page
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto relative">
      <form onSubmit={handleSearch} className="flex items-center">
        <div className="relative flex-grow">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search for images, audio, or videos..."
            className="w-full pl-12 pr-4 py-3 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </div>
        <button
          type="submit"
          className="ml-3 px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:from-indigo-600 hover:to-blue-600 focus:ring-2 focus:ring-indigo-400 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          className="ml-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-all duration-300 shadow-sm hover:shadow-md flex items-center"
        >
          Advanced
          <svg
            className={`w-4 h-4 ml-2 transition-transform ${showAdvancedSearch ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </button>
        {status === 'authenticated' && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="ml-2 px-4 py-3 bg-red-200 text-red-700 rounded-full hover:bg-red-300 disabled:bg-red-100 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            {logoutLoading ? 'Logging out...' : 'Logout'}
          </button>
        )}
      </form>

      {showAdvancedSearch && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white p-4 rounded-lg shadow-lg z-20">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
              <label className="text-sm font-medium text-gray-700 flex-shrink-0 sm:w-24">
                Exact Phrase:
              </label>
              <input
                type="text"
                value={exactPhrase}
                onChange={(e) => setExactPhrase(e.target.value)}
                placeholder='e.g., "mountain sunset"'
                className="flex-grow px-3 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
              <label className="text-sm font-medium text-gray-700 flex-shrink-0 sm:w-24">
                Exclude Words:
              </label>
              <input
                type="text"
                value={excludeWords}
                onChange={(e) => setExcludeWords(e.target.value)}
                placeholder="e.g., forest river"
                className="flex-grow px-3 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
              <label className="text-sm font-medium text-gray-700 flex-shrink-0 sm:w-24">
                Source Filter:
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  if (typeof setSourceFilter === 'function') {
                    setSourceFilter(e.target.value as 'all' | 'openverse' | 'pixabay');
                  }
                }}
                className="flex-grow px-3 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-400 text-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <option value="all">All Sources</option>
                <option value="openverse">Openverse</option>
                <option value="pixabay">Pixabay</option>
              </select>
            </div>
            {sourceFilter !== 'pixabay' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                <label className="text-sm font-medium text-gray-700 flex-shrink-0 sm:w-24">
                  License Filter:
                </label>
                <select
                  value={licenseFilter}
                  onChange={(e) => setLicenseFilter(e.target.value)}
                  className="flex-grow px-3 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-400 text-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  <option value="all">All Licenses</option>
                  <option value="cc0">CC0 (Public Domain)</option>
                  <option value="by">CC BY</option>
                  <option value="by-sa">CC BY-SA</option>
                  <option value="by-nc-nd">CC BY-NC-ND</option>
                  <option value="by-nc-sa">CC BY-NC-SA</option>
                  <option value="by-nc">CC BY-NC</option>
                  <option value="by-nd">CC BY-ND</option>
                </select>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
              <label className="text-sm font-medium text-gray-700 flex-shrink-0 sm:w-24">
                Sort By:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc')}
                className="flex-grow px-3 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-400 text-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <option value="relevance">Relevance</option>
                <option value="size">Size (Largest First)</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
                <option value="source-asc">Source (Openverse to Pixabay)</option>
                <option value="source-desc">Source (Pixabay to Openverse)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {appliedFilters.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          <p>Applied Filters:</p>
          <ul className="list-disc list-inside">
            {appliedFilters}
          </ul>
        </div>
      )}
    </div>
  );
}