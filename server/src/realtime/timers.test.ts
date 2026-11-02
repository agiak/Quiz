import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimers } from './timers';

describe('timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires at the given time', () => {
    const t = createTimers();
    const fn = vi.fn();
    t.schedule('g', 1_005_000, fn);
    vi.advanceTimersByTime(4_999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel before the deadline means fn is never called', () => {
    const t = createTimers();
    const fn = vi.fn();
    t.schedule('g', 1_005_000, fn);
    vi.advanceTimersByTime(2_000);
    t.cancel('g');
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('scheduling again for the same game replaces the previous timer', () => {
    const t = createTimers();
    const first = vi.fn();
    const second = vi.fn();
    t.schedule('g', 1_005_000, first);
    t.schedule('g', 1_008_000, second);
    vi.advanceTimersByTime(10_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a time in the past fires on the next tick', () => {
    const t = createTimers();
    const fn = vi.fn();
    t.schedule('g', 900_000, fn);
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancelAll clears every timer', () => {
    const t = createTimers();
    const fn = vi.fn();
    t.schedule('a', 1_001_000, fn);
    t.schedule('b', 1_002_000, fn);
    t.cancelAll();
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
  });
});
