export type ErrorCode =
  | 'GAME_NOT_FOUND'
  | 'NAME_TAKEN'
  | 'GAME_OVER'
  | 'TIME_UP'
  | 'TEAM_REMOVED'
  | 'BAD_TOKEN'
  | 'BAD_PASSWORD'
  | 'UNAUTHORIZED'
  | 'INVALID'
  | 'STALE';

export const ERROR_TEXT: Record<ErrorCode, string> = {
  GAME_NOT_FOUND: 'Δεν βρέθηκε παιχνίδι με αυτόν τον κωδικό.',
  NAME_TAKEN: 'Υπάρχει ήδη ομάδα με αυτό το όνομα.',
  GAME_OVER: 'Το παιχνίδι έχει ολοκληρωθεί.',
  TIME_UP: 'Ο χρόνος έληξε.',
  TEAM_REMOVED: 'Η ομάδα σας αφαιρέθηκε από τον παρουσιαστή.',
  BAD_TOKEN: 'Η σύνδεση της ομάδας δεν ισχύει πια. Μπείτε ξανά με τον κωδικό.',
  BAD_PASSWORD: 'Λάθος κωδικός.',
  UNAUTHORIZED: 'Η σύνδεση έληξε. Συνδεθείτε ξανά.',
  INVALID: 'Μη έγκυρη ενέργεια.',
  STALE: 'Η οθόνη δεν ήταν ενημερωμένη. Δοκιμάστε ξανά.',
};
