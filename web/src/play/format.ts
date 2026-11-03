export const LETTERS = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ'];

/** Whole seconds left, rounded up so the last second shows 1 until it hits 0. */
export function secondsLeft(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}

export function pointsLabel(n: number): string {
  return n === 1 ? '1 πόντος' : `${n} πόντοι`;
}
