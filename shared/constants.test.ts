import { describe, it, expect } from 'vitest';
import {
  TIME_MIN_SEC,
  TIME_DEFAULT_SEC,
  TIME_MAX_SEC,
  OPTIONS_MIN,
  OPTIONS_MAX,
} from './constants';

describe('constants', () => {
  it('keeps time bounds ordered', () => {
    expect(TIME_MIN_SEC).toBeLessThan(TIME_DEFAULT_SEC);
    expect(TIME_DEFAULT_SEC).toBeLessThan(TIME_MAX_SEC);
    expect(OPTIONS_MIN).toBeLessThanOrEqual(OPTIONS_MAX);
  });
});
