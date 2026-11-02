/** Trim, collapse runs of whitespace to a single space, normalize to NFC. */
export function cleanTeamName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Comparison key for team names: ignores case, tonos, dialytika and the
 * final-sigma distinction ("Λύκος" and "ΛΥΚΟΣ" collide).
 */
export function nameKey(name: string): string {
  const stripped = name.normalize('NFD').replace(/\p{M}+/gu, '');
  return cleanTeamName(stripped.toLocaleLowerCase('el').replace(/ς/g, 'σ'));
}
