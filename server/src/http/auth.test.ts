import { describe, expect, it } from 'vitest';
import { checkPassword, signAdminToken, verifyAdminToken } from './auth';
import { loadConfig } from '../config';

describe('admin token', () => {
  const t = signAdminToken('s', 0);
  it('valid until 12h', () => {
    expect(verifyAdminToken('s', t, 12 * 3600_000 - 1)).toBe(true);
    expect(verifyAdminToken('s', t, 12 * 3600_000 + 1)).toBe(false);
  });
  it('rejects wrong secret, tampering and garbage', () => {
    expect(verifyAdminToken('x', t, 1)).toBe(false);
    const [p, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ exp: 9e15 })).toString('base64url');
    expect(verifyAdminToken('s', `${forged}.${s}`, 1)).toBe(false);
    expect(verifyAdminToken('s', `${p}.`, 1)).toBe(false);
    expect(verifyAdminToken('s', 'garbage', 1)).toBe(false);
    expect(verifyAdminToken('s', '', 1)).toBe(false);
  });
});

describe('checkPassword', () => {
  it('compares', () => {
    expect(checkPassword('abc', 'abc')).toBe(true);
    expect(checkPassword('abc', 'abd')).toBe(false);
    expect(checkPassword('abc', '')).toBe(false);
  });
});

describe('loadConfig', () => {
  const env = { DATABASE_URL: 'd', ADMIN_PASSWORD: 'a', SESSION_SECRET: 's', WEB_ORIGIN: 'https://w' };
  it('reads values with default port', () => {
    expect(loadConfig(env)).toEqual({
      databaseUrl: 'd', adminPassword: 'a', sessionSecret: 's', webOrigin: 'https://w', port: 3000,
    });
    expect(loadConfig({ ...env, PORT: '8080' }).port).toBe(8080);
  });
  it('lists every missing variable', () => {
    expect(() => loadConfig({ SESSION_SECRET: 's' })).toThrow(/DATABASE_URL.*ADMIN_PASSWORD.*WEB_ORIGIN/);
  });
});
