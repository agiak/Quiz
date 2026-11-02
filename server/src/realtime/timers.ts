export interface Timers {
  /** Call fn at time `at` (ms since epoch). Replaces the game's previous timer. */
  schedule(gameId: string, at: number, fn: () => void): void;
  cancel(gameId: string): void;
  cancelAll(): void;
}

/** setTimeout-based timers, one per game. */
export function createTimers(now: () => number = Date.now): Timers {
  const handles = new Map<string, ReturnType<typeof setTimeout>>();
  const cancel = (gameId: string) => {
    const h = handles.get(gameId);
    if (h !== undefined) clearTimeout(h);
    handles.delete(gameId);
  };
  return {
    schedule(gameId, at, fn) {
      cancel(gameId);
      const h = setTimeout(() => {
        if (handles.get(gameId) === h) handles.delete(gameId);
        fn();
      }, Math.max(0, at - now()));
      handles.set(gameId, h);
    },
    cancel,
    cancelAll() {
      for (const h of handles.values()) clearTimeout(h);
      handles.clear();
    },
  };
}
