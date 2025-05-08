'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type MediaResult = {
  id: string;
  title: string;
  url: string; // Page URL or fallback URL
  thumbnail: string;
  videoURL?: string; // Actual video URL for playback
  creator?: string;
  license: string;
  source: 'openverse' | 'pixabay';
  tags?: string[];
  largeImageURL?: string; // For Pixabay images
  previewURL?: string;    // For Pixabay images
  size?: number;         // Size in bytes
};

type FetchResult = {
  items: MediaResult[];
  total: number;
};

// Openverse API response types
interface OpenverseItem {
  id: number | string;
  title?: string;
  url?: string;
  thumbnail?: string;
  creator?: string;
  license?: string;
  tags?: { name: string }[];
}

interface OpenverseResponse {
  result_count?: number;
  results: OpenverseItem[];
}

// Pixabay API response types
interface PixabayImageItem {
  id: number;
  pageURL?: string;
  tags?: string;
  user?: string;
  webformatURL?: string;
  largeImageURL?: string;
  previewURL?: string;
}

interface PixabayVideoItem {
  id: number;
  pageURL?: string;
  tags?: string;
  user?: string;
  videos?: {
    large?: { url: string; width: number; height: number; size?: number; thumbnail?: string };
    medium?: { url: string; width: number; height: number; size?: number; thumbnail?: string };
    small?: { url: string; width: number; height: number; size?: number; thumbnail?: string };
    tiny?: { url: string; width: number; height: number; size?: number; thumbnail?: string };
  };
}

interface PixabayResponse<T> {
  total?: number;
  totalHits?: number;
  hits: T[];
}

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
  // Advanced search states
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [exactPhrase, setExactPhrase] = useState<string>('');
  const [excludeWords, setExcludeWords] = useState<string>('');
  const [licenseFilter, setLicenseFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc'>('relevance');

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
        headers: {
          Range: 'bytes=0-0',
        },
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

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const queryParams = new URLSearchParams();
      queryParams.set('q', searchInput.trim());
      if (exactPhrase.trim()) queryParams.set('exact', exactPhrase.trim());
      if (excludeWords.trim()) queryParams.set('exclude', excludeWords.trim());
      if (licenseFilter !== 'all') queryParams.set('license', licenseFilter);
      if (sortBy !== 'relevance') queryParams.set('sort', sortBy);
      router.push(`/search?${queryParams.toString()}`);
      setShowAdvancedSearch(false);
      // Reset pagination and results to ensure fresh data
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

  const fetchRelatedItems = useCallback(
    async (item: MediaResult, page: number, append: boolean = false) => {
      if (!item.tags || item.tags.length === 0) {
        setRelatedItems([]);
        setRelatedTotal(null);
        return;
      }

      setRelatedLoading(true);
      try {
        const type =
          item.source === 'openverse' && activeTab === 'audio'
            ? 'audio'
            : activeTab === 'videos'
            ? 'videos'
            : 'images';
        let url;
        let headers;
        if (item.source === 'openverse' && activeTab === 'audio' && item.id === '4bc43a04-ef46-4544-a0c1-63c63f56e276') {
          url = `https://api.openverse.org/v1/images/${item.id}/related/`;
          headers = new Headers({
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}`,
          });
        } else {
          const tagQuery = item.tags[0];
          url =
            item.source === 'openverse'
              ? `https://api.openverse.org/v1/${type}/?q=${encodeURIComponent(tagQuery)}&page=${page}&page_size=${relatedPerPage}${licenseFilter !== 'all' ? `&license=${licenseFilter}` : ''}`
              : type === 'videos'
              ? `https://pixabay.com/api/videos/?key=${process.env.NEXT_PUBLIC_PIXABAY_API_KEY}&q=${encodeURIComponent(tagQuery)}&page=${page}&per_page=${relatedPerPage}`
              : `https://pixabay.com/api/?key=${process.env.NEXT_PUBLIC_PIXABAY_API_KEY}&q=${encodeURIComponent(tagQuery)}&image_type=photo&page=${page}&per_page=${relatedPerPage}`;
          headers =
            item.source === 'openverse' && process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN
              ? new Headers({
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}`,
                })
              : undefined;
        }

        const res = await fetch(url, headers ? { headers } : undefined);
        if (!res.ok) {
          throw new Error(`Failed to fetch related items: ${await res.text()}`);
        }

        const data = await res.json();
        let related: MediaResult[] = [];

        if (item.source === 'openverse') {
          const openverseData = data as OpenverseResponse;
          const relatedPromises = (openverseData.results || []).map(
            (relatedItem: OpenverseItem) =>
              new Promise<MediaResult>((resolve) => {
                const itemData: MediaResult = {
                  id: relatedItem.id.toString(),
                  title: relatedItem.title || 'Untitled',
                  url: relatedItem.url || '',
                  thumbnail: relatedItem.thumbnail || (type === 'audio' ? '/placeholder-audio.png' : type === 'videos' ? '/placeholder-video.png' : ''),
                  creator: relatedItem.creator || 'Unknown',
                  license: relatedItem.license || 'Unknown',
                  source: 'openverse' as const,
                  tags: relatedItem.tags?.map((tag) => tag.name) || [],
                  size: undefined,
                };
                fetchSize(relatedItem.url || '')
                  .then((size) => {
                    itemData.size = size;
                    resolve(itemData);
                  })
                  .catch((err) => {
                    console.warn(`Failed to fetch size for related item ${relatedItem.id}:`, err);
                    itemData.size = undefined;
                    resolve(itemData);
                  });
              })
          );
          related = await Promise.all(relatedPromises);
          if (!append) {
            setRelatedTotal(openverseData.result_count || 0);
          }
        } else if (type === 'videos') {
          const pixabayData = data as PixabayResponse<PixabayVideoItem>;
          const relatedPromises = (pixabayData.hits || []).map(
            (relatedItem: PixabayVideoItem) =>
              new Promise<MediaResult>((resolve) => {
                const videoURL = relatedItem.videos?.medium?.url || relatedItem.videos?.small?.url || '';
                const itemData: MediaResult = {
                  id: relatedItem.id.toString(),
                  title: relatedItem.tags || 'Untitled',
                  url: relatedItem.pageURL || '',
                  thumbnail: relatedItem.videos?.tiny?.thumbnail ||'/placeholder-video.png',
                  videoURL,
                  creator: relatedItem.user || 'Unknown',
                  license: 'Pixabay License',
                  source: 'pixabay' as const,
                  tags: relatedItem.tags?.split(',').map((tag) => tag.trim()) || [],
                  size: undefined,
                };
                if (relatedItem.videos?.medium?.size) {
                  itemData.size = relatedItem.videos.medium.size;
                  resolve(itemData);
                } else if (relatedItem.videos?.small?.size) {
                  itemData.size = relatedItem.videos.small.size;
                  resolve(itemData);
                } else {
                  fetchSize(videoURL)
                    .then((size) => {
                      itemData.size = size;
                      resolve(itemData);
                    })
                    .catch((err) => {
                      console.warn(`Failed to fetch size for related video ${relatedItem.id}:`, err);
                      itemData.size = undefined;
                      resolve(itemData);
                    });
                }
              })
          );
          related = await Promise.all(relatedPromises);
          if (!append) {
            setRelatedTotal(pixabayData.totalHits || 0);
          }
        } else {
          const pixabayData = data as PixabayResponse<PixabayImageItem>;
          const relatedPromises = (pixabayData.hits || []).map(
            (relatedItem: PixabayImageItem) =>
              new Promise<MediaResult>((resolve) => {
                const itemData: MediaResult = {
                  id: relatedItem.id.toString(),
                  title: relatedItem.tags || 'Untitled',
                  url: relatedItem.pageURL || '',
                  thumbnail: relatedItem.webformatURL || '',
                  creator: relatedItem.user || 'Unknown',
                  license: 'Pixabay License',
                  source: 'pixabay' as const,
                  tags: relatedItem.tags?.split(',').map((tag) => tag.trim()) || [],
                  largeImageURL: relatedItem.largeImageURL,
                  previewURL: relatedItem.previewURL,
                  size: undefined,
                };
                fetchSize(relatedItem.webformatURL || '')
                  .then((size) => {
                    itemData.size = size;
                    resolve(itemData);
                  })
                  .catch((err) => {
                    console.warn(`Failed to fetch size for related image ${relatedItem.id}:`, err);
                    itemData.size = undefined;
                    resolve(itemData);
                  });
              })
          );
          related = await Promise.all(relatedPromises);
          if (!append) {
            setRelatedTotal(pixabayData.totalHits || 0);
          }
        }

        const filteredRelated = related.filter((relatedItem) => relatedItem.id !== item.id);
        if (append) {
          setRelatedItems((prev) => [...prev, ...filteredRelated]);
        } else {
          setRelatedItems(filteredRelated);
        }
      } catch (err) {
        console.error('Error fetching related items:', err);
        setRelatedItems([]);
        setRelatedTotal(null);
      } finally {
        setRelatedLoading(false);
      }
    },
    [activeTab, licenseFilter]
  );

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
      alert('Failed to download the file. Please try viewing the file instead.');
    }
  };

  const getDisplayTitle = (item: MediaResult) => {
    if (item.source === 'pixabay' && item.tags && item.tags.length > 0) {
      return item.tags[0];
    }
    return item.title.length > 50 ? `${item.title.substring(0, 47)}...` : item.title;
  };

  const fetchMedia = useCallback(
    async (
      type: 'images' | 'audio' | 'videos',
      page: number,
      append: boolean = false
    ): Promise<FetchResult> => {
      try {
        // Construct the search query
        let searchQuery = query.trim();
        if (exactPhrase.trim()) {
          searchQuery = `"${exactPhrase.trim()}" ${searchQuery}`.trim();
        }
        console.log(`Fetching ${type} with query: ${searchQuery}, page: ${page}, license: ${licenseFilter}, sort: ${sortBy}`);

        if (type === 'images') {
          const openverseUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
            searchQuery
          )}&page=${page}&page_size=${perPage}${licenseFilter !== 'all' ? `&license=${licenseFilter}` : ''}`;
          const openverseHeaders = process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN
            ? new Headers({
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}`,
              })
            : undefined;
          const openverseRes = await fetch(
            openverseUrl,
            openverseHeaders ? { headers: openverseHeaders } : undefined
          );
          if (!openverseRes.ok) {
            const errorText = await openverseRes.text();
            console.error('Openverse fetch failed:', openverseRes.status, errorText);
            throw new Error(`Failed to fetch images from Openverse: ${errorText}`);
          }
          const openverseData: OpenverseResponse = await openverseRes.json();
          const openverseImages = (openverseData.results || []).map(async (item: OpenverseItem) => {
            let size: number | undefined;
            try {
              size = item.url ? await fetchSize(item.url) : undefined;
            } catch (err) {
              console.warn(`Failed to fetch size for Openverse image ${item.id}:`, err);
              size = undefined;
            }
            const result = {
              id: item.id.toString(),
              title: item.title || 'Untitled',
              url: item.url || '',
              thumbnail: item.thumbnail || item.url || '',
              creator: item.creator || 'Unknown',
              license: item.license || 'Unknown',
              source: 'openverse' as const,
              tags: item.tags?.map((tag) => tag.name) || [],
              size,
            };
            return result;
          });

          const pixabayApiKey = process.env.NEXT_PUBLIC_PIXABAY_API_KEY;
          if (!pixabayApiKey) {
            console.error('Pixabay API key is not set');
            throw new Error('Pixabay API key is not set');
          }
          const pixabayUrl = `https://pixabay.com/api/?key=${pixabayApiKey}&q=${encodeURIComponent(
            searchQuery
          )}&image_type=photo&page=${page}&per_page=${perPage}${sortBy === 'size' ? '&order=popular' : ''}`;
          const pixabayRes = await fetch(pixabayUrl);
          if (!pixabayRes.ok) {
            const errorText = await pixabayRes.text();
            console.error('Pixabay fetch failed:', pixabayRes.status, errorText);
            throw new Error(`Failed to fetch images from Pixabay: ${errorText}`);
          }
          const pixabayData: PixabayResponse<PixabayImageItem> = await pixabayRes.json();
          const pixabayImages = (pixabayData.hits || []).map(async (item: PixabayImageItem) => {
            let size: number | undefined;
            try {
              size = item.webformatURL ? await fetchSize(item.webformatURL) : undefined;
            } catch (err) {
              console.warn(`Failed to fetch size for Pixabay image ${item.id}:`, err);
              size = undefined;
            }
            const result = {
              id: item.id.toString(),
              title: item.tags || 'Untitled',
              url: item.pageURL || '',
              thumbnail: item.webformatURL || '',
              creator: item.user || 'Unknown',
              license: 'Pixabay License',
              source: 'pixabay' as const,
              tags: item.tags?.split(',').map((tag) => tag.trim()) || [],
              largeImageURL: item.largeImageURL,
              previewURL: item.previewURL,
              size,
            };
            return result;
          });

          const resolvedOpenverseImages = await Promise.all(openverseImages);
          const resolvedPixabayImages = await Promise.all(pixabayImages);
          let allImages = [...resolvedOpenverseImages, ...resolvedPixabayImages];

          // Apply excludeWords filter
          if (excludeWords.trim()) {
            const excludeTerms = excludeWords.toLowerCase().split(/\s+/).filter(term => term);
            console.log('Applying excludeWords filter:', excludeTerms);
            allImages = allImages.filter((item) => {
              const textToSearch = `${item.title.toLowerCase()} ${(item.tags || []).join(' ').toLowerCase()}`;
              const shouldInclude = !excludeTerms.some((term) => textToSearch.includes(term));
              console.log(`Item "${item.title}" include: ${shouldInclude}, text: ${textToSearch}`);
              return shouldInclude;
            });
          }

          // Apply license filter for Pixabay results
          if (licenseFilter === 'pixabay') {
            allImages = allImages.filter(item => item.source === 'pixabay');
          } else if (licenseFilter !== 'all') {
            allImages = allImages.filter(item => 
              item.source === 'openverse' || item.license === 'Pixabay License'
            );
          }

          // Sort results
          if (sortBy === 'size') {
            console.log('Sorting by size (descending)');
            allImages.sort((a, b) => (b.size || 0) - (a.size || 0));
          } else if (sortBy === 'title-asc') {
            console.log('Sorting by title (A-Z)');
            allImages.sort((a, b) => a.title.localeCompare(b.title));
          } else if (sortBy === 'title-desc') {
            console.log('Sorting by title (Z-A)');
            allImages.sort((a, b) => b.title.localeCompare(a.title));
          } else if (sortBy === 'source-asc') {
            console.log('Sorting by source (openverse to pixabay)');
            allImages.sort((a, b) => a.source.localeCompare(b.source));
          } else if (sortBy === 'source-desc') {
            console.log('Sorting by source (pixabay to openverse)');
            allImages.sort((a, b) => b.source.localeCompare(a.source));
          }

          // Deduplicate images
          const deduplicatedImagesMap = new Map<string, MediaResult>();
          allImages.forEach((item) => {
            const key = `${item.source}-${item.id}`;
            if (!deduplicatedImagesMap.has(key)) {
              deduplicatedImagesMap.set(key, item);
              seenImageIdsRef.current.add(key);
            }
          });
          const combinedImages = Array.from(deduplicatedImagesMap.values());
          console.log(`Fetched ${combinedImages.length} images after deduplication`);

          return {
            items: combinedImages,
            total: Math.max(
              openverseData.result_count || combinedImages.length,
              pixabayData.totalHits || 0
            ),
          };
        } else if (type === 'audio') {
          const openverseUrl = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(
            searchQuery
          )}&page=${page}&page_size=${perPage}${licenseFilter !== 'all' ? `&license=${licenseFilter}` : ''}`;
          const openverseHeaders = process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN
            ? new Headers({
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}`,
              })
            : undefined;
          const openverseRes = await fetch(
            openverseUrl,
            openverseHeaders ? { headers: openverseHeaders } : undefined
          );
          if (!openverseRes.ok) {
            const errorText = await openverseRes.text();
            console.error('Openverse audio fetch failed:', openverseRes.status, errorText);
            throw new Error(`Failed to fetch audio from Openverse: ${errorText}`);
          }
          const openverseData: OpenverseResponse = await openverseRes.json();
          const allAudios = (openverseData.results || []).map(async (item: OpenverseItem) => {
            let size: number | undefined;
            try {
              size = item.url ? await fetchSize(item.url) : undefined;
            } catch (err) {
              console.warn(`Failed to fetch size for Openverse audio ${item.id}:`, err);
              size = undefined;
            }
            const result = {
              id: item.id.toString(),
              title: item.title || 'Untitled',
              url: item.url || '',
              thumbnail: item.thumbnail || '/placeholder-audio.png',
              creator: item.creator || 'Unknown',
              license: item.license || 'Unknown',
              source: 'openverse' as const,
              tags: item.tags?.map((tag) => tag.name) || [],
              size,
            };
            return result;
          });

          let resolvedAudios = await Promise.all(allAudios);

          // Apply excludeWords filter
          if (excludeWords.trim()) {
            const excludeTerms = excludeWords.toLowerCase().split(/\s+/).filter(term => term);
            console.log('Applying excludeWords filter for audio:', excludeTerms);
            resolvedAudios = resolvedAudios.filter((item) => {
              const textToSearch = `${item.title.toLowerCase()} ${(item.tags || []).join(' ').toLowerCase()}`;
              const shouldInclude = !excludeTerms.some((term) => textToSearch.includes(term));
              console.log(`Audio "${item.title}" include: ${shouldInclude}, text: ${textToSearch}`);
              return shouldInclude;
            });
          }

          // Sort results
          if (sortBy === 'size') {
            console.log('Sorting audio by size (descending)');
            resolvedAudios.sort((a, b) => (b.size || 0) - (a.size || 0));
          } else if (sortBy === 'title-asc') {
            console.log('Sorting audio by title (A-Z)');
            resolvedAudios.sort((a, b) => a.title.localeCompare(b.title));
          } else if (sortBy === 'title-desc') {
            console.log('Sorting audio by title (Z-A)');
            resolvedAudios.sort((a, b) => b.title.localeCompare(a.title));
          } else if (sortBy === 'source-asc' || sortBy === 'source-desc') {
            console.log('Sorting by source not applicable for audio (only openverse)');
            // No sorting needed as all audio is from openverse
          }

          // Deduplicate audios
          const deduplicatedAudiosMap = new Map<string, MediaResult>();
          resolvedAudios.forEach((item) => {
            const key = `${item.source}-${item.id}`;
            if (!deduplicatedAudiosMap.has(key)) {
              deduplicatedAudiosMap.set(key, item);
              seenAudioIdsRef.current.add(key);
            }
          });
          const audios = Array.from(deduplicatedAudiosMap.values());
          console.log(`Fetched ${audios.length} audios after deduplication`);

          return {
            items: audios,
            total: openverseData.result_count || audios.length,
          };
        } else {
          const pixabayApiKey = process.env.NEXT_PUBLIC_PIXABAY_API_KEY;
          if (!pixabayApiKey) {
            console.error('Pixabay API key is not set');
            throw new Error('Pixabay API key is not set');
          }
          const pixabayUrl = `https://pixabay.com/api/videos/?key=${pixabayApiKey}&q=${encodeURIComponent(
            searchQuery
          )}&page=${page}&per_page=${perPage}${sortBy === 'size' ? '&order=popular' : ''}`;
          const pixabayRes = await fetch(pixabayUrl);
          if (!pixabayRes.ok) {
            const errorText = await pixabayRes.text();
            console.error('Pixabay video fetch failed:', pixabayRes.status, errorText);
            throw new Error(`Failed to fetch videos from Pixabay: ${errorText}`);
          }
          const pixabayData: PixabayResponse<PixabayVideoItem> = await pixabayRes.json();
          const allVideos = (pixabayData.hits || []).map(async (item: PixabayVideoItem) => {
            const videoURL = item.videos?.medium?.url || item.videos?.small?.url || '';
            let size: number | undefined;
            if (item.videos?.medium?.size) {
              size = item.videos.medium.size;
            } else if (item.videos?.small?.size) {
              size = item.videos.small.size;
            } else {
              try {
                size = videoURL ? await fetchSize(videoURL) : undefined;
              } catch (err) {
                console.warn(`Failed to fetch size for Pixabay video ${item.id}:`, err);
                size = undefined;
              }
            }
            const result = {
              id: item.id.toString(),
              title: item.tags || 'Untitled',
              url: item.pageURL || '',
              thumbnail: item.videos?.tiny?.thumbnail || '/placeholder-video.png',
              videoURL,
              creator: item.user || 'Unknown',
              license: 'Pixabay License',
              source: 'pixabay' as const,
              tags: item.tags?.split(',').map((tag) => tag.trim()) || [],
              size,
            };
            return result;
          });

          let resolvedVideos = await Promise.all(allVideos);

          // Apply excludeWords filter
          if (excludeWords.trim()) {
            const excludeTerms = excludeWords.toLowerCase().split(/\s+/).filter(term => term);
            console.log('Applying excludeWords filter for videos:', excludeTerms);
            resolvedVideos = resolvedVideos.filter((item) => {
              const textToSearch = `${item.title.toLowerCase()} ${(item.tags || []).join(' ').toLowerCase()}`;
              const shouldInclude = !excludeTerms.some((term) => textToSearch.includes(term));
              console.log(`Video "${item.title}" include: ${shouldInclude}, text: ${textToSearch}`);
              return shouldInclude;
            });
          }

          // Sort results
          if (sortBy === 'size') {
            console.log('Sorting videos by size (descending)');
            resolvedVideos.sort((a, b) => (b.size || 0) - (a.size || 0));
          } else if (sortBy === 'title-asc') {
            console.log('Sorting videos by title (A-Z)');
            resolvedVideos.sort((a, b) => a.title.localeCompare(b.title));
          } else if (sortBy === 'title-desc') {
            console.log('Sorting videos by title (Z-A)');
            resolvedVideos.sort((a, b) => b.title.localeCompare(a.title));
          } else if (sortBy === 'source-asc' || sortBy === 'source-desc') {
            console.log('Sorting by source not applicable for videos (only pixabay)');
            // No sorting needed as all videos are from pixabay
          }

          // Deduplicate videos
          const deduplicatedVideosMap = new Map<string, MediaResult>();
          resolvedVideos.forEach((item) => {
            const key = `${item.source}-${item.id}`;
            if (!deduplicatedVideosMap.has(key)) {
              deduplicatedVideosMap.set(key, item);
              seenVideoIdsRef.current.add(key);
            }
          });
          const videos = Array.from(deduplicatedVideosMap.values());
          console.log(`Fetched ${videos.length} videos after deduplication`);

          return {
            items: videos,
            total: pixabayData.totalHits || videos.length,
          };
        }
      } catch (err) {
        console.error('Error in fetchMedia:', err);
        throw err;
      }
    },
    [query, exactPhrase, excludeWords, licenseFilter, sortBy]
  );

  // Sync advanced search parameters from URL
  useEffect(() => {
    const exact = searchParams.get('exact') || '';
    const exclude = searchParams.get('exclude') || '';
    const license = searchParams.get('license') || 'all';
    const sort = (searchParams.get('sort') as 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc') || 'relevance';

    console.log('Syncing URL parameters:', { exact, exclude, license, sort });

    setExactPhrase(exact);
    setExcludeWords(exclude);
    setLicenseFilter(license);
    setSortBy(sort);
  }, [searchParams]);

  // Handle initial fetch and query changes
  useEffect(() => {
    if (!query) return;

    console.log('Query changed:', query, 'Last query:', lastQuery);
    if (lastQuery !== query) {
      console.log('Resetting state due to query change');
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

    if (session?.user?.id) {
      console.log(`User ${session.user.id} searched for: ${query}`);
    }

    const fetchInitial = async () => {
      if (
        (activeTab === 'images' && hasFetchedImages) ||
        (activeTab === 'audio' && hasFetchedAudio) ||
        (activeTab === 'videos' && hasFetchedVideos)
      ) {
        console.log(`Skipping initial fetch for ${activeTab} tab; data already fetched.`);
        return;
      }

      setLoading(true);
      try {
        const { items, total } = await fetchMedia(activeTab, 1);
        console.log(`Initial fetch for ${activeTab}: ${items.length} items, total: ${total}`);
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
        setError(
          err instanceof Error ? err.message : 'Failed to fetch media. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, [query, activeTab, session, fetchMedia, hasFetchedImages, hasFetchedAudio, hasFetchedVideos, lastQuery]);

  // Handle tab changes
  useEffect(() => {
    if (!query) return;

    const fetchTabData = async () => {
      if (activeTab === 'images' && !hasFetchedImages) {
        setLoading(true);
        try {
          const { items, total } = await fetchMedia('images', 1);
          console.log('Tab change fetched images:', items.length);
          setImageResults(items);
          setImageTotal(total);
          setHasFetchedImages(true);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch images. Please try again.'
          );
        } finally {
          setLoading(false);
        }
      } else if (activeTab === 'audio' && !hasFetchedAudio) {
        setLoading(true);
        try {
          const { items, total } = await fetchMedia('audio', 1);
          console.log('Tab change fetched audios:', items.length);
          setAudioResults(items);
          setAudioTotal(total);
          setHasFetchedAudio(true);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch audio. Please try again.'
          );
        } finally {
          setLoading(false);
        }
      } else if (activeTab === 'videos' && !hasFetchedVideos) {
        setLoading(true);
        try {
          const { items, total } = await fetchMedia('videos', 1);
          console.log('Tab change fetched videos:', items.length);
          setVideoResults(items);
          setVideoTotal(total);
          setHasFetchedVideos(true);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch videos. Please try again.'
          );
        } finally {
          setLoading(false);
        }
      } else {
        console.log(`Skipping fetch for ${activeTab} tab; data already fetched.`);
      }
    };

    fetchTabData();
  }, [activeTab, query, fetchMedia, hasFetchedImages, hasFetchedAudio, hasFetchedVideos]);

  const handleLoadMore = async (type: 'images' | 'audio' | 'videos') => {
    setLoading(true);
    try {
      if (type === 'images') {
        const nextPage = imagePage + 1;
        const { items } = await fetchMedia('images', nextPage, true);
        console.log('Load more images:', items.length);
        setImageResults((prev) => [...prev, ...items]);
        setImagePage(nextPage);
      } else if (type === 'audio') {
        const nextPage = audioPage + 1;
        const { items } = await fetchMedia('audio', nextPage, true);
        console.log('Load more audios:', items.length);
        setAudioResults((prev) => [...prev, ...items]);
        setAudioPage(nextPage);
      } else {
        const nextPage = videoPage + 1;
        const { items } = await fetchMedia('videos', nextPage, true);
        console.log('Load more videos:', items.length);
        setVideoResults((prev) => [...prev, ...items]);
        setVideoPage(nextPage);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch more media. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderResults = (results: MediaResult[], type: 'images' | 'audio' | 'videos') => {
    const total =
      type === 'images' ? imageTotal : type === 'audio' ? audioTotal : videoTotal;
    const hasMore = total !== null && results.length < total;

    const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());

    const handleMediaError = (key: string) => {
      setFailedMedia((prev) => {
        const newSet = new Set(prev);
        newSet.add(key);
        return newSet;
      });
    };

    if (loading && results.length === 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm p-4 animate-pulse"
            >
              <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg
            className="w-12 h-12 text-red-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
            ></path>
          </svg>
          <p className="text-red-500 text-lg font-medium">{error}</p>
        </div>
      );
    }
    if (results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <svg
            className="w-12 h-12 text-gray-400 mb-4"
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
            ></path>
          </svg>
          <p className="text-gray-500 text-lg font-medium">No results found.</p>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {results.map((item, index) => {
            const key = `${item.source}-${item.id}-${index}`;
            const mediaFailed = failedMedia.has(key);

            return (
              <div
                key={key}
                className="bg-white rounded-xl shadow-sm overflow-hidden transition-transform transform hover:scale-105 hover:shadow-md cursor-pointer"
                onClick={() =>
                  openModal(
                    item,
                    type === 'audio' ? 'audio' : type === 'videos' ? 'video' : 'image'
                  )
                }
              >
                {type === 'videos' ? (
                  !mediaFailed ? (
                    <div className="relative w-full h-48">
                      <video
                        src={item.videoURL}
                        poster={item.thumbnail}
                        onError={() => handleMediaError(key)}
                        className="w-full h-full object-cover rounded-t-xl"
                        muted
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-white opacity-70 hover:opacity-100 transition-opacity"
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
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-t-xl">
                      <span className="text-gray-500">No Preview</span>
                    </div>
                  )
                ) : item.thumbnail && !mediaFailed ? (
                  <div className="relative w-full h-48">
                    <img
                      src={item.thumbnail}
                      onError={() => handleMediaError(key)}
                      alt={item.title}
                      className="w-full h-full object-cover rounded-t-xl"
                      style={{ display: mediaFailed ? 'none' : 'block' }}
                    />
                    {!mediaFailed && (
                      <div className="absolute inset-0 bg-opacity-0 hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity"
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
                    )}
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-t-xl">
                    <span className="text-gray-500">No Preview</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 truncate">{item.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    By: {item.creator || 'Unknown'} (Source: {item.source})
                  </p>
                  <p className="text-xs text-gray-500 mt-1">License: {item.license}</p>
                  <p className="text-xs text-gray-500 mt-1">Size: {formatSize(item.size)}</p>
                </div>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div className="text-center mt-8">
            <button
              onClick={() => handleLoadMore(type)}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center mx-auto"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-2 text-white"
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

  const CustomAudioPlayer = ({ src, thumbnail }: { src: string; thumbnail: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlayPause = () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (audioRef.current) {
        const newTime = parseFloat(e.target.value);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg shadow-md">
        <img
          src={thumbnail}
          alt="Audio thumbnail"
          className="w-16 h-16 object-cover rounded-lg"
          onError={(e) => (e.currentTarget.src = '/placeholder-audio.png')}
        />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayPause}
              className="p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7V5z" />
                </svg>
              )}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4f46e5 ${(currentTime / duration) * 100}%, #e0e7ff ${(currentTime / duration) * 100}%)`,
                }}
              />
            </div>
            <span className="text-sm text-gray-600">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    );
  };

  const CustomVideoPlayer = ({ src, thumbnail }: { src: string; thumbnail: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlayPause = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (videoRef.current) {
        const newTime = parseFloat(e.target.value);
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
      <div className="space-y-4">
        <video
          ref={videoRef}
          src={src}
          poster={thumbnail}
          className="w-full h-auto max-h-[70vh] rounded-lg"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => (e.currentTarget.poster = '/placeholder-video.png')}
        />
        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg shadow-md">
          <button
            onClick={togglePlayPause}
            className="p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7V5z" />
              </svg>
            )}
          </button>
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #4f46e5 ${(currentTime / duration) * 100}%, #e0e7ff ${(currentTime / duration) * 100}%)`,
              }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    );
  };

  const Modal = () => {
    if (!selectedItem || !modalType) return null;

    const hasMoreRelated = relatedTotal !== null && relatedItems.length < relatedTotal;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto relative">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>

          <div className="p-6 flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/3 w-full">
              {modalType === 'image' && (
                <img
                  src={selectedItem.thumbnail || selectedItem.url}
                  alt={selectedItem.title}
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                />
              )}
              {modalType === 'audio' && (
                <div className="space-y-4">
                  <CustomAudioPlayer src={selectedItem.url} thumbnail={selectedItem.thumbnail} />
                </div>
              )}
              {modalType === 'video' && selectedItem.videoURL && (
                <CustomVideoPlayer src={selectedItem.videoURL} thumbnail={selectedItem.thumbnail} />
              )}
            </div>

            <div className="lg:w-1/3 w-full space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">{getDisplayTitle(selectedItem)}</h2>
              <div className="space-y-2 text-gray-600">
                <p>Creator: {selectedItem.creator || 'Unknown'}</p>
                <p>License: {selectedItem.license}</p>
                <p>Source: {selectedItem.source}</p>
                <p>Size: {formatSize(selectedItem.size)}</p>
              </div>

              {selectedItem.tags && selectedItem.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.tags.map((tag, index) => (
                      <button
                        key={index}
                        onClick={() => handleTagClick(tag)}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm hover:bg-indigo-200 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {modalType === 'image' ? (
                  <>
                    {selectedItem.source === 'pixabay' ? (
                      <div className="flex gap-2">
                        {selectedItem.largeImageURL && (
                          <button
                            onClick={() => handleDownload(selectedItem.largeImageURL!, `${selectedItem.title}-large.jpg`)}
                            className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                          >
                            Large
                          </button>
                        )}
                        {selectedItem.thumbnail && (
                          <button
                            onClick={() => handleDownload(selectedItem.thumbnail, `${selectedItem.title}-medium.jpg`)}
                            className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                          >
                            Medium
                          </button>
                        )}
                        {selectedItem.previewURL && (
                          <button
                            onClick={() => handleDownload(selectedItem.previewURL!, `${selectedItem.title}-small.jpg`)}
                            className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                          >
                            Small
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(selectedItem.url, `${selectedItem.title}.jpg`)}
                        className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                      >
                        Download
                      </button>
                    )}
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                    >
                      View Image
                    </a>
                  </>
                ) : modalType === 'audio' ? (
                  <>
                    <button
                      onClick={() => handleDownload(selectedItem.url, `${selectedItem.title}.mp3`)}
                      className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                    >
                      Download
                    </button>
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                    >
                      View Audio
                    </a>
                  </>
                ) : (
                  <>
                    {selectedItem.videoURL && (
                      <button
                        onClick={() => handleDownload(selectedItem.videoURL!, `${selectedItem.title}.mp4`)}
                        className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                      >
                        Download
                      </button>
                    )}
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                    >
                      View Video
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          {relatedItems.length > 0 && (
            <div className="p-6 border-t">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Related{' '}
                {modalType === 'image' ? 'Images' : modalType === 'audio' ? 'Audio' : 'Videos'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {relatedItems.map((relatedItem, index) => (
                  <div
                    key={index}
                    className="cursor-pointer"
                    onClick={() => handleRelatedItemClick(relatedItem)}
                  >
                    {modalType === 'video' ? (
                      <video
                        src={relatedItem.videoURL}
                        poster={relatedItem.thumbnail}
                        className="w-full h-32 object-cover rounded-lg"
                        onError={(e) => (e.currentTarget.poster = '/placeholder-video.png')}
                        muted
                      />
                    ) : (
                      <img
                        src={relatedItem.thumbnail || relatedItem.url}
                        alt={relatedItem.title}
                        className="w-full h-32 object-cover rounded-lg"
                        onError={(e) =>
                          (e.currentTarget.src =
                            modalType === 'audio'
                              ? '/placeholder-audio.png'
                              : '/placeholder-image.png')
                        }
                      />
                    )}
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {getDisplayTitle(relatedItem)}
                    </p>
                  </div>
                ))}
              </div>
              {hasMoreRelated && (
                <div className="text-center mt-6">
                  <button
                    onClick={handleLoadMoreRelated}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center mx-auto"
                    disabled={relatedLoading}
                  >
                    {relatedLoading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 mr-2 text-white"
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
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 font-sans">
      <div className="sticky top-0 z-10 bg-white shadow-md p-6">
        <form onSubmit={handleSearch} className="flex items-center max-w-3xl mx-auto relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <svg
              className="w-5 h-5 text-gray-400"
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
              ></path>
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search for images, audio, or videos..."
            className="flex-grow pl-12 pr-4 py-3 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md"
          />
          <button
            type="submit"
            className="ml-3 px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:from-indigo-600 hover:to-blue-600 focus:ring-2 focus:ring-indigo-400 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className="ml-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            Advanced
          </button>
        </form>

        {showAdvancedSearch && (
          <div className="mt-4 max-w-3xl mx-auto bg-gray-50 p-4 rounded-lg shadow-inner">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Exact Phrase</label>
                <input
                  type="text"
                  value={exactPhrase}
                  onChange={(e) => setExactPhrase(e.target.value)}
                  placeholder='e.g., "mountain sunset"'
                  className="mt-1 w-full px-4 py-2 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Exclude Words</label>
                <input
                  type="text"
                  value={excludeWords}
                  onChange={(e) => setExcludeWords(e.target.value)}
                  placeholder="e.g., forest river"
                  className="mt-1 w-full px-4 py-2 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">License Filter</label>
                <select
                  value={licenseFilter}
                  onChange={(e) => setLicenseFilter(e.target.value)}
                  className="mt-1 w-full px-4 py-2 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-indigo-400 text-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  <option value="all">All Licenses</option>
                  <option value="cc0">CC0 (Public Domain)</option>
                  <option value="by">CC BY</option>
                  <option value="by-sa">CC BY-SA</option>
                  <option value="by-nc-nd">CC BY-NC-ND</option>
                  <option value="by-nc">CC BY-NC</option>
                  <option value="by-nd">CC BY-ND</option>
                  <option value="pixabay">Pixabay License</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc')}
                  className="mt-1 w-full px-4 py-2 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-indigo-400 text-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
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

        {(exactPhrase || excludeWords || licenseFilter !== 'all' || sortBy !== 'relevance') && (
          <div className="mt-4 max-w-3xl mx-auto text-sm text-gray-600">
            <p>Applied Filters:</p>
            <ul className="list-disc list-inside">
              {exactPhrase && <li>Exact Phrase: "{exactPhrase}"</li>}
              {excludeWords && <li>Exclude Words: {excludeWords}</li>}
              {licenseFilter !== 'all' && <li>License: {licenseFilter === 'pixabay' ? 'Pixabay License' : licenseFilter.toUpperCase()}</li>}
              {sortBy !== 'relevance' && (
                <li>
                  Sort By: {
                    sortBy === 'size' ? 'Size (Largest First)' :
                    sortBy === 'title-asc' ? 'Title (A-Z)' :
                    sortBy === 'title-desc' ? 'Title (Z-A)' :
                    sortBy === 'source-asc' ? 'Source (Openverse to Pixabay)' :
                    'Source (Pixabay to Openverse)'
                  }
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Search Results for "<span className="text-indigo-600">{query}</span>"
          </h1>
          <Link
            href="/"
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all duration-300 shadow-sm hover:shadow-md"
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

        <div className="flex space-x-4 mb-8 relative">
          {(['images', 'audio', 'videos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2 text-lg font-medium transition-colors duration-300 ${
                activeTab === tab ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-500'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full transition-all duration-300"></span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'images' && renderResults(imageResults, 'images')}
        {activeTab === 'audio' && renderResults(audioResults, 'audio')}
        {activeTab === 'videos' && renderResults(videoResults, 'videos')}

        <Modal />
      </div>
    </div>
  );
}