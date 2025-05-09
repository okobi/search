'use client';

import { JSX, useState } from 'react';
// import { signOut, useSession } from'react';
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
    appliedFilters.push(<li key="exact">Exact: "{exactPhrase}"</li>);
  }
  if (excludeWords) {
    appliedFilters.push(<li key="exclude">Exclude: {excludeWords}</li>);
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
        Sort: {
          sortBy === 'size' ? 'Size' :
          sortBy === 'title-asc' ? 'Title (A-Z)' :
          sortBy === 'title-desc' ? 'Title (Z-A)' :
          sortBy === 'source-asc' ? 'Source (A-Z)' :
          'Source (Z-A)'
        }
      </li>
    );
  }

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await signOut({ redirect: false });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="flex items-center space-x-2">
        <div className="relative flex-grow">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-4 h-4 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search media..."
            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 backdrop-blur-md border border-neon-purple/30 rounded-full text-gray-200 placeholder-gray-500 focus:border-neon-purple focus:ring-2 focus:ring-neon-purple/50 transition-all duration-300"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-transparent border border-neon-cyan text-neon-cyan rounded-full hover:bg-neon-cyan/20 hover:text-white transition-all duration-300"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          className="px-3 py-2 bg-transparent border border-neon-purple text-neon-purple rounded-full hover:bg-neon-purple/20 hover:text-white transition-all duration-300 flex items-center"
        >
          <svg
            className={`w-3 h-3 mr-1 transition-transform ${showAdvancedSearch ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          Advanced
        </button>
        {status === 'authenticated' && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="px-3 py-2 bg-transparent border border-neon-pink text-neon-pink rounded-full hover:bg-neon-pink/20 hover:text-white disabled:opacity-50 transition-all duration-300"
          >
            {logoutLoading ? '...' : 'Logout'}
          </button>
        )}
      </form>

      {showAdvancedSearch && (
        <div className="mt-2 bg-gray-900/70 backdrop-blur-md p-3 rounded-lg border border-neon-purple/30 z-20">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-xs font-medium text-gray-300 w-20">Exact Phrase:</label>
              <input
                type="text"
                value={exactPhrase}
                onChange={(e) => setExactPhrase(e.target.value)}
                placeholder="e.g., mountain sunset"
                className="flex-grow px-2 py-1 bg-gray-900/50 border border-neon-purple/20 rounded-lg text-gray-200 placeholder-gray-500 focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-medium text-gray-300 w-20">Exclude Words:</label>
              <input
                type="text"
                value={excludeWords}
                onChange={(e) => setExcludeWords(e.target.value)}
                placeholder="e.g., forest river"
                className="flex-grow px-2 py-1 bg-gray-900/50 border border-neon-purple/20 rounded-lg text-gray-200 placeholder-gray-500 focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-medium text-gray-300 w-20">Source:</label>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  if (typeof setSourceFilter === 'function') {
                    setSourceFilter(e.target.value as 'all' | 'openverse' | 'pixabay');
                  }
                }}
                className="flex-grow px-2 py-1 bg-gray-900/50 border border-neon-purple/20 rounded-lg text-gray-200 focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 text-sm"
              >
                <option value="all">All Sources</option>
                <option value="openverse">Openverse</option>
                <option value="pixabay">Pixabay</option>
              </select>
            </div>
            {sourceFilter !== 'pixabay' && (
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-gray-300 w-20">License:</label>
                <select
                  value={licenseFilter}
                  onChange={(e) => setLicenseFilter(e.target.value)}
                  className="flex-grow px-2 py-1 bg-gray-900/50 border border-neon-purple/20 rounded-lg text-gray-200 focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 text-sm"
                >
                  <option value="all">All Licenses</option>
                  <option value="cc0">CC0</option>
                  <option value="by">CC BY</option>
                  <option value="by-sa">CC BY-SA</option>
                  <option value="by-nc-nd">CC BY-NC-ND</option>
                  <option value="by-nc-sa">CC BY-NC-SA</option>
                  <option value="by-nc">CC BY-NC</option>
                  <option value="by-nd">CC BY-ND</option>
                </select>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-medium text-gray-300 w-20">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc')}
                className="flex-grow px-2 py-1 bg-gray-900/50 border border-neon-purple/20 rounded-lg text-gray-200 focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 text-sm"
              >
                <option value="relevance">Relevance</option>
                <option value="size">Size</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
                <option value="source-asc">Source (A-Z)</option>
                <option value="source-desc">Source (Z-A)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {appliedFilters.length > 0 && (
        <div className="mt-2 text-xs text-gray-400 border-t border-neon-purple/20 pt-2">
          <p className="font-medium">Filters:</p>
          <ul className="list-none space-y-1">
            {appliedFilters}
          </ul>
        </div>
      )}
    </div>
  );
}