const tails = new Map<string, Promise<void>>();

/**
 * Runs fn after every earlier call with the same key has settled (one game's
 * operations never interleave). Different keys run in parallel. A failure only
 * rejects its own caller.
 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
