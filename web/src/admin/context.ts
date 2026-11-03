import { createContext, useContext } from 'react';
import { ERROR_TEXT } from '../../../shared/errors';
import { ApiError } from '../lib/api';

export interface AdminCtx {
  /** Turns any failure into Greek text; a 401 also logs the admin out. */
  fail: (e: unknown) => string;
  logout: () => void;
}

export const AdminContext = createContext<AdminCtx>({ fail: () => ERROR_TEXT.INVALID, logout: () => {} });

export const useAdmin = () => useContext(AdminContext);

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Δεν υπάρχει σύνδεση με τον server. Δοκιμάστε ξανά.';
    return ERROR_TEXT[e.code] ?? ERROR_TEXT.INVALID;
  }
  return ERROR_TEXT.INVALID;
}
