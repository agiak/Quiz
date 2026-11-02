import { ANSWER_GRACE_MS } from '../../../shared/constants';
import type { HostState, TeamState } from '../../../shared/types';
import {
  activeOpenGames,
  addTeam,
  codeWasUsed,
  findActiveByCode,
  listAnswers,
  listTeams,
  loadGame,
  removeTeam as removeTeamRow,
  saveGame,
  teamByToken,
  upsertAnswer,
} from '../db/games';
import type { Queryable } from '../db/pool';
import * as machine from '../game/machine';
import { GameError, type GameRecord } from '../game/model';
import { hostState, teamState } from '../game/snapshots';
import { withLock } from './lock';
import type { Timers } from './timers';

export type HostAction = 'start' | 'next' | 'close' | 'results' | 'reveal-next';

export interface GameServiceDeps {
  db: Queryable;
  timers: Timers;
  now?: () => number;
  /** Called after every change of a game; the socket layer sends fresh snapshots. */
  publish?: (gameId: string) => void;
  /** Called after a team has been removed by the host. */
  teamRemoved?: (gameId: string, teamId: string) => void;
}

export interface Snapshots {
  host: HostState;
  /** One entry per active (not removed) team. */
  teams: { teamId: string; state: TeamState }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOINABLE = new Set(['lobby', 'question_open', 'question_closed']);

/**
 * All game operations. Every mutation of one game runs under withLock(gameId):
 * load → pure transition → save → timer → publish.
 */
export class GameService {
  private readonly db: Queryable;
  private readonly timers: Timers;
  private readonly now: () => number;
  private readonly publish: (gameId: string) => void;
  private readonly onTeamRemoved: (gameId: string, teamId: string) => void;

  constructor(deps: GameServiceDeps) {
    this.db = deps.db;
    this.timers = deps.timers;
    this.now = deps.now ?? Date.now;
    this.publish = deps.publish ?? (() => {});
    this.onTeamRemoved = deps.teamRemoved ?? (() => {});
  }

  private async load(gameId: string): Promise<GameRecord> {
    const g = UUID.test(gameId) ? await loadGame(this.db, gameId) : null;
    if (!g) throw new GameError('GAME_NOT_FOUND');
    return g;
  }

  private scheduleClose(g: GameRecord): void {
    if (g.status !== 'question_open' || g.questionEndsAt === null || g.currentIndex === null) return;
    const index = g.currentIndex;
    this.timers.schedule(g.id, g.questionEndsAt + ANSWER_GRACE_MS, () => {
      this.closeByTimer(g.id, index).catch((e) => console.error(`Closing game ${g.id} failed:`, e));
    });
  }

  private closeByTimer(gameId: string, index: number): Promise<void> {
    return withLock(gameId, async () => {
      const g = await loadGame(this.db, gameId);
      if (!g || g.status !== 'question_open' || g.currentIndex !== index) return;
      await saveGame(this.db, machine.close(g, null));
      this.publish(gameId);
    });
  }

  async join(code: string, name: string): Promise<{ token: string; teamId: string; gameId: string }> {
    const found = await findActiveByCode(this.db, code);
    if (!found) throw new GameError((await codeWasUsed(this.db, code)) ? 'GAME_OVER' : 'GAME_NOT_FOUND');
    return withLock(found.id, async () => {
      const g = await this.load(found.id);
      if (!JOINABLE.has(g.status)) throw new GameError('GAME_OVER');
      const { team, token } = await addTeam(this.db, g.id, name);
      this.publish(g.id);
      return { token, teamId: team.id, gameId: g.id };
    });
  }

