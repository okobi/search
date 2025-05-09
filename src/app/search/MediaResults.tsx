import { useState } from 'react';

interface MediaResult {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  videoURL?: string;
  creator?: string;
  license: string;
  source: 'openverse' | 'pixabay';
  tags?: string[];
  largeImageURL?: string;
  previewURL?: string;
  size?: number;
}

interface MediaResultsProps {
  activeTab: 'images' | 'audio' | 'videos';
  imageResults: MediaResult[];
  audioResults: MediaResult[];
  videoResults: MediaResult[];
  imageTotal: number | null;
  audioTotal: number | null;
  videoTotal: number | null;
  loading: boolean;
  error: string | null;
  openModal: (item: MediaResult, type: 'image' | 'audio' | 'video') => void;
  handleLoadMore: (type: 'images' | 'audio' | 'videos') => void;
}

export default function MediaResults({ activeTab, imageResults, audioResults, videoResults, imageTotal, audioTotal, videoTotal, loading, error, openModal, handleLoadMore }: MediaResultsProps) {
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());

  const handleMediaError = (key: string) => {
    setFailedMedia((prev) => {
      const newSet = new Set(prev);
      newSet.add(key);
      return newSet;
    });
  };

  const renderResults = (results: MediaResult[], type: 'images' | 'audio' | 'videos') => {
    const total = type === 'images' ? imageTotal : type === 'audio' ? audioTotal : videoTotal;
    const hasMore = total !== null && results.length < total;

    if (loading && results.length === 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="bg-gray-900/50 rounded-lg p-2 animate-pulse border border-neon-purple/20">
              <div className="w-full h-40 bg-gray-800 rounded-lg"></div>
            </div>
          ))}
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg className="w-10 h-10 text-neon-pink mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"></path>
          </svg>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      );
    }
    if (results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg className="w-10 h-10 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <p className="text-gray-400 text-sm">No results found</p>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map((item, index) => {
            const key = `${item.source}-${item.id}-${index}`;
            const mediaFailed = failedMedia.has(key);
            const displayTitle = item.title.length > 30 ? `${item.title.substring(0, 27)}...` : item.title;

            return (
              <div
                key={key}
                className="bg-gray-900/50 rounded-lg overflow-hidden border border-neon-purple/20 hover:border-neon-purple/50 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                onClick={() => openModal(item, type === 'audio' ? 'audio' : type === 'videos' ? 'video' : 'image')}
              >
                {type === 'videos' ? (
                  !mediaFailed ? (
                    <div className="relative w-full h-40">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover rounded-t-lg"
                        onError={() => handleMediaError(key)}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-opacity">
                        <svg
                          className="w-8 h-8 text-neon-cyan opacity-70 hover:opacity-100"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gray-800 flex items-center justify-center rounded-t-lg">
                      <span className="text-gray-500 text-xs">No Preview</span>
                    </div>
                  )
                ) : item.thumbnail && !mediaFailed ? (
                  <div className="relative w-full h-40">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover rounded-t-lg"
                      onError={() => handleMediaError(key)}
                    />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-opacity flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-neon-cyan opacity-0 hover:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        ></path>
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-40 bg-gray-800 flex items-center justify-center rounded-t-lg">
                    <span className="text-gray-500 text-xs">No Preview</span>
                  </div>
                )}
                <div className="p-2">
                  <h3 className="text-sm font-medium text-gray-200 truncate">{displayTitle}</h3>
                </div>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div className="text-center mt-6">
            <button
              onClick={() => handleLoadMore(type)}
              className="px-4 py-2 bg-transparent text-neon-cyan border border-neon-cyan rounded-full hover:bg-neon-cyan/20 hover:text-white transition-all duration-300 disabled:opacity-50 flex items-center justify-center mx-auto text-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 mr-2 text-neon-cyan"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {activeTab === 'images' && renderResults(imageResults, 'images')}
      {activeTab === 'audio' && renderResults(audioResults, 'audio')}
      {activeTab === 'videos' && renderResults(videoResults, 'videos')}
    </>
  );
}