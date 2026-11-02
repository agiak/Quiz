import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ADMIN_TOKEN_TTL_MS } from '../../../shared/constants';

const sign = (secret: string, payload: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function signAdminToken(secret: string, now: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + ADMIN_TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyAdminToken(secret: string, token: string, now: number): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && now < exp;
  } catch {
    return false;
  }
}

export function checkPassword(expected: string, given: string): boolean {
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(expected), h(given));
}

export function requireAdmin(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const m = /^Bearer (.+)$/.exec(req.header('authorization') ?? '');
    if (!m || !verifyAdminToken(secret, m[1], Date.now())) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    next();
  };
}
