import { describe, expect, it } from 'vitest';
import { pointsLabel, secondsLeft } from './format';

describe('format', () => {
  it('rounds seconds up and never goes negative', () => {
    expect(secondsLeft(0)).toBe(0);
    expect(secondsLeft(1)).toBe(1);
    expect(secondsLeft(1000)).toBe(1);
    expect(secondsLeft(1001)).toBe(2);
    expect(secondsLeft(-50)).toBe(0);
  });
  it('labels points', () => {
    expect(pointsLabel(1)).toBe('1 πόντος');
    expect(pointsLabel(0)).toBe('0 πόντοι');
  });
});
