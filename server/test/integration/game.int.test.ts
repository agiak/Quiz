import { randomBytes } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type pg from 'pg';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ANSWER_GRACE_MS } from '../../../shared/constants';
import type { HostState, TeamState } from '../../../shared/types';
import { createGame, loadGame } from '../../src/db/games';
import { migrate } from '../../src/db/migrate';
import { createPool } from '../../src/db/pool';
import { createQuiz } from '../../src/db/quizzes';
import { signAdminToken } from '../../src/http/auth';
import { GameService } from '../../src/realtime/service';
import { attachSockets, type Gateway } from '../../src/realtime/sockets';
import { createTimers, type Timers } from '../../src/realtime/timers';

const url = process.env.DATABASE_URL_TEST;
if (!url) console.warn('DATABASE_URL_TEST is not set: skipping game integration tests');

const config = {
  databaseUrl: 'unused', adminPassword: 'pw', sessionSecret: 'sec', webOrigin: 'http://localhost:5173', port: 0,
};
// Correct answers: Q1 → 0, Q2 → 1, Q3 → 2. Every question has 5 seconds.
const quizInput = {
  title: 'Τεστ',
  timeLimitSec: 5,
  questions: [
    { text: 'Ερώτηση 1', options: ['Α', 'Β', 'Γ', 'Δ'], correctIndex: 0, timeLimitSec: null },
    { text: 'Ερώτηση 2', options: ['Α', 'Β', 'Γ', 'Δ'], correctIndex: 1, timeLimitSec: null },
    { text: 'Ερώτηση 3', options: ['Α', 'Β', 'Γ', 'Δ'], correctIndex: 2, timeLimitSec: null },
  ],
};
const CORRECT = [0, 1, 2];

type Ack = { ok: true; [k: string]: unknown } | { ok: false; error: string };

interface Client {
  socket: Socket;
  states: unknown[];
  last<T>(): T;
  removed: boolean;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function until(cond: () => boolean, timeoutMs = 10_000, what = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await wait(20);
  }
}

