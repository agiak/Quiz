import { describe, expect, it } from 'vitest';
import { remainingMs, serverOffset } from './clock';

describe('clock', () => {
  it('computes remaining time on a skewed device clock', () => {
    const off = serverOffset(1_000_000, 1_000_000 - 180_000);
    expect(remainingMs(1_000_000 + 30_000, off, 1_000_000 - 180_000 + 10_000)).toBe(20_000);
  });
  it('never returns negative', () => {
    expect(remainingMs(0, 0, 5)).toBe(0);
  });
});
