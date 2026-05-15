const TOKEN_KEY = 'miganado.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

type ReqInit = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T = unknown>(path: string, init: ReqInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };

  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    if (init.body instanceof FormData) {
      body = init.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.body);
    }
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers, body });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (typeof data === 'object' && data && 'error' in data && typeof data.error === 'string')
        ? data.error
        : `Error ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}
