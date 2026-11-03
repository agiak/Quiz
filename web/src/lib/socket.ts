import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ErrorCode } from '../../../shared/errors';
import { serverOffset } from './clock';
import { SERVER_URL } from './api';

export type Ack<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: ErrorCode };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Emit = (event: string, payload?: unknown) => Promise<Ack<any>>;

export interface GameSocketOptions {
  auth?: { adminToken: string };
  onConnect: (emit: Emit) => void | Promise<void>;
}

const ACK_TIMEOUT_MS = 10_000;

export function useGameSocket<S extends { serverNow: number }>(opts: GameSocketOptions) {
  const [state, setState] = useState<S | null>(null);
  const [offset, setOffset] = useState(0);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners = useRef(new Map<string, Set<(data: any) => void>>());

  const emit = useCallback<Emit>((event, payload) => {
    return new Promise((resolve) => {
      const s = socketRef.current;
      if (!s) return resolve({ ok: false, error: 'INVALID' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      s.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err: unknown, ack: Ack<any>) => {
        resolve(err || !ack ? { ok: false, error: 'INVALID' } : ack);
      });
    });
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      auth: optsRef.current.auth,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      void optsRef.current.onConnect(emit);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('game:state', (s: S) => {
      setOffset(serverOffset(s.serverNow, Date.now()));
      setState(s);
    });
    socket.on('team:removed', (data: unknown) => {
      listeners.current.get('team:removed')?.forEach((cb) => cb(data));
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [emit]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEvent = useCallback((name: string, cb: (data: any) => void) => {
    let set = listeners.current.get(name);
    if (!set) listeners.current.set(name, (set = new Set()));
    const s = set;
    s.add(cb);
    return () => {
      s.delete(cb);
    };
  }, []);

  return { state, offset, connected, emit, onEvent };
}
