import { requestChatCompletion } from './llmClient';

const baseOptions = {
  apiKey: 'test-key',
  model: 'test-model',
  prompt: 'hello',
};

describe('llmClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects invalid API URLs before sending requests', async () => {
    await expect(requestChatCompletion({ ...baseOptions, apiUrl: 'not a url' })).rejects.toThrow('LLM API URL is invalid');
  });

  it('surfaces non-json provider errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      clone: () => ({
        json: jest.fn().mockRejectedValue(new Error('not json')),
      }),
      text: jest.fn().mockResolvedValue('rate limited'),
    }) as unknown as typeof fetch;

    await expect(requestChatCompletion({ ...baseOptions, apiUrl: 'https://api.example.com/v1/chat/completions' })).rejects.toMatchObject({
      status: 429,
      message: 'rate limited',
    });
  });

  it('surfaces json provider errors without cloning the response body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: jest.fn().mockResolvedValue(JSON.stringify({ error: { message: 'invalid model' } })),
    }) as unknown as typeof fetch;

    await expect(requestChatCompletion({ ...baseOptions, apiUrl: 'https://api.example.com/v1/chat/completions' })).rejects.toMatchObject({
      status: 400,
      message: 'invalid model',
    });
  });
});
