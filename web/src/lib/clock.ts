/** offset = serverTime - localTime; add it to local time to get server time. */
export function serverOffset(serverNow: number, localNow: number): number {
  return serverNow - localNow;
}

/** Milliseconds until `endsAt` (server time); never negative. */
export function remainingMs(endsAt: number, offset: number, localNow: number): number {
  return Math.max(0, endsAt - (localNow + offset));
}
