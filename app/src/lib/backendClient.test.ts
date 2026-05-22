import { ApiError, buildApiUrl, requestJson } from './backendClient';

describe('backendClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('builds urls with encoded query params', () => {
    expect(buildApiUrl('http://localhost:8000/', '/api/lyrics/search-utaten', { q: '夜に 駆ける' }))
      .toBe('http://localhost:8000/api/lyrics/search-utaten?q=%E5%A4%9C%E3%81%AB+%E9%A7%86%E3%81%91%E3%82%8B');
  });

  it('wraps backend connectivity failures in ApiError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(requestJson('http://localhost:8000', '/api/test')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('Backend request failed'),
    });
  });

  it('stringifies structured backend error details', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ detail: { code: 'bad_url' } }),
        text: jest.fn(),
      }
    ) as unknown as typeof fetch;

    await expect(requestJson('http://localhost:8000', '/api/test')).rejects.toMatchObject({
      status: 400,
      message: '{"code":"bad_url"}',
    });
  });
});