  /** Current state of the team with this token, plus the ids the socket layer needs. */
  async session(token: string): Promise<{ gameId: string; teamId: string; state: TeamState }> {
    const found = await teamByToken(this.db, token);
    if (!found) throw new GameError('BAD_TOKEN');
    return withLock(found.gameId, async () => {
      const again = await teamByToken(this.db, token);
      if (!again) throw new GameError('BAD_TOKEN');
      if (again.team.removed) throw new GameError('TEAM_REMOVED');
      const g = await loadGame(this.db, again.gameId);
      if (!g) throw new GameError('BAD_TOKEN');
      const [teams, answers] = await Promise.all([listTeams(this.db, g.id), listAnswers(this.db, g.id)]);
      return { gameId: g.id, teamId: again.team.id, state: teamState(g, again.team, answers, teams, this.now()) };
    });
  }

  async resume(token: string): Promise<TeamState> {
    return (await this.session(token)).state;
  }

  async answer(token: string, questionIndex: number, choice: number): Promise<void> {
    const found = await teamByToken(this.db, token);
    if (!found) throw new GameError('BAD_TOKEN');
    await withLock(found.gameId, async () => {
      const now = this.now();
      const again = await teamByToken(this.db, token);
      const g = await loadGame(this.db, found.gameId);
      if (!again || !g) throw new GameError('BAD_TOKEN');
      machine.checkAnswer(g, again.team, questionIndex, choice, now);
      await upsertAnswer(this.db, { gameId: g.id, teamId: again.team.id, questionIndex, choice });
      this.publish(g.id);
    });
  }

  async host(action: HostAction, gameId: string, expectStep: number): Promise<void> {
    await withLock(gameId, async () => {
      const g = await this.load(gameId);
      let n: GameRecord;
      switch (action) {
        case 'start':
          n = machine.start(g, this.now(), expectStep);
          break;
        case 'next':
          n = machine.next(g, this.now(), expectStep);
          break;
        case 'close':
          n = machine.close(g, expectStep);
          break;
        case 'results': {
          const teams = await listTeams(this.db, g.id);
          n = machine.beginResults(g, teams.filter((t) => !t.removed).length, expectStep);
          break;
        }
        case 'reveal-next':
          n = machine.revealNext(g, expectStep);
          break;
        default:
          throw new GameError('INVALID');
      }
      await saveGame(this.db, n);
      if (n.status === 'question_open') this.scheduleClose(n);
      else this.timers.cancel(n.id);
      this.publish(n.id);
    });
  }

  async removeTeam(gameId: string, teamId: string): Promise<void> {
    await withLock(gameId, async () => {
      const g = await this.load(gameId);
      if (!JOINABLE.has(g.status)) throw new GameError('INVALID');
      if (!UUID.test(teamId) || !(await removeTeamRow(this.db, g.id, teamId))) throw new GameError('INVALID');
      this.onTeamRemoved(g.id, teamId);
      this.publish(g.id);
    });
  }

  /** GameControl for the HTTP layer. */
  async cancel(gameId: string): Promise<void> {
    await withLock(gameId, async () => {
      const g = await this.load(gameId);
      await saveGame(this.db, machine.cancel(g));
      this.timers.cancel(g.id);
      this.publish(g.id);
    });
  }

  /** On boot: restore the closing timer of every open question (fires at once if already due). */
  async recover(): Promise<void> {
    for (const g of await activeOpenGames(this.db)) this.scheduleClose(g);
  }

  /** Host snapshot, or GAME_NOT_FOUND. */
  async hostSnapshot(gameId: string): Promise<HostState> {
    return (await this.snapshots(gameId, false)).host;
  }

  /** Fresh snapshots for the host and every active team, taken in lock order. */
  snapshots(gameId: string, withTeams = true): Promise<Snapshots> {
    return withLock(gameId, async () => {
      const g = await this.load(gameId);
      const [teams, answers] = await Promise.all([listTeams(this.db, g.id), listAnswers(this.db, g.id)]);
      const now = this.now();
      return {
        host: hostState(g, teams, answers, now),
        teams: withTeams
          ? teams.filter((t) => !t.removed).map((t) => ({ teamId: t.id, state: teamState(g, t, answers, teams, now) }))
          : [],
      };
    });
  }
}
