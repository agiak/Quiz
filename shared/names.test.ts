import { describe, expect, it } from 'vitest';
import { cleanTeamName, nameKey } from './names';

describe('nameKey', () => {
  it('ignores case and accents', () => {
    expect(nameKey('Αετοί')).toBe(nameKey('ΑΕΤΟΙ'));
    expect(nameKey('Αετοί')).toBe(nameKey('  αετοι '.trim()));
    expect(nameKey('Λύκος')).toBe(nameKey('ΛΥΚΟΣ'));
  });
  it('treats final sigma like sigma and strips diaeresis', () => {
    expect(nameKey('Λύκος')).toBe(nameKey('λύκοσ'));
    expect(nameKey('Ταΐνα')).toBe(nameKey('ΤΑΙΝΑ'));
  });
  it('collapses whitespace', () => {
    expect(nameKey('  Οι   Σοφοί ')).toBe(nameKey('οι σοφοι'));
  });
  it('distinguishes different names', () => {
    expect(nameKey('Αετοί')).not.toBe(nameKey('Λύκοι'));
  });
});

describe('cleanTeamName', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanTeamName('  Οι   Σοφοί  ')).toBe('Οι Σοφοί');
  });
  it('normalizes to NFC', () => {
    expect(cleanTeamName('Λύκος')).toBe('Λύκος');
  });
});