describe.skipIf(!url)('realtime game', () => {
  const schema = `t_${randomBytes(6).toString('hex')}`;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let http: HttpServer;
  let io: Server;
  let timers: Timers;
  let service: GameService;
  let gateway: Gateway;
  let base: string;
  let gameId: string;
  let code: string;
  const clients: Client[] = [];
  const extraTimers: Timers[] = [];
  let host: Client;
  // teams[i] = the client of team number i+1, tokens[i] = its token
  const teams: Client[] = [];
  const tokens: string[] = [];
  // finalChoice[t][q] = last choice of team index t for question q (undefined = no answer)
  const finalChoice: (number | undefined)[][] = [];

  function client(opts: { adminToken?: string } = {}): Promise<Client> {
    const socket = connect(base, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...(opts.adminToken ? { auth: { adminToken: opts.adminToken } } : {}),
    });
    const c: Client = {
      socket,
      states: [],
      last<T>() {
        return this.states[this.states.length - 1] as T;
      },
      removed: false,
    };
    socket.on('game:state', (s) => c.states.push(s));
    socket.on('team:removed', () => {
      c.removed = true;
    });
    clients.push(c);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(c));
      socket.once('connect_error', reject);
    });
  }

  const ack = (c: Client, event: string, payload: unknown): Promise<Ack> =>
    c.socket.timeout(10_000).emitWithAck(event, payload) as Promise<Ack>;

  const hostStep = () => host.last<HostState>().step;
  const hostAction = (action: string, expectStep = hostStep()) =>
    ack(host, `host:${action}`, { gameId, expectStep });

  /** Wait until the host has seen a state that satisfies cond. */
  const hostSees = (cond: (s: HostState) => boolean, what: string, ms = 10_000) =>
    until(() => !!host.last<HostState>() && cond(host.last<HostState>()), ms, what);

  async function answer(t: number, q: number, choice: number): Promise<Ack> {
    const r = await ack(teams[t], 'team:answer', { questionIndex: q, choice });
    if (r.ok) {
      finalChoice[t] ??= [];
      finalChoice[t][q] = choice;
    }
    return r;
  }

  beforeAll(async () => {
    admin = createPool(url!);
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = createPool(url!, schema);
    await migrate(pool);
    const quiz = await createQuiz(pool, quizInput);
    const game = await createGame(pool, quiz);
    gameId = game.id;
    code = game.code;

    http = createServer();
    io = new Server(http, { cors: { origin: config.webOrigin } });
    timers = createTimers();
    service = new GameService({
      db: pool,
      timers,
      publish: (id) => gateway.publish(id),
      teamRemoved: (id, teamId) => gateway.teamRemoved(id, teamId),
    });
    gateway = attachSockets(io, service, config);
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.socket.disconnect();
    timers?.cancelAll();
    for (const t of extraTimers) t.cancelAll();
    await new Promise<void>((r) => (io ? io.close(() => r()) : r()));
    await pool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  it('host sockets need a valid admin token', async () => {
    const anon = await client();
    expect(await ack(anon, 'host:watch', { gameId })).toEqual({ ok: false, error: 'UNAUTHORIZED' });
    expect(await ack(anon, 'host:start', { gameId, expectStep: 0 })).toEqual({ ok: false, error: 'UNAUTHORIZED' });
    const forged = await client({ adminToken: 'abc.def' });
    expect(await ack(forged, 'host:watch', { gameId })).toEqual({ ok: false, error: 'UNAUTHORIZED' });

    host = await client({ adminToken: signAdminToken(config.sessionSecret, Date.now()) });
    expect(await ack(host, 'host:watch', { gameId })).toEqual({ ok: true });
    await hostSees((s) => s.status === 'lobby', 'lobby state');
    expect(host.last<HostState>()).toMatchObject({ role: 'host', code, step: 0, teams: [] });
  });

  it('validates payloads and unknown codes', async () => {
    const c = await client();
    expect(await ack(c, 'team:join', { code: 'abc', name: 'X' })).toEqual({ ok: false, error: 'INVALID' });
    const other = code === '999999' ? '999998' : '999999';
    expect(await ack(c, 'team:join', { code: other, name: 'X' })).toEqual({ ok: false, error: 'GAME_NOT_FOUND' });
    expect(await ack(c, 'team:resume', { token: 'nope' })).toEqual({ ok: false, error: 'BAD_TOKEN' });
    expect(await ack(c, 'team:answer', { questionIndex: 0, choice: 0 })).toEqual({ ok: false, error: 'BAD_TOKEN' });
    expect(await ack(host, 'host:start', { gameId, expectStep: 'x' })).toEqual({ ok: false, error: 'INVALID' });
    expect(await ack(host, 'host:watch', { gameId: 'not-a-uuid' })).toEqual({ ok: false, error: 'GAME_NOT_FOUND' });
  });

  it('29 teams join the lobby; a duplicate name is refused', async () => {
    for (let i = 0; i < 29; i++) teams.push(await client());
    const results = await Promise.all(
      teams.map((c, i) => ack(c, 'team:join', { code, name: `Ομάδα ${i + 1}` })),
    );
    for (const r of results) {
      expect(r.ok).toBe(true);
      tokens.push((r as unknown as { token: string }).token);
    }
    // every team got its own state right after joining
    await until(() => teams.every((c) => c.last<TeamState>()?.status === 'lobby'), 10_000, 'team lobby states');
    expect(teams[4].last<TeamState>()).toMatchObject({ role: 'team', teamName: 'Ομάδα 5', current: null });
    const dup = await client();
    expect(await ack(dup, 'team:join', { code, name: 'ΟΜΑΔΑ 5' })).toEqual({ ok: false, error: 'NAME_TAKEN' });
    await hostSees((s) => s.teams.length === 29, '29 teams on host');
  });

  it('question 1: every team answers and changes its answer once; team 7 resumes', async () => {
    expect(await hostAction('start')).toEqual({ ok: true });
    await hostSees((s) => s.status === 'question_open' && s.current?.index === 0, 'question 1 open');
    const s = host.last<HostState>();
    expect(s.current!.endsAt - s.serverNow).toBeGreaterThan(4_000);
    expect(s.current!.endsAt - s.serverNow).toBeLessThanOrEqual(5_000);

    // first answer: wrong (3); then change: correct for odd team numbers, wrong (1) for even ones
    const first = await Promise.all(teams.map((_, t) => answer(t, 0, 3)));
    expect(first.every((r) => r.ok)).toBe(true);
    const second = await Promise.all(teams.map((_, t) => answer(t, 0, t % 2 === 0 ? 0 : 1)));
    expect(second.every((r) => r.ok)).toBe(true);
    await hostSees((h) => h.answeredCount === 29, 'answeredCount 29');

    // answering another question than the current one is refused
    expect(await ack(teams[0], 'team:answer', { questionIndex: 1, choice: 0 })).toEqual({ ok: false, error: 'INVALID' });
    expect(await ack(teams[0], 'team:answer', { questionIndex: 0, choice: 9 })).toEqual({ ok: false, error: 'INVALID' });

    // team 7 drops its connection and resumes on a new socket
    teams[6].socket.disconnect();
    const again = await client();
    const r = await ack(again, 'team:resume', { token: tokens[6] });
    expect(r.ok).toBe(true);
    const state = (r as unknown as { state: TeamState }).state;
    expect(state.current?.myChoice).toBe(finalChoice[6][0]);
    await until(() => again.last<TeamState>()?.current?.myChoice === finalChoice[6][0], 5_000, 'resume state');
    teams[6] = again;

    expect(await hostAction('close')).toEqual({ ok: true });
    await hostSees((h) => h.status === 'question_closed', 'question 1 closed');
    expect(await answer(0, 0, 0)).toEqual({ ok: false, error: 'TIME_UP' });
  });

  it("host 'next' twice with the same expectStep: the second is STALE", async () => {
    const step = hostStep();
    const [a, b] = await Promise.all([hostAction('next', step), hostAction('next', step)]);
    expect([a, b]).toContainEqual({ ok: true });
    expect([a, b]).toContainEqual({ ok: false, error: 'STALE' });
    await hostSees((h) => h.status === 'question_open' && h.current?.index === 1, 'question 2 open');
    expect(host.last<HostState>().step).toBe(step + 1);
  });

  it('question 2: a late team joins, team 12 is removed, a new service recovers the timer', async () => {
    // team 30 joins in the middle of the game
    const late = await client();
    const j = await ack(late, 'team:join', { code, name: 'Ομάδα 30' });
    expect(j.ok).toBe(true);
    teams.push(late);
    tokens.push((j as unknown as { token: string }).token);
    await until(() => late.last<TeamState>()?.current?.index === 1, 5_000, 'late team sees question 2');

    // everybody answers question 2: correct for team numbers divisible by 3
    const res = await Promise.all(teams.map((_, t) => answer(t, 1, (t + 1) % 3 === 0 ? 1 : 2)));
    expect(res.every((r) => r.ok)).toBe(true);

    // remove team 12 (index 11)
    const team12Id = host.last<HostState>().teams.find((t) => t.name === 'Ομάδα 12')!.id;
    expect(await ack(host, 'host:remove-team', { gameId, teamId: team12Id })).toEqual({ ok: true });
    await until(() => teams[11].removed, 5_000, 'team:removed event');
    await hostSees((h) => !h.teams.some((t) => t.id === team12Id) && h.teams.length === 29, 'team 12 gone');
    expect(await ack(teams[11], 'team:answer', { questionIndex: 1, choice: 1 })).toEqual({
      ok: false,
      error: 'TEAM_REMOVED',
    });
    const again = await client();
    expect(await ack(again, 'team:resume', { token: tokens[11] })).toEqual({ ok: false, error: 'TEAM_REMOVED' });
    const removedStates = teams[11].states.length;

    // the server "restarts": the old timer is lost, a new service over the same DB recovers it
    timers.cancel(gameId);
    const endsAt = (await loadGame(pool, gameId))!.questionEndsAt!;
    const timers2 = createTimers();
    extraTimers.push(timers2);
    const service2 = new GameService({
      db: pool,
      timers: timers2,
      publish: (id) => gateway.publish(id),
      teamRemoved: (id, teamId) => gateway.teamRemoved(id, teamId),
    });
    await service2.recover();
    expect(Date.now()).toBeLessThan(endsAt);
    await hostSees((h) => h.status === 'question_closed', 'question 2 closed by the recovered timer', 10_000);
    const closedAt = Date.now();
    expect(closedAt).toBeGreaterThanOrEqual(endsAt + ANSWER_GRACE_MS);
    expect(closedAt).toBeLessThan(endsAt + ANSWER_GRACE_MS + 1_500);
    expect((await loadGame(pool, gameId))!.status).toBe('question_closed');
    expect(teams[11].states.length).toBe(removedStates);
  });

  it('question 3, results, and joining while revealing is GAME_OVER', async () => {
    expect(await hostAction('next')).toEqual({ ok: true });
    await hostSees((h) => h.status === 'question_open' && h.current?.index === 2, 'question 3 open');
    // correct for the first 10 team numbers (team 12 is removed and cannot answer)
    const res = await Promise.all(
      teams.map((_, t) => (t === 11 ? Promise.resolve({ ok: true } as Ack) : answer(t, 2, t < 10 ? 2 : 0))),
    );
    expect(res.every((r) => r.ok)).toBe(true);
    expect(await hostAction('results')).toEqual({ ok: false, error: 'INVALID' });
    expect(await hostAction('close')).toEqual({ ok: true });
    await hostSees((h) => h.status === 'question_closed', 'question 3 closed');
    expect(await hostAction('results')).toEqual({ ok: true });
    await hostSees((h) => h.status === 'revealing', 'revealing');

    const c = await client();
    expect(await ack(c, 'team:join', { code, name: 'Αργοπορημένοι' })).toEqual({ ok: false, error: 'GAME_OVER' });
    const anyTeamId = host.last<HostState>().teams[0].id;
    expect(await ack(host, 'host:remove-team', { gameId, teamId: anyTeamId })).toEqual({
      ok: false,
      error: 'INVALID',
    });
    await until(() => teams[0].last<TeamState>()?.status === 'revealing', 5_000, 'team sees revealing');
    expect(teams[0].last<TeamState>()).toMatchObject({ current: null, results: null });
  });

  it('reveal to the end: every team gets results with the right place; no correctIndex before finished', async () => {
    const Q = quizInput.questions.length;
    const T = 29;
    for (let i = 0; i < Q + T - 1; i++) {
      expect(host.last<HostState>().status).toBe('revealing');
      const step = hostStep();
      expect(await hostAction('reveal-next', step)).toEqual({ ok: true });
      await hostSees((h) => h.step === step + 1, `reveal step ${i + 1}`);
    }
    expect(host.last<HostState>().status).toBe('finished');
    expect(await hostAction('reveal-next')).toEqual({ ok: false, error: 'INVALID' });

    const active = teams.map((_, t) => t).filter((t) => t !== 11);
    await until(
      () => active.every((t) => teams[t].last<TeamState>()?.status === 'finished'),
      10_000,
      'all teams finished',
    );

    // no team ever saw a correct answer before the end
    for (const c of teams) {
      for (const s of c.states as TeamState[]) {
        if (s.status !== 'finished') expect(JSON.stringify(s)).not.toContain('correctIndex');
      }
    }

    // expected scores and places (standard competition ranking)
    const score = (t: number) =>
      CORRECT.reduce((sum, ok, q) => sum + (finalChoice[t]?.[q] === ok ? 1 : 0), 0);
    const placeOf = (t: number) => 1 + active.filter((o) => score(o) > score(t)).length;
    for (const t of active) {
      const s = teams[t].last<TeamState>();
      expect(s.results, `results of team ${t + 1}`).not.toBeNull();
      expect(s.results!.me).toMatchObject({ name: `Ομάδα ${t + 1}`, score: score(t), rank: placeOf(t) });
      expect(s.results!.ranking).toHaveLength(29);
      expect(s.results!.ranking.some((r) => r.name === 'Ομάδα 12')).toBe(false);
      expect(s.results!.review.map((r) => r.correctIndex)).toEqual(CORRECT);
    }

    // the late team got 0 for question 1 and is ranked normally
    const late = teams[29].last<TeamState>();
    expect(late.results!.review[0].myChoice).toBeNull();
    expect(late.results!.me.score).toBe(score(29));
    expect(late.results!.ranking.some((r) => r.name === 'Ομάδα 30')).toBe(true);

    // the removed team never received a finished state
    expect((teams[11].states as TeamState[]).some((s) => s.status === 'finished')).toBe(false);

    const hs = host.last<HostState>();
    expect(hs.reveal!.finished).toBe(true);
    expect(hs.reveal!.ranking).toHaveLength(29);
    expect(JSON.stringify(hs)).not.toContain('myChoice');
  });

  it('cancel stops the timer of an open question', async () => {
    const quiz = await createQuiz(pool, quizInput);
    const g = await createGame(pool, quiz);
    await service.host('start', g.id, 0);
    await service.cancel(g.id);
    expect((await loadGame(pool, g.id))!.status).toBe('cancelled');
    await expect(service.cancel(g.id)).rejects.toThrow('INVALID');
    const c = await client();
    expect(await ack(c, 'team:join', { code: g.code, name: 'Χ' })).toEqual({ ok: false, error: 'GAME_OVER' });
  });
});
