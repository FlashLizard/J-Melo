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
  try {
    const body = await response.json();
    const message = body.detail || body.error?.message || response.statusText;
    return { message: typeof message === 'string' ? message : JSON.stringify(message), detail: body };
  } catch {
    const text = await response.text().catch(() => '');
    return { message: text || response.statusText, detail: text };
  }
};

export async function requestJson<T>(
  backendUrl: string,
  path: string,
  options: RequestJsonOptions = {}
): Promise<T> {
  const { params, timeoutMs = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(buildApiUrl(backendUrl, path, params), {
      ...fetchOptions,
      signal: fetchOptions.signal ?? controller.signal,
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new ApiError('Backend request timed out', 408);
    }
    throw new ApiError('Backend request failed. Please check the backend URL, network, proxy, or CORS settings.', 0, {
      cause: (error as Error).message,
    });
  } finally {
    globalThis.clearTimeout(timeout);
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
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(buildApiUrl(backendUrl, path), { method: 'HEAD', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};
