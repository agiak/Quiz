import type { Server, Socket } from 'socket.io';
import { z, ZodError } from 'zod';
import type { ErrorCode } from '../../../shared/errors';
import { answerSchema, hostActionSchema, joinSchema } from '../../../shared/schemas';
import type { Config } from '../config';
import { GameError } from '../game/model';
import { verifyAdminToken } from '../http/auth';
import type { GameService, HostAction } from './service';

type AckReply = ({ ok: true } & Record<string, unknown>) | { ok: false; error: ErrorCode };
type Ack = (reply: AckReply) => void;

export interface Gateway {
  /** Send fresh game:state snapshots to the host room and every active team's room. */
  publish(gameId: string): void;
  /** Tell the removed team's sockets and drop them from the team room. */
  teamRemoved(gameId: string, teamId: string): void;
}

const resumeSchema = z.object({ token: z.string().min(1) });
const watchSchema = z.object({ gameId: z.string().min(1) });
const removeSchema = z.object({ gameId: z.string().min(1), teamId: z.string().min(1) });
const HOST_ACTIONS: HostAction[] = ['start', 'next', 'close', 'results', 'reveal-next'];

const hostRoom = (gameId: string) => `host:${gameId}`;
const teamRoom = (teamId: string) => `team:${teamId}`;

function errorCode(e: unknown): ErrorCode {
  if (e instanceof GameError) return e.code;
  if (e instanceof ZodError) return 'INVALID';
  console.error('Socket handler failed:', e);
  return 'INVALID';
}

export function attachSockets(io: Server, service: GameService, config: Config): Gateway {
  // Coalesce publishes: while one is waiting for its snapshot, further requests are covered by it.
  // Safe because the snapshot runs under the game lock: no change can land between the snapshot
  // being read and `pending` being cleared (the next queued operation starts only after that).
  const pending = new Set<string>();

  const gateway: Gateway = {
    publish(gameId) {
      if (pending.has(gameId)) return;
      pending.add(gameId);
      // The snapshot is taken under the game lock, after any operation already queued.
      queueMicrotask(() => {
        service
          .snapshots(gameId)
          .then((s) => {
            pending.delete(gameId);
            io.to(hostRoom(gameId)).emit('game:state', s.host);
            for (const t of s.teams) io.to(teamRoom(t.teamId)).emit('game:state', t.state);
          })
          .catch((e) => {
            pending.delete(gameId);
            console.error(`Publishing game ${gameId} failed:`, e);
          });
      });
    },
    teamRemoved(_gameId, teamId) {
      io.to(teamRoom(teamId)).emit('team:removed');
      io.in(teamRoom(teamId)).socketsLeave(teamRoom(teamId));
    },
  };

  io.on('connection', (socket: Socket) => {
    const adminToken: unknown = socket.handshake.auth?.adminToken;
    const isHost = () =>
      typeof adminToken === 'string' && verifyAdminToken(config.sessionSecret, adminToken, Date.now());
    let team: { token: string; teamId: string } | null = null;

    /** Registers a handler with uniform ack handling; fn returns the extra ack data. */
    const on = (
      event: string,
      fn: (payload: unknown) => Promise<Record<string, unknown> | void>,
      opts: { host?: boolean } = {},
    ) => {
      socket.on(event, async (payload: unknown, ack?: unknown) => {
        const reply: Ack = typeof ack === 'function' ? (ack as Ack) : () => {};
        if (opts.host && !isHost()) return reply({ ok: false, error: 'UNAUTHORIZED' });
        try {
          reply({ ok: true, ...((await fn(payload)) ?? {}) });
        } catch (e) {
          reply({ ok: false, error: errorCode(e) });
        }
      });
    };

    const enterTeam = (teamId: string, token: string) => {
      if (team && team.teamId !== teamId) void socket.leave(teamRoom(team.teamId));
      team = { teamId, token };
      void socket.join(teamRoom(teamId));
    };

    on('team:join', async (payload) => {
      const { code, name } = joinSchema.parse(payload);
      const { token, teamId } = await service.join(code, name);
      enterTeam(teamId, token);
      // The room is joined first, so no later broadcast can be missed; this state precedes them.
      socket.emit('game:state', await service.resume(token));
      return { token };
    });

    on('team:resume', async (payload) => {
      const { token } = resumeSchema.parse(payload);
      const found = await service.session(token);
      enterTeam(found.teamId, token);
      // Re-read after joining the room so the state sent here is never older than a missed broadcast.
      const { state } = await service.session(token);
      socket.emit('game:state', state);
      return { state };
    });

    on('team:answer', async (payload) => {
      const { questionIndex, choice } = answerSchema.parse(payload);
      if (!team) throw new GameError('BAD_TOKEN');
      await service.answer(team.token, questionIndex, choice);
    });

    on(
      'host:watch',
      async (payload) => {
        const { gameId } = watchSchema.parse(payload);
        void socket.join(hostRoom(gameId));
        try {
          socket.emit('game:state', await service.hostSnapshot(gameId));
        } catch (e) {
          void socket.leave(hostRoom(gameId));
          throw e;
        }
      },
      { host: true },
    );

    for (const action of HOST_ACTIONS) {
      on(
        `host:${action}`,
        async (payload) => {
          const { gameId, expectStep } = hostActionSchema.parse(payload);
          await service.host(action, gameId, expectStep);
        },
        { host: true },
      );
    }

    on(
      'host:remove-team',
      async (payload) => {
        const { gameId, teamId } = removeSchema.parse(payload);
        await service.removeTeam(gameId, teamId);
      },
      { host: true },
    );
  });

  return gateway;
}
