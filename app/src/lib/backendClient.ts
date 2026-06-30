export type QueryValue = string | number | boolean | null | undefined;

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

type RequestJsonOptions = RequestInit & {
  params?: Record<string, QueryValue>;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
};

export const buildApiUrl = (backendUrl: string, path: string, params?: Record<string, QueryValue>) => {
  const base = backendUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const readErrorMessage = async (response: Response) => {
  const parseBody = (body: unknown) => {
    const record = body as { detail?: unknown; error?: { message?: unknown } };
    const message = record.detail || record.error?.message || response.statusText;
    return { message: typeof message === 'string' ? message : JSON.stringify(message), detail: body };
  };

  let text = '';
  try {
    text = await response.text();
  } catch {
    text = '';
  }

  if (text) {
    try {
      return parseBody(JSON.parse(text));
    } catch {
      return { message: text || response.statusText, detail: text };
    }
  }

  try {
    return parseBody(await response.json());
  } catch {
    return { message: response.statusText || 'Backend request failed', detail: text };
  }
};

const RETRYABLE_GATEWAY_STATUSES = new Set([502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const wait = (ms: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));

const requestMethod = (method?: string) => (method || 'GET').toUpperCase();

const retryDelay = (baseDelayMs: number, attempt: number) => {
  if (baseDelayMs <= 0) return 0;
  return Math.min(baseDelayMs * 2 ** attempt, 5000);
};

export async function requestJson<T>(
  backendUrl: string,
  path: string,
  options: RequestJsonOptions = {}
): Promise<T> {
  const {
    params,
    timeoutMs = 30000,
    retryAttempts,
    retryDelayMs = 600,
    ...fetchOptions
  } = options;
  const method = requestMethod(fetchOptions.method);
  const maxRetries = retryAttempts ?? (IDEMPOTENT_METHODS.has(method) ? 3 : 0);
  const url = buildApiUrl(backendUrl, path, params);
  let response: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(url, {
        ...fetchOptions,
        signal: fetchOptions.signal ?? controller.signal,
        headers: {
          ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
          ...(fetchOptions.headers || {}),
        },
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        if (!fetchOptions.signal && attempt < maxRetries) {
          await wait(retryDelay(retryDelayMs, attempt));
          continue;
        }
        throw new ApiError('Backend request timed out', 408);
      }
      if (attempt < maxRetries) {
        await wait(retryDelay(retryDelayMs, attempt));
        continue;
      }
      throw new ApiError('Backend request failed. The backend may be offline, waking from idle, blocked by the proxy, or missing CORS headers.', 0, {
        cause: (error as Error).message,
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }

    if (!response.ok && RETRYABLE_GATEWAY_STATUSES.has(response.status) && attempt < maxRetries) {
      await wait(retryDelay(retryDelayMs, attempt));
      continue;
    }

    break;
  }

  if (!response) {
    throw new ApiError('Backend request failed before receiving a response.', 0);
  }

  if (!response.ok) {
    const { message, detail } = await readErrorMessage(response);
    throw new ApiError(message, response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const getJson = <T>(backendUrl: string, path: string, params?: Record<string, QueryValue>) =>
  requestJson<T>(backendUrl, path, { params });

export const postJson = <T>(backendUrl: string, path: string, body: unknown, params?: Record<string, QueryValue>) =>
  requestJson<T>(backendUrl, path, { method: 'POST', body: JSON.stringify(body), params });

export const deleteJson = <T>(backendUrl: string, path: string, params?: Record<string, QueryValue>) =>
  requestJson<T>(backendUrl, path, { method: 'DELETE', params });

export const headOk = async (backendUrl: string, path: string) => {
  const url = buildApiUrl(backendUrl, path);

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
      if (response.ok) return true;
      if (!RETRYABLE_GATEWAY_STATUSES.has(response.status)) return false;
    } catch {
      // Treat network/CORS failures like a cold backend and give it a short chance to recover.
    } finally {
      globalThis.clearTimeout(timeout);
    }

    await wait(retryDelay(400, attempt));
  }

  return false;
};
