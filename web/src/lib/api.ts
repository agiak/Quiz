import type { ErrorCode } from '../../../shared/errors';
import { ADMIN_TOKEN_KEY, storage } from './storage';

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? '';

export class ApiError extends Error {
  constructor(public code: ErrorCode, public status: number) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  admin?: boolean;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.admin) {
    const token = storage.get(ADMIN_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('INVALID', 0);
  }
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    if (res.status === 401) storage.remove(ADMIN_TOKEN_KEY);
    const code = (data as { error?: ErrorCode } | null)?.error ?? 'INVALID';
    throw new ApiError(code, res.status);
  }
  return data as T;
}
