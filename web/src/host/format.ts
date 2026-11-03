import type { GameStatus } from '../../../shared/types';

/** '482913' → '482 913' (anything else is returned unchanged). */
export function formatCode(code: string): string {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export const STATUS_LABEL: Record<GameStatus, string> = {
  lobby: 'Αναμονή ομάδων',
  question_open: 'Ερώτηση σε εξέλιξη',
  question_closed: 'Ερώτηση έκλεισε',
  revealing: 'Αποτελέσματα',
  finished: 'Ολοκληρώθηκε',
  cancelled: 'Ακυρώθηκε',
};

export function teamsLabel(n: number): string {
  return n === 1 ? '1 ομάδα' : `${n} ομάδες`;
}

/** Fraction of the ring still left, clamped to [0, 1]. */
export function ringFraction(remaining: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, remaining / total));
}

export type HostAction = 'start' | 'next' | 'close' | 'results' | 'reveal-next';

/** The action bound to the primary button (and → / Space) in each phase, if any. */
export function primaryAction(
  status: GameStatus,
  currentIndex: number | null,
  questionCount: number,
): HostAction | null {
  switch (status) {
    case 'lobby':
      return 'start';
    case 'question_closed':
      return currentIndex !== null && currentIndex + 1 >= questionCount ? 'results' : 'next';
    case 'revealing':
      return 'reveal-next';
    default:
      return null;
  }
}
