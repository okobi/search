import { fetchMedia, FetchResult } from '../../src/utils/fetchMedia';
import { mocked } from 'jest-mock';

// Mock the fetch function
global.fetch = jest.fn();

const mockFetch = mocked(global.fetch);

describe('fetchMedia', () => {
  // Refs for tracking seen IDs
  const seenImageIdsRef = { current: new Set<string>() };
  const seenAudioIdsRef = { current: new Set<string>() };
  const seenVideoIdsRef = { current: new Set<string>() };

  // Store original process.env
  const originalEnv = { ...process.env };

  // Initialize consoleErrorSpy
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Clear fetch mocks
    mockFetch.mockClear();
    // Clear seen IDs
    seenImageIdsRef.current.clear();
    seenAudioIdsRef.current.clear();
    seenVideoIdsRef.current.clear();
    // Mock environment variables
    process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN = 'mock-openverse-token';
    process.env.NEXT_PUBLIC_PIXABAY_API_KEY = 'mock-pixabay-key';
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    // Reset environment variables
    process.env.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN = originalEnv.NEXT_PUBLIC_OPENVERSE_ACCESS_TOKEN;
    process.env.NEXT_PUBLIC_PIXABAY_API_KEY = originalEnv.NEXT_PUBLIC_PIXABAY_API_KEY;
  });

  afterAll(() => {
    // Restore original process.env
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('fetches images from Openverse and Pixabay with default filters', async () => {
    // Mock Openverse response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 'img1', title: 'Image 1', url: 'http://openverse.com/img1', thumbnail: 'http://openverse.com/img1/thumb', creator: 'Creator 1', license: 'CC-BY', tags: [{ name: 'tag1' }] },
        ],
        result_count: 100,
      }),
    } as Response);

    // Mock Pixabay response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: [
          { id: 'img2', tags: 'tag2', pageURL: 'http://pixabay.com/img2', webformatURL: 'http://pixabay.com/img2/thumb', user: 'Creator 2'},
        ],
        totalHits: 200,
      }),
    } as Response);

    const result: FetchResult = await fetchMedia(
      'images',
      1,
      'test query',
      '',
      '',
      'all',
      'relevance',
      'all',
      seenImageIdsRef,
      seenAudioIdsRef,
      seenVideoIdsRef
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openverse.org/v1/images/?q=test%20query&page=1&page_size=20',
      { headers: new Headers({ Authorization: 'Bearer mock-openverse-token' }) }
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://pixabay.com/api/?key=mock-pixabay-key&q=test%20query&image_type=photo&page=1&per_page=20'
    );

    expect(result.items).toEqual([
      {
        id: 'img1',
        title: 'Image 1',
        url: 'http://openverse.com/img1',
        thumbnail: 'http://openverse.com/img1/thumb',
        creator: 'Creator 1',
        license: 'CC-BY',
        source: 'openverse',
        tags: ['tag1'],
        size: undefined,
      },
      {
        id: 'img2',
        title: 'tag2',
        url: 'http://pixabay.com/img2',
        thumbnail: 'http://pixabay.com/img2/thumb',
        creator: 'Creator 2',
        license: 'Pixabay License',
        source: 'pixabay',
        tags: ['tag2'],
        largeImageURL: undefined,
        previewURL: undefined,
        size: undefined,
      },
    ]);
    expect(result.total).toBe(200); // Max of Openverse (100) and Pixabay (200)
    expect(seenImageIdsRef.current.has('openverse-img1')).toBe(true);
    expect(seenImageIdsRef.current.has('pixabay-img2')).toBe(true);
  });

  it('fetches audio from Openverse with license filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 'audio1', title: 'Audio 1', url: 'http://openverse.com/audio1', thumbnail: '/placeholder-audio.png', creator: 'Creator 1', license: 'CC-BY', tags: [{ name: 'tag1' }] },
          { id: 'audio2', title: 'Audio 2', url: 'http://openverse.com/audio2', thumbnail: '/placeholder-audio.png', creator: 'Creator 2', license: 'CC-NC', tags: [{ name: 'tag2' }] },
        ],
        result_count: 50,
      }),
    } as Response);

    const result: FetchResult = await fetchMedia(
      'audio',
      1,
      'test audio',
      '',
      '',
      'CC-BY',
      'title-asc',
      'openverse',
      seenImageIdsRef,
      seenAudioIdsRef,
      seenVideoIdsRef
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openverse.org/v1/audio/?q=test%20audio&page=1&page_size=20',
      { headers: new Headers({ Authorization: 'Bearer mock-openverse-token' }) }
    );

    expect(result.items).toEqual([
      {
        id: 'audio1',
        title: 'Audio 1',
        url: 'http://openverse.com/audio1',
        thumbnail: '/placeholder-audio.png',
        creator: 'Creator 1',
        license: 'CC-BY',
        source: 'openverse',
        tags: ['tag1'],
        size: undefined,
      },
    ]);
    expect(result.total).toBe(50);
    expect(seenAudioIdsRef.current.has('openverse-audio1')).toBe(true);
    expect(seenAudioIdsRef.current.has('openverse-audio2')).toBe(false); // Filtered by license
  });

  it('fetches videos from Pixabay with exclude words', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: [
          { id: 'video1', tags: 'good, video', pageURL: 'http://pixabay.com/video1', videos: { tiny: { thumbnail: 'http://pixabay.com/video1/thumb' }, medium: { url: 'http://pixabay.com/video1/medium' } }, user: 'Creator 1' },
          { id: 'video2', tags: 'bad, video', pageURL: 'http://pixabay.com/video2', videos: { tiny: { thumbnail: 'http://pixabay.com/video2/thumb' }, medium: { url: 'http://pixabay.com/video2/medium' } }, user: 'Creator 2' },
        ],
        totalHits: 100,
      }),
    } as Response);

    const result: FetchResult = await fetchMedia(
      'videos',
      1,
      'test video',
      '',
      'bad',
      'all',
      'relevance',
      'pixabay',
      seenImageIdsRef,
      seenAudioIdsRef,
      seenVideoIdsRef
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://pixabay.com/api/videos/?key=mock-pixabay-key&q=test%20video&page=1&per_page=20'
    );

    expect(result.items).toEqual([
      {
        id: 'video1',
        title: 'good, video',
        url: 'http://pixabay.com/video1',
        thumbnail: 'http://pixabay.com/video1/thumb',
        videoURL: 'http://pixabay.com/video1/medium',
        creator: 'Creator 1',
        license: 'Pixabay License',
        source: 'pixabay',
        tags: ['good', 'video'],
        size: undefined,
      },
    ]);
    expect(result.total).toBe(100);
    expect(seenVideoIdsRef.current.has('pixabay-video1')).toBe(true);
    expect(seenVideoIdsRef.current.has('pixabay-video2')).toBe(false); // Filtered by excludeWords
  });

  it('returns empty result for empty query', async () => {
    const result: FetchResult = await fetchMedia(
      'images',
      1,
      '',
      '',
      '',
      'all',
      'relevance',
      'all',
      seenImageIdsRef,
      seenAudioIdsRef,
      seenVideoIdsRef
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], total: 0 });
    expect(seenImageIdsRef.current.size).toBe(0);
  });

  it('handles Openverse fetch error gracefully when source is "all"', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Openverse API error')); // Openverse fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: [
          { id: 'img2', tags: 'tag2', pageURL: 'http://pixabay.com/img2', webformatURL: 'http://pixabay.com/img2/thumb', user: 'Creator 2' },
        ],
        totalHits: 200,
      }),
    } as Response);

    const result: FetchResult = await fetchMedia(
      'images',
      1,
      'test query',
      '',
      '',
      'all',
      'relevance',
      'all',
      seenImageIdsRef,
      seenAudioIdsRef,
      seenVideoIdsRef
    );

    expect(result.items).toEqual([
      {
        id: 'img2',
        title: 'tag2',
        url: 'http://pixabay.com/img2',
        thumbnail: 'http://pixabay.com/img2/thumb',
        creator: 'Creator 2',
        license: 'Pixabay License',
        source: 'pixabay',
        tags: ['tag2'],
        largeImageURL: undefined,
        previewURL: undefined,
        size: undefined,
      },
    ]);
    expect(result.total).toBe(200);
    expect(seenImageIdsRef.current.has('pixabay-img2')).toBe(true);
  });

  it('throws error when Openverse fails and source is "openverse"', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Openverse API error'));

    await expect(
      fetchMedia(
        'images',
        1,
        'test query',
        '',
        '',
        'all',
        'relevance',
        'openverse',
        seenImageIdsRef,
        seenAudioIdsRef,
        seenVideoIdsRef
      )
    ).rejects.toThrow('Openverse API error');
  });

  it('throws error when Pixabay API key is missing and source is "pixabay"', async () => {
    delete process.env.NEXT_PUBLIC_PIXABAY_API_KEY; // Remove the key entirely
    mockFetch.mockReset();
    console.log('Mock fetch cleared:', mockFetch.mock.calls.length);

    await expect(
      fetchMedia(
        'videos',
        1,
        'test video',
        '',
        '',
        'all',
        'relevance',
        'pixabay',
        seenImageIdsRef,
        seenAudioIdsRef,
        seenVideoIdsRef
      )
    ).rejects.toThrow('Pixabay API key is not set');

    expect(mockFetch).not.toHaveBeenCalled();
    process.env.NEXT_PUBLIC_PIXABAY_API_KEY = 'mock-pixabay-key';
  });

  it('throws error when Pixabay API key is empty and source is "pixabay"', async () => {
    process.env.NEXT_PUBLIC_PIXABAY_API_KEY = ''; // Set to empty string
    mockFetch.mockReset();
    console.log('Mock fetch cleared:', mockFetch.mock.calls.length);

    await expect(
      fetchMedia(
        'videos',
        1,
        'test video',
        '',
        '',
        'all',
        'relevance',
        'pixabay',
        seenImageIdsRef,
        seenAudioIdsRef,
        seenVideoIdsRef
      )
    ).rejects.toThrow('Pixabay API key is not set');

    expect(mockFetch).not.toHaveBeenCalled();
    process.env.NEXT_PUBLIC_PIXABAY_API_KEY = 'mock-pixabay-key';
  });

  it('sorts results by title-asc', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 'img1', title: 'Zebra', url: 'http://openverse.com/img1', thumbnail: 'http://openverse.com/img1/thumb', creator: 'Creator 1', license: 'CC-BY', tags: [{ name: 'tag1' }] },
          { id: 'img2', title: 'Apple', url: 'http://openverse.com/img2', thumbnail: 'http://openverse.com/img2/thumb', creator: 'Creator 2', license: 'CC-BY', tags: [{ name: 'tag2' }] },
        ],
        result_count: 100,
      }),
    } as Response);

    const result: FetchResult = await fetchMedia(
      'images',
      1,
      'test query',
      '',
      '',
      'all',
      'title-asc',
      'openverse',
      seenImageIdsRef,
      seenAudioIdsRef,
      seenVideoIdsRef
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openverse.org/v1/images/?q=test%20query&page=1&page_size=20',
      { headers: new Headers({ Authorization: 'Bearer mock-openverse-token' }) }
    );

    expect(result.items).toEqual([
      {
        id: 'img2',
        title: 'Apple',
        url: 'http://openverse.com/img2',
        thumbnail: 'http://openverse.com/img2/thumb',
        creator: 'Creator 2',
        license: 'CC-BY',
        source: 'openverse',
        tags: ['tag2'],
        size: undefined,
      },
      {
        id: 'img1',
        title: 'Zebra',
        url: 'http://openverse.com/img1',
        thumbnail: 'http://openverse.com/img1/thumb',
        creator: 'Creator 1',
        license: 'CC-BY',
        source: 'openverse',
        tags: ['tag1'],
        size: undefined,
      },
    ]);
    expect(result.total).toBe(100);
  });
});