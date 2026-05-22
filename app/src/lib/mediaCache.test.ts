import { ensureBackendMediaCache, getBackendMediaPath, getPlayableMediaUrl } from './mediaCache';

describe('mediaCache', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('detects backend relative and same-origin media paths', () => {
    expect(getBackendMediaPath('http://localhost:8000', '/media_cache/a.mp3')).toBe('/media_cache/a.mp3');
    expect(getBackendMediaPath('http://localhost:8000', 'media_cache/a.mp3')).toBe('/media_cache/a.mp3');
    expect(getBackendMediaPath('http://localhost:8000', 'http://localhost:8000/media_cache/a.mp3')).toBe('/media_cache/a.mp3');
    expect(getBackendMediaPath('http://localhost:8000', 'https://cdn.example.com/a.mp3')).toBeNull();
  });

  it('keeps external media urls and resolves backend-relative urls', () => {
    expect(getPlayableMediaUrl('http://localhost:8000', '/media_cache/a.mp3')).toBe('http://localhost:8000/media_cache/a.mp3');
    expect(getPlayableMediaUrl('http://localhost:8000', 'https://cdn.example.com/a.mp3')).toBe('https://cdn.example.com/a.mp3');
  });

  it('uses the existing backend cache when HEAD succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    const result = await ensureBackendMediaCache('http://localhost:8000', {
      media_url: '/media_cache/a.mp3',
      sourceUrl: 'https://example.com/watch?v=a',
    });

    expect(result).toMatchObject({
      refreshed: false,
      available: true,
      playableUrl: 'http://localhost:8000/media_cache/a.mp3',
      updatePayload: null,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches media info when the backend cache is missing', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          media_type: 'audio',
          title: 'Fresh title',
          artist: 'Fresh artist',
          cover_url: 'https://example.com/cover.jpg',
          duration: 123,
          media_url: '/media_cache/fresh.mp3',
          local_path: 'E:\\cache\\fresh.mp3',
        }),
      }) as unknown as typeof fetch;

    const result = await ensureBackendMediaCache('http://localhost:8000', {
      title: 'Stale title',
      media_url: '/media_cache/stale.mp3',
      sourceUrl: 'https://example.com/watch?v=a',
    });

    expect(result.refreshed).toBe(true);
    expect(result.available).toBe(true);
    expect(result.playableUrl).toBe('http://localhost:8000/media_cache/fresh.mp3');
    expect(result.song).toMatchObject({
      title: 'Fresh title',
      media_url: '/media_cache/fresh.mp3',
      local_path: 'E:\\cache\\fresh.mp3',
    });
    expect(result.updatePayload).toMatchObject({
      title: 'Fresh title',
      media_url: '/media_cache/fresh.mp3',
      local_path: 'E:\\cache\\fresh.mp3',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('re-fetches media info when a source URL exists but media_url is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        media_type: 'audio',
        title: 'Recovered title',
        artist: null,
        cover_url: null,
        duration: 45,
        media_url: '/media_cache/recovered.mp3',
        local_path: 'E:\\cache\\recovered.mp3',
      }),
    }) as unknown as typeof fetch;

    const result = await ensureBackendMediaCache('http://localhost:8000', {
      sourceUrl: 'https://example.com/watch?v=recover',
    });

    expect(result.refreshed).toBe(true);
    expect(result.available).toBe(true);
    expect(result.playableUrl).toBe('http://localhost:8000/media_cache/recovered.mp3');
    expect(result.song).toMatchObject({
      media_url: '/media_cache/recovered.mp3',
      local_path: 'E:\\cache\\recovered.mp3',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not try to re-cache external media URLs', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await ensureBackendMediaCache('http://localhost:8000', {
      media_url: 'https://cdn.example.com/a.mp3',
      sourceUrl: 'https://example.com/watch?v=a',
    });

    expect(result).toMatchObject({
      refreshed: false,
      available: true,
      playableUrl: 'https://cdn.example.com/a.mp3',
      updatePayload: null,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
