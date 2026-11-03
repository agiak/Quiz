import { describe, expect, it } from 'vitest';
import { formatCode, primaryAction, ringFraction, teamsLabel } from './format';

describe('host format', () => {
  it('splits the code in two groups', () => {
    expect(formatCode('482913')).toBe('482 913');
    expect(formatCode('12')).toBe('12');
  });
  it('labels team counts', () => {
    expect(teamsLabel(1)).toBe('1 ομάδα');
    expect(teamsLabel(0)).toBe('0 ομάδες');
  });
  it('clamps the ring fraction', () => {
    expect(ringFraction(5000, 10000)).toBe(0.5);
    expect(ringFraction(12000, 10000)).toBe(1);
    expect(ringFraction(-1, 10000)).toBe(0);
    expect(ringFraction(1, 0)).toBe(0);
  });
  it('picks the primary action per phase', () => {
    expect(primaryAction('lobby', null, 3)).toBe('start');
    expect(primaryAction('question_open', 0, 3)).toBeNull();
    expect(primaryAction('question_closed', 0, 3)).toBe('next');
    expect(primaryAction('question_closed', 2, 3)).toBe('results');
    expect(primaryAction('revealing', 2, 3)).toBe('reveal-next');
    expect(primaryAction('finished', 2, 3)).toBeNull();
  });
});
