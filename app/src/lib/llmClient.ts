export interface ChatCompletionOptions {
  apiUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export class LlmError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

const readProviderErrorMessage = async (response: Response) => {
  let text = '';
  try {
    text = await response.text();
  } catch {
    text = '';
  }

  if (text) {
    try {
      const body = JSON.parse(text);
      const message = body?.error?.message || body?.detail || body?.message;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      return text;
    }
  }

  try {
    const body = await response.json();
    const message = body?.error?.message || body?.detail || body?.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // The body may already be consumed or not be JSON; statusText is the best fallback.
  }

  return response.statusText || 'Failed to fetch LLM response';
};

export async function requestChatCompletion({
  apiUrl,
  apiKey,
  model,
  prompt,
  temperature = 0.3,
  maxTokens = 32768,
  timeoutMs = 120000,
}: ChatCompletionOptions): Promise<string> {
  let normalizedApiUrl: string;
  try {
    normalizedApiUrl = new URL(apiUrl.trim()).toString();
  } catch {
    throw new LlmError('LLM API URL is invalid');
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(normalizedApiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new LlmError('LLM request timed out');
    }
    throw new LlmError(`LLM request failed: ${(error as Error).message}`);
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new LlmError(await readProviderErrorMessage(response), response.status);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new LlmError('LLM returned an empty response');
  }
  return content;
}
