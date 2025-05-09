'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SearchBar from './SearchBar';
import TabNavigation from './TabNavigation';
import MediaResults from './MediaResults';
import Modal from './Modal';
import SearchHistorySidebar from './SearchHistorySidebar';
import { fetchMedia, MediaResult, FetchResult } from '../../utils/fetchMedia';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState<'images' | 'audio' | 'videos'>('images');
  const [imageResults, setImageResults] = useState<MediaResult[]>([]);
  const [audioResults, setAudioResults] = useState<MediaResult[]>([]);
  const [videoResults, setVideoResults] = useState<MediaResult[]>([]);
  const [imagePage, setImagePage] = useState(1);
  const [audioPage, setAudioPage] = useState(1);
  const [videoPage, setVideoPage] = useState(1);
  const [imageTotal, setImageTotal] = useState<number | null>(null);
  const [audioTotal, setAudioTotal] = useState<number | null>(null);
  const [videoTotal, setVideoTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState<string>(query);
  const [selectedItem, setSelectedItem] = useState<MediaResult | null>(null);
  const [modalType, setModalType] = useState<'image' | 'audio' | 'video' | null>(null);
  const [relatedItems, setRelatedItems] = useState<MediaResult[]>([]);
  const [relatedPage, setRelatedPage] = useState(1);
  const [relatedTotal, setRelatedTotal] = useState<number | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [hasFetchedImages, setHasFetchedImages] = useState(false);
  const [hasFetchedAudio, setHasFetchedAudio] = useState(false);
  const [hasFetchedVideos, setHasFetchedVideos] = useState(false);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [exactPhrase, setExactPhrase] = useState<string>('');
  const [excludeWords, setExcludeWords] = useState<string>('');
  const [licenseFilter, setLicenseFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'openverse' | 'pixabay'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc'>('relevance');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const perPage = 20;
  const relatedPerPage = 4;

  const seenImageIdsRef = useRef<Set<string>>(new Set());
  const seenAudioIdsRef = useRef<Set<string>>(new Set());
  const seenVideoIdsRef = useRef<Set<string>>(new Set());

  const fetchSize = async (url: string): Promise<number | undefined> => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      console.warn('Invalid URL provided to fetchSize:', url);
      return undefined;
    }
    try {
      console.log('Attempting HEAD request for URL:', url);
      const headResponse = await fetch(url, { method: 'HEAD' });
      if (headResponse.ok) {
        const size = headResponse.headers.get('Content-Length');
        const sizeValue = size ? parseInt(size, 10) : undefined;
        console.log(`HEAD request successful for ${url}, size:`, sizeValue);
        return sizeValue;
      } else {
        console.warn(`HEAD request failed for ${url}, status: ${headResponse.status}`);
      }
    } catch (headErr) {
      console.warn(`HEAD request error for ${url}:`, headErr instanceof Error ? headErr.message : headErr);
    }
    try {
      console.log('Falling back to GET request with Range header for URL:', url);
      const getResponse = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });
      if (getResponse.ok) {
        const contentRange = getResponse.headers.get('Content-Range');
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)$/);
          const size = match ? parseInt(match[1], 10) : undefined;
          console.log(`GET request successful for ${url}, size:`, size);
          return size;
        } else {
          const size = getResponse.headers.get('Content-Length');
          const sizeValue = size ? parseInt(size, 10) : undefined;
          console.log(`GET request successful for ${url}, size (Content-Length):`, sizeValue);
          return sizeValue;
        }
      } else {
        console.warn(`GET request failed for ${url}, status: ${getResponse.status}`);
      }
    } catch (getErr) {
      console.warn(`GET request error for ${url}:`, getErr instanceof Error ? getErr.message : getErr);
    }
    console.log(`Unable to fetch size for ${url}, returning undefined`);
    return undefined;
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fetchRelatedItems = useCallback(async (item: MediaResult, page: number, append: boolean = false) => {
    if (!item.tags || item.tags.length === 0) {
      setRelatedItems([]);
      setRelatedTotal(null);
      return;
    }
    setRelatedLoading(true);
    try {
      const type = item.source === 'openverse' && activeTab === 'audio' ? 'audio' : activeTab === 'videos' ? 'videos' : 'images';
      let url: string;
      let headers: Headers | undefined;
      if (item.source === 'openverse' && activeTab === 'audio' && item.id === '4bc43a04-ef46-4544-a0c1-63c63f56e276') {
        url = `https://api.openverse.org/v1/images/${item.id}/related/`;
        headers = new Headers({ Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}` });
      } else {
        const tagQuery = item.tags[0];
        url = item.source === 'openverse'
          ? `https://api.openverse.org/v1/${type}/?q=${encodeURIComponent(tagQuery)}&page=${page}&page_size=${relatedPerPage}${licenseFilter !== 'all' && item.source === 'openverse' ? `&license=${licenseFilter}` : ''}`
          : type === 'videos'
          ? `https://pixabay.com/api/videos/?key=${process.env.NEXT_PUBLIC_PIXABAY_API_KEY}&q=${encodeURIComponent(tagQuery)}&page=${page}&per_page=${relatedPerPage}`
          : `https://pixabay.com/api/?key=${process.env.NEXT_PUBLIC_PIXABAY_API_KEY}&q=${encodeURIComponent(tagQuery)}&image_type=photo&page=${page}&per_page=${relatedPerPage}`;
        headers = item.source === 'openverse' && process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN
          ? new Headers({ Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}` })
          : undefined;
      }

      const res = await fetch(url, headers ? { headers } : undefined);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch related items: ${errorText}`);
      }
      const data = await res.json();
      let related: MediaResult[] = [];
      if (item.source === 'openverse') {
        const openverseData = data as any;
        related = (openverseData.results || []).map((relatedItem: any) => ({
          id: relatedItem.id.toString(),
          title: relatedItem.title || 'Untitled',
          url: relatedItem.url || '',
          thumbnail: relatedItem.thumbnail || (type === 'audio' ? '/placeholder-audio.png' : type === 'videos' ? '/placeholder-video.png' : ''),
          creator: relatedItem.creator || 'Unknown',
          license: relatedItem.license || 'Unknown',
          source: 'openverse' as const,
          tags: relatedItem.tags?.map((tag: any) => tag.name) || [],
          size: undefined,
        }));
        if (!append) setRelatedTotal(openverseData.result_count || 0);
      } else if (type === 'videos') {
        const pixabayData = data as any;
        related = (pixabayData.hits || []).map((relatedItem: any) => ({
          id: relatedItem.id.toString(),
          title: relatedItem.tags || 'Untitled',
          url: relatedItem.pageURL || '',
          thumbnail: relatedItem.videos?.tiny?.thumbnail || '/placeholder-video.png',
          videoURL: relatedItem.videos?.medium?.url || relatedItem.videos?.small?.url || '',
          creator: relatedItem.user || 'Unknown',
          license: 'Pixabay License',
          source: 'pixabay' as const,
          tags: relatedItem.tags?.split(',').map((tag: string) => tag.trim()) || [],
          size: undefined,
        }));
        if (!append) setRelatedTotal(pixabayData.totalHits || 0);
      } else {
        const pixabayData = data as any;
        related = (pixabayData.hits || []).map((relatedItem: any) => ({
          id: relatedItem.id.toString(),
          title: relatedItem.tags || 'Untitled',
          url: relatedItem.pageURL || '',
          thumbnail: relatedItem.webformatURL || '',
          creator: relatedItem.user || 'Unknown',
          license: 'Pixabay License',
          source: 'pixabay' as const,
          tags: relatedItem.tags?.split(',').map((tag: string) => tag.trim()) || [],
          largeImageURL: relatedItem.largeImageURL,
          previewURL: relatedItem.previewURL,
          size: undefined,
        }));
        if (!append) setRelatedTotal(pixabayData.totalHits || 0);
      }
      const filteredRelated = related.filter((relatedItem) => relatedItem.id !== item.id);
      setRelatedItems((prevRelatedItems) => (append ? [...prevRelatedItems, ...filteredRelated] : filteredRelated));
    } catch (err) {
      console.error('Error fetching related items:', err);
      setRelatedItems([]);
      setRelatedTotal(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch related items.');
    } finally {
      setRelatedLoading(false);
    }
  }, [activeTab, licenseFilter]);

  const openModal = (item: MediaResult, type: 'image' | 'audio' | 'video') => {
    setSelectedItem(item);
    setModalType(type);
    setRelatedPage(1);
    fetchRelatedItems(item, 1);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setModalType(null);
    setRelatedItems([]);
    setRelatedPage(1);
    setRelatedTotal(null);
  };

  const handleTagClick = (tag: string) => {
    router.push(`/search?q=${encodeURIComponent(tag)}`);
    closeModal();
  };

  const handleRelatedItemClick = (item: MediaResult) => {
    setSelectedItem(item);
    setRelatedPage(1);
    fetchRelatedItems(item, 1);
  };

  const handleLoadMoreRelated = () => {
    if (selectedItem) {
      const nextPage = relatedPage + 1;
      setRelatedPage(nextPage);
      fetchRelatedItems(selectedItem, nextPage, true);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download the file. Please try viewing the file instead.');
    }
  };

  const getDisplayTitle = (item: MediaResult) => {
    if (item.source === 'pixabay' && item.tags && item.tags.length > 0) return item.tags[0];
    return item.title.length > 50 ? `${item.title.substring(0, 47)}...` : item.title;
  };

  const fetchMediaCallback = useCallback(
    async (type: 'images' | 'audio' | 'videos', page: number, append: boolean = false): Promise<FetchResult> => {
      return fetchMedia(
        type,
        page,
        query,
        exactPhrase,
        excludeWords,
        licenseFilter,
        sortBy,
        sourceFilter,
        seenImageIdsRef,
        seenAudioIdsRef,
        seenVideoIdsRef,
        append
      );
    },
    [query, exactPhrase, excludeWords, licenseFilter, sortBy, sourceFilter]
  );

  useEffect(() => {
    const exact = searchParams.get('exact') || '';
    const exclude = searchParams.get('exclude') || '';
    const license = searchParams.get('license') || 'all';
    const sort = (searchParams.get('sort') as 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc') || 'relevance';
    setExactPhrase(exact);
    setExcludeWords(exclude);
    setLicenseFilter(license);
    setSortBy(sort);
    if (sourceFilter !== 'openverse') {
      setLicenseFilter('all');
    }
  }, [searchParams, sourceFilter]);

  useEffect(() => {
    if (!query) return;
    if (lastQuery !== query) {
      setImagePage(1);
      setAudioPage(1);
      setVideoPage(1);
      setImageResults([]);
      setAudioResults([]);
      setVideoResults([]);
      setImageTotal(null);
      setAudioTotal(null);
      setVideoTotal(null);
      setHasFetchedImages(false);
      setHasFetchedAudio(false);
      setHasFetchedVideos(false);
      setError(null);
      seenImageIdsRef.current.clear();
      seenAudioIdsRef.current.clear();
      seenVideoIdsRef.current.clear();
      setLastQuery(query);
    }
    if (session?.user?.id) console.log(`User ${session.user.id} searched for: ${query}`);
    const fetchInitial = async () => {
      if ((activeTab === 'images' && hasFetchedImages) || (activeTab === 'audio' && hasFetchedAudio) || (activeTab === 'videos' && hasFetchedVideos)) return;
      setLoading(true);
      try {
        const { items, total } = await fetchMediaCallback(activeTab, 1);
        if (activeTab === 'images') {
          setImageResults(items);
          setImageTotal(total);
          setHasFetchedImages(true);
        } else if (activeTab === 'audio') {
          setAudioResults(items);
          setAudioTotal(total);
          setHasFetchedAudio(true);
        } else {
          setVideoResults(items);
          setVideoTotal(total);
          setHasFetchedVideos(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch media. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [query, activeTab, session, fetchMediaCallback, hasFetchedImages, hasFetchedAudio, hasFetchedVideos, lastQuery]);

  useEffect(() => {
    if (!query) return;
    const fetchTabData = async () => {
      if (activeTab === 'images' && !hasFetchedImages) {
        setLoading(true);
        try {
          const { items, total } = await fetchMediaCallback('images', 1);
          setImageResults(items);
          setImageTotal(total);
          setHasFetchedImages(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch images. Please try again.');
        } finally {
          setLoading(false);
        }
      } else if (activeTab === 'audio' && !hasFetchedAudio) {
        setLoading(true);
        try {
          const { items, total } = await fetchMediaCallback('audio', 1);
          setAudioResults(items);
          setAudioTotal(total);
          setHasFetchedAudio(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch audio. Please try again.');
        } finally {
          setLoading(false);
        }
      } else if (activeTab === 'videos' && !hasFetchedVideos) {
        setLoading(true);
        try {
          const { items, total } = await fetchMediaCallback('videos', 1);
          setVideoResults(items);
          setVideoTotal(total);
          setHasFetchedVideos(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch videos. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchTabData();
  }, [activeTab, query, fetchMediaCallback, hasFetchedImages, hasFetchedAudio, hasFetchedVideos]);

  const handleLoadMore = async (type: 'images' | 'audio' | 'videos') => {
    setLoading(true);
    try {
      if (type === 'images') {
        const nextPage = imagePage + 1;
        const { items } = await fetchMediaCallback('images', nextPage, true);
        setImageResults((prev) => [...prev, ...items]);
        setImagePage(nextPage);
      } else if (type === 'audio') {
        const nextPage = audioPage + 1;
        const { items } = await fetchMediaCallback('audio', nextPage, true);
        setAudioResults((prev) => [...prev, ...items]);
        setAudioPage(nextPage);
      } else {
        const nextPage = videoPage + 1;
        const { items } = await fetchMediaCallback('videos', nextPage, true);
        setVideoResults((prev) => [...prev, ...items]);
        setVideoPage(nextPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch more media. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveSearch = async (query: string, type: string) => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch('/api/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to save search');
      }
    } catch (err) {
      console.error('Error saving search:', err);
      setError(err instanceof Error ? err.message : 'Failed to save search');
    }
  };

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const queryParams = new URLSearchParams();
      queryParams.set('q', searchInput.trim());
      if (exactPhrase.trim()) queryParams.set('exact', exactPhrase.trim());
      if (excludeWords.trim()) queryParams.set('exclude', excludeWords.trim());
      if (licenseFilter !== 'all') queryParams.set('license', licenseFilter);
      if (sortBy !== 'relevance') queryParams.set('sort', sortBy);

      // Save the search to the database and trigger refresh
      await saveSearch(searchInput.trim(), activeTab);

      router.push(`/search?${queryParams.toString()}`);
      setShowAdvancedSearch(false);
      setImagePage(1);
      setAudioPage(1);
      setVideoPage(1);
      setImageResults([]);
      setAudioResults([]);
      setVideoResults([]);
      setImageTotal(null);
      setAudioTotal(null);
      setVideoTotal(null);
      setHasFetchedImages(false);
      setHasFetchedAudio(false);
      setHasFetchedVideos(false);
      setError(null);
      seenImageIdsRef.current.clear();
      seenAudioIdsRef.current.clear();
      seenVideoIdsRef.current.clear();
      setLastQuery(searchInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100 font-sans flex">
      {/* Sidebar */}
      <SearchHistorySidebar refresh={() => {}} />

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300">
        <div className="sticky top-0 z-10 bg-gray-800 shadow-md p-6">
          <SearchBar
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            exactPhrase={exactPhrase}
            setExactPhrase={setExactPhrase}
            excludeWords={excludeWords}
            setExcludeWords={setExcludeWords}
            licenseFilter={licenseFilter}
            setLicenseFilter={setLicenseFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            showAdvancedSearch={showAdvancedSearch}
            setShowAdvancedSearch={setShowAdvancedSearch}
            handleSearch={handleSearch}
          />
        </div>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-100">
              Search Results for "<span className="text-indigo-400">{query}</span>"
            </h1>
            <Link
              href="/"
              className="flex items-center px-4 py-2 bg-gray-700 text-gray-200 rounded-full hover:bg-gray-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
              Back to Home
            </Link>
          </div>
          <div className="flex flex-col gap-6">
            <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
            <MediaResults
              activeTab={activeTab}
              imageResults={imageResults}
              audioResults={audioResults}
              videoResults={videoResults}
              imageTotal={imageTotal}
              audioTotal={audioTotal}
              videoTotal={videoTotal}
              loading={loading}
              error={error}
              openModal={openModal}
              handleLoadMore={handleLoadMore}
            />
          </div>
          <Modal
            selectedItem={selectedItem}
            modalType={modalType}
            relatedItems={relatedItems}
            relatedTotal={relatedTotal}
            relatedLoading={relatedLoading}
            getDisplayTitle={getDisplayTitle}
            handleTagClick={handleTagClick}
            handleRelatedItemClick={handleRelatedItemClick}
            handleLoadMoreRelated={handleLoadMoreRelated}
            handleDownload={handleDownload}
            closeModal={closeModal}
          />
        </div>
      </div>
    </div>
  );
}