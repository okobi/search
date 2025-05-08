import React from 'react';

export type MediaResult = {
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
};

export type FetchResult = {
  items: MediaResult[];
  total: number;
};

export async function fetchMedia(
  type: 'images' | 'audio' | 'videos',
  page: number,
  query: string,
  exactPhrase: string,
  excludeWords: string,
  licenseFilter: string,
  sortBy: 'relevance' | 'size' | 'title-asc' | 'title-desc' | 'source-asc' | 'source-desc',
  sourceFilter: 'all' | 'openverse' | 'pixabay',
  seenImageIdsRef: React.MutableRefObject<Set<string>>,
  seenAudioIdsRef: React.MutableRefObject<Set<string>>,
  seenVideoIdsRef: React.MutableRefObject<Set<string>>,
  append: boolean = false
): Promise<FetchResult> {
  try {
    let searchQuery = query.trim();
    if (!searchQuery) {
      return { items: [], total: 0 };
    }
    if (exactPhrase.trim()) searchQuery = `"${exactPhrase.trim()}" ${searchQuery}`.trim();

    let allItems: MediaResult[] = [];
    let total = 0;

    if (type === 'images') {
      if (sourceFilter === 'all' || sourceFilter === 'openverse') {
        const openverseUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(searchQuery)}&page=${page}&page_size=20`;
        const openverseHeaders = new Headers();
        if (process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN) {
          openverseHeaders.append('Authorization', `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}`);
        }
        console.log('Openverse headers:', Object.fromEntries(openverseHeaders.entries()));

        let openverseRes;
        try {
          openverseRes = await fetch(openverseUrl, { headers: openverseHeaders });
          if (!openverseRes.ok) {
            const errorText = await openverseRes.text();
            throw new Error(`Failed to fetch images from Openverse: ${errorText}`);
          }
          const openverseData = await openverseRes.json();
          const openverseImages = (openverseData.results || []).map((item: any) => ({
            id: item.id.toString(),
            title: item.title || 'Untitled',
            url: item.url || '',
            thumbnail: item.thumbnail || item.url || '',
            creator: item.creator || 'Unknown',
            license: item.license || 'Unknown',
            source: 'openverse' as const,
            tags: item.tags?.map((tag: any) => tag.name) || [],
            size: undefined,
          }));
          allItems = [...allItems, ...openverseImages];
          total = Math.max(total, openverseData.result_count || openverseImages.length);
        } catch (err) {
          console.error('Openverse image fetch error:', err);
          if (sourceFilter === 'openverse') throw err;
        }
      }

      if (sourceFilter === 'all' || sourceFilter === 'pixabay') {
        const pixabayApiKey = process.env.NEXT_PUBLIC_PIXABAY_API_KEY;
        console.log('Checking Pixabay API key for images, value:', pixabayApiKey, 'source:', sourceFilter);
        if (pixabayApiKey === undefined || pixabayApiKey === '') {
          console.error('Pixabay API key is not set');
          if (sourceFilter === 'pixabay') throw new Error('Pixabay API key is not set');
        } else {
          const pixabayUrl = `https://pixabay.com/api/?key=${pixabayApiKey}&q=${encodeURIComponent(searchQuery)}&image_type=photo&page=${page}&per_page=20${sortBy === 'size' ? '&order=popular' : ''}`;
          console.log('Pixabay API key:', pixabayApiKey);
          console.log('Pixabay URL:', pixabayUrl);
          let pixabayRes;
          try {
            pixabayRes = await fetch(pixabayUrl);
            if (!pixabayRes.ok) {
              const errorText = await pixabayRes.text();
              throw new Error(`Failed to fetch images from Pixabay: ${errorText}`);
            }
            const pixabayData = await pixabayRes.json();
            const pixabayImages = (pixabayData.hits || []).map((item: any) => ({
              id: item.id.toString(),
              title: item.tags || 'Untitled',
              url: item.pageURL || '',
              thumbnail: item.webformatURL || '',
              creator: item.user || 'Unknown',
              license: 'Pixabay License',
              source: 'pixabay' as const,
              tags: item.tags?.split(',').map((tag: string) => tag.trim()) || [],
              largeImageURL: item.largeImageURL,
              previewURL: item.previewURL,
              size: undefined,
            }));
            allItems = [...allItems, ...pixabayImages];
            total = Math.max(total, pixabayData.totalHits || pixabayImages.length);
          } catch (err) {
            console.error('Pixabay image fetch error:', err);
            if (sourceFilter === 'pixabay') throw err;
          }
        }
      }

      if (excludeWords.trim()) {
        const excludeTerms = excludeWords.toLowerCase().split(/\s+/).filter((term) => term);
        allItems = allItems.filter((item: MediaResult) => !excludeTerms.some((term) => `${item.title.toLowerCase()} ${(item.tags || []).join(' ').toLowerCase()}`.includes(term)));
      }
      if (licenseFilter !== 'all' && sourceFilter === 'openverse') {
        allItems = allItems.filter((item: MediaResult) => item.source === 'openverse' && item.license === licenseFilter);
      }
      if (sortBy === 'size') allItems.sort((a: MediaResult, b: MediaResult) => (b.size || 0) - (a.size || 0));
      else if (sortBy === 'title-asc') allItems.sort((a: MediaResult, b: MediaResult) => a.title.localeCompare(b.title));
      else if (sortBy === 'title-desc') allItems.sort((a: MediaResult, b: MediaResult) => b.title.localeCompare(a.title));
      else if (sortBy === 'source-asc') allItems.sort((a: MediaResult, b: MediaResult) => a.source.localeCompare(a.source));
      else if (sortBy === 'source-desc') allItems.sort((a: MediaResult, b: MediaResult) => b.source.localeCompare(a.source));

      const deduplicatedImagesMap = new Map();
      allItems.forEach((item: MediaResult) => {
        const key = `${item.source}-${item.id}`;
        if (!deduplicatedImagesMap.has(key)) {
          deduplicatedImagesMap.set(key, item);
          seenImageIdsRef.current.add(key);
        }
      });
      const combinedImages = Array.from(deduplicatedImagesMap.values());
      return { items: combinedImages, total };
    } else if (type === 'audio') {
      if (sourceFilter === 'pixabay') {
        return { items: [], total: 0 };
      }

      const openverseUrl = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(searchQuery)}&page=${page}&page_size=20`;
      const openverseHeaders = new Headers();
      if (process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN) {
        openverseHeaders.append('Authorization', `Bearer ${process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN}`);
      }
      console.log('Openverse headers:', Object.fromEntries(openverseHeaders.entries()));

      let openverseRes;
      try {
        openverseRes = await fetch(openverseUrl, { headers: openverseHeaders });
        if (!openverseRes.ok) {
          const errorText = await openverseRes.text();
          throw new Error(`Failed to fetch audio from Openverse: ${errorText}`);
        }
        const openverseData = await openverseRes.json();
        let allAudios = (openverseData.results || []).map((item: any) => ({
          id: item.id.toString(),
          title: item.title || 'Untitled',
          url: item.url || '',
          thumbnail: item.thumbnail || '/placeholder-audio.png',
          creator: item.creator || 'Unknown',
          license: item.license || 'Unknown',
          source: 'openverse' as const,
          tags: item.tags?.map((tag: any) => tag.name) || [],
          size: undefined,
        }));

        if (excludeWords.trim()) {
          const excludeTerms = excludeWords.toLowerCase().split(/\s+/).filter((term) => term);
          allAudios = allAudios.filter((item: MediaResult) => !excludeTerms.some((term) => `${item.title.toLowerCase()} ${(item.tags || []).join(' ').toLowerCase()}`.includes(term)));
        }
        if (licenseFilter !== 'all' && sourceFilter === 'openverse') {
          allAudios = allAudios.filter((item: MediaResult) => item.source === 'openverse' && item.license === licenseFilter);
        }
        if (sortBy === 'size') allAudios.sort((a: MediaResult, b: MediaResult) => (b.size || 0) - (a.size || 0));
        else if (sortBy === 'title-asc') allAudios.sort((a: MediaResult, b: MediaResult) => a.title.localeCompare(b.title));
        else if (sortBy === 'title-desc') allAudios.sort((a: MediaResult, b: MediaResult) => b.title.localeCompare(a.title));

        const deduplicatedAudiosMap = new Map();
        allAudios.forEach((item: MediaResult) => {
          const key = `${item.source}-${item.id}`;
          if (!deduplicatedAudiosMap.has(key)) {
            deduplicatedAudiosMap.set(key, item);
            seenAudioIdsRef.current.add(key);
          }
        });
        const audios = Array.from(deduplicatedAudiosMap.values());
        return { items: audios, total: openverseData.result_count || audios.length };
      } catch (err) {
        console.error('Openverse audio fetch error:', err);
        throw err;
      }
    } else {
      if (sourceFilter === 'openverse') {
        return { items: [], total: 0 };
      }

      const pixabayApiKey = process.env.NEXT_PUBLIC_PIXABAY_API_KEY;
      console.log('Checking Pixabay API key for videos, value:', pixabayApiKey, 'source:', sourceFilter);
      if (pixabayApiKey == null || pixabayApiKey === '') {
        console.error('Pixabay API key is not set');
        if (sourceFilter === 'pixabay') throw new Error('Pixabay API key is not set');
      }
      const pixabayUrl = `https://pixabay.com/api/videos/?key=${pixabayApiKey}&q=${encodeURIComponent(searchQuery)}&page=${page}&per_page=20${sortBy === 'size' ? '&order=popular' : ''}`;
      console.log('Pixabay API key:', pixabayApiKey);
      console.log('Pixabay URL:', pixabayUrl);
      let pixabayRes;
      try {
        pixabayRes = await fetch(pixabayUrl);
        if (!pixabayRes.ok) {
          const errorText = await pixabayRes.text();
          throw new Error(`Failed to fetch videos from Pixabay: ${errorText}`);
        }
        const pixabayData = await pixabayRes.json();
        let allVideos = (pixabayData.hits || []).map((item: any) => {
          const videoURL = item.videos?.medium?.url || item.videos?.small?.url || '';
          return {
            id: item.id.toString(),
            title: item.tags || 'Untitled',
            url: item.pageURL || '',
            thumbnail: item.videos?.tiny?.thumbnail || '/placeholder-video.png',
            videoURL,
            creator: item.user || 'Unknown',
            license: 'Pixabay License',
            source: 'pixabay' as const,
            tags: item.tags?.split(',').map((tag: string) => tag.trim()) || [],
            size: undefined,
          };
        });

        if (excludeWords.trim()) {
          const excludeTerms = excludeWords.toLowerCase().split(/\s+/).filter((term) => term);
          allVideos = allVideos.filter((item: MediaResult) => !excludeTerms.some((term) => `${item.title.toLowerCase()} ${(item.tags || []).join(' ').toLowerCase()}`.includes(term)));
        }
        if (sortBy === 'size') allVideos.sort((a: MediaResult, b: MediaResult) => (b.size || 0) - (a.size || 0));
        else if (sortBy === 'title-asc') allVideos.sort((a: MediaResult, b: MediaResult) => a.title.localeCompare(b.title));
        else if (sortBy === 'title-desc') allVideos.sort((a: MediaResult, b: MediaResult) => b.title.localeCompare(a.title));

        const deduplicatedVideosMap = new Map();
        allVideos.forEach((item: MediaResult) => {
          const key = `${item.source}-${item.id}`;
          if (!deduplicatedVideosMap.has(key)) {
            deduplicatedVideosMap.set(key, item);
            seenVideoIdsRef.current.add(key);
          }
        });
        const videos = Array.from(deduplicatedVideosMap.values());
        return { items: videos, total: pixabayData.totalHits || videos.length };
      } catch (err) {
        console.error('Pixabay video fetch error:', err);
        throw err;
      }
    }
  } catch (err) {
    console.error(`Error fetching ${type}:`, err);
    throw err;
  }
}