import { describe, expect, it } from 'vitest';
import { withLock } from './lock';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('withLock', () => {
  it('runs calls on the same key one after another', async () => {
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`${name}:start`);
      await delay(ms);
      log.push(`${name}:end`);
      return name;
    };
    const [a, b] = await Promise.all([withLock('g1', task('a', 30)), withLock('g1', task('b', 5))]);
    expect([a, b]).toEqual(['a', 'b']);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('runs calls on different keys in parallel', async () => {
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`${name}:start`);
      await delay(ms);
      log.push(`${name}:end`);
    };
    await Promise.all([withLock('k1', task('a', 30)), withLock('k2', task('b', 5))]);
    expect(log.slice(0, 2).sort()).toEqual(['a:start', 'b:start']);
    expect(log.indexOf('b:end')).toBeLessThan(log.indexOf('a:end'));
  });

  it('a failing call rejects its caller but does not block the next one', async () => {
    const failed = withLock('g2', async () => {
      throw new Error('boom');
    });
    const after = withLock('g2', async () => 'ok');
    await expect(failed).rejects.toThrow('boom');
    await expect(after).resolves.toBe('ok');
  });
});
