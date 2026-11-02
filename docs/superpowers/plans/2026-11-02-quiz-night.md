# Κουίζ για ομάδες — Πλάνο υλοποίησης

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Online κουίζ όπου πολλές ομάδες απαντούν από κινητά σε ερωτήσεις που δείχνει ένας παρουσιαστής, με κατάταξη στο τέλος.

**Architecture:** Ο server (Node + Express + Socket.IO στο Render) είναι η μόνη πηγή αλήθειας. Η λογική του παιχνιδιού είναι καθαρές συναρτήσεις (`server/src/game/`) που δεν ξέρουν τίποτα για βάση ή sockets. Η υπηρεσία `GameService` φορτώνει από τη βάση (Neon Postgres), εφαρμόζει μια μετάπτωση, αποθηκεύει και στέλνει ένα στιγμιότυπο ανά ρόλο. Το web (React στο Vercel) απλώς αποδίδει τα στιγμιότυπα.

**Tech Stack:** TypeScript 5, Node 22, Express 4, Socket.IO 4, pg 8, zod 3, esbuild, React 18, Vite 5, React Router 6, socket.io-client 4, qrcode 1, vitest 2, supertest 7.

**Spec:** `docs/superpowers/specs/2026-11-02-quiz-night-design.md`

## Global Constraints

- Όλα τα κείμενα που βλέπει ο χρήστης στα ελληνικά, όπως στην §8 της προδιαγραφής.
- Χρόνος ερώτησης: ελάχιστο 5″, μέγιστο 300″, προεπιλογή 30″.
- Επιλογές ανά ερώτηση: 2 έως 4, ακριβώς μία σωστή.
- Περιθώριο απάντησης μετά τη λήξη: 500 ms.
- Όνομα ομάδας: 1–30 χαρακτήρες μετά το trim, μοναδικό μέσα στο παιχνίδι.
- Κωδικός παιχνιδιού: 6 ψηφία, 100000–999999.
- Token διαχειριστή: λήξη σε 12 ώρες.
- Το στιγμιότυπο αρχηγού δεν περιέχει ποτέ `correctIndex` πριν από `finished`. Το στιγμιότυπο παρουσιαστή δεν περιέχει ποτέ τι απάντησε κάθε ομάδα.
- Κανένα μυστικό στον κώδικα. Μόνο μεταβλητές περιβάλλοντος (§3 της προδιαγραφής).
- GitHub: αποθετήριο `agiak/quiz-night`, ιδιωτικό.

## Περιβάλλον εκτέλεσης

Δεν υπάρχει Node.js στον υπολογιστή. Κάθε εντολή `npm` (install, test, build) τρέχει σε ένα
**Vercel Sandbox** (`quiz-night-dev`, Node 22, φάκελος `/home/vercel-sandbox/app`). Τα αρχεία
συγχρονίζονται από τον τοπικό φάκελο με `write_session_files`: ένα tar.gz με ό,τι άλλαξε
(`git ls-files -m -o --exclude-standard | tar czf - -T - | base64 -w0`). Το `package-lock.json`
που παράγεται στο sandbox αντιγράφεται πίσω με `read_session_file` και μπαίνει στο git.
Τα integration tests χρησιμοποιούν το branch `test` του Neon μέσω `DATABASE_URL_TEST`.
Το GitHub Actions τρέχει `npm ci && npm test` σε κάθε push, ως δεύτερος έλεγχος.

## Review Focus

1. **Διπλό πάτημα «Επόμενη»** ή δύο ανοιχτές καρτέλες παρουσιαστή: δεν πρέπει να πηδηχτεί ερώτηση. Κάθε ενέργεια παρουσιαστή φέρει το `expectStep` που είδε, και ο server αγνοεί ενέργειες με παλιό βήμα. Test στο Task 3.
2. **Ρολόι κινητού λάθος κατά λεπτά:** το χρονόμετρο πρέπει να δείχνει σωστά. Χρησιμοποιείται διαφορά από το `serverNow`. Test στο Task 9.
3. **Ονόματα που διαφέρουν μόνο σε τόνους ή πεζά-κεφαλαία** («Αετοί», «ΑΕΤΟΙ», «αετοι»): λογίζονται ίδια. Test στο Task 2.
4. **Αφαίρεση ομάδας ενώ απαντά:** η απάντηση απορρίπτεται και η ομάδα δεν μπαίνει στην κατάταξη. Test στο Task 3 και στο Task 7.
5. **Αλλαγή κουίζ ενώ παίζεται:** το τρέχον παιχνίδι δεν επηρεάζεται, γιατί κρατά δικό του αντίγραφο ερωτήσεων. Test στο Task 5.

---

## Δομή αρχείων

```
package.json               npm workspaces: server, web · engines.node 22.x · scripts test/build
tsconfig.base.json
vitest.config.ts           unit tests σε shared/, server/src, web/src/lib
.github/workflows/ci.yml
shared/                    απλός φάκελος TS (όχι πακέτο), εισάγεται με σχετικές διαδρομές
  constants.ts  types.ts  schemas.ts  names.ts  errors.ts
server/
  package.json  build.mjs (esbuild bundle → dist/index.js)
  migrations/001_init.sql
  src/index.ts  src/config.ts
  src/game/  scoring.ts  machine.ts  snapshots.ts  model.ts
  src/db/    pool.ts  migrate.ts  quizzes.ts  games.ts
  src/http/  app.ts  auth.ts  routes.ts
  src/realtime/  service.ts  sockets.ts  timers.ts  lock.ts
  test/integration/  *.int.test.ts
web/
  package.json  vite.config.ts  vercel.json  index.html
  src/main.tsx  src/App.tsx  src/theme.css
  src/lib/  api.ts  socket.ts  clock.ts  storage.ts
  src/admin/  Login.tsx  QuizList.tsx  QuizEditor.tsx  Games.tsx
  src/host/   HostPage.tsx  Lobby.tsx  QuestionView.tsx  Reveal.tsx  Countdown.tsx
  src/play/   PlayPage.tsx  JoinForm.tsx  Answering.tsx  Finished.tsx
prototype/to-ekatommyrio.html   (το πρώτο κουίζ, μετακινείται εδώ)
```

---

### Task 1: Αποθετήριο, εργαλεία και sandbox

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`, `.github/workflows/ci.yml`, `server/package.json`, `web/package.json`, `shared/constants.ts`, `shared/constants.test.ts`
- Move: `to-ekatommyrio.html` → `prototype/to-ekatommyrio.html`

**Interfaces:**
- Produces: `shared/constants.ts` → `TIME_MIN_SEC = 5`, `TIME_MAX_SEC = 300`, `TIME_DEFAULT_SEC = 30`, `ANSWER_GRACE_MS = 500`, `NAME_MAX = 30`, `OPTIONS_MIN = 2`, `OPTIONS_MAX = 4`, `ADMIN_TOKEN_TTL_MS = 12 * 3600_000`. Root scripts: `npm test` (vitest run), `npm run test:int -w server`, `npm run build -w server`, `npm run build -w web`.

- [ ] **Step 1:** Δημιουργία του ιδιωτικού αποθετηρίου `agiak/quiz-night` στο GitHub (μέσω του in-app browser στο github.com/new, με τον λογαριασμό του χρήστη). `git remote add origin https://github.com/agiak/quiz-night.git`.
- [ ] **Step 2:** Γράψε τα αρχεία ρύθμισης και ένα test `constants.test.ts` που ελέγχει `TIME_MIN_SEC < TIME_DEFAULT_SEC < TIME_MAX_SEC`.
- [ ] **Step 3:** Δημιούργησε το sandbox `quiz-night-dev`, συγχρόνισε, τρέξε `npm install && npm test`.
  Expected: `1 passed`.
- [ ] **Step 4:** Φέρε πίσω το `package-lock.json`. Commit `chore: scaffold workspaces, CI and constants`, push.
  Expected: το CI στο GitHub περνά.

### Task 2: Κοινοί τύποι, σχήματα, ονόματα, σφάλματα

**Files:** Create `shared/types.ts`, `shared/schemas.ts`, `shared/names.ts`, `shared/errors.ts` · Test `shared/schemas.test.ts`, `shared/names.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  type GameStatus = 'lobby'|'question_open'|'question_closed'|'revealing'|'finished'|'cancelled';
  interface Question { text: string; options: string[]; correctIndex: number; timeLimitSec: number | null }
  interface Quiz { id: string; title: string; timeLimitSec: number; questions: Question[]; updatedAt: string }
  interface RankRow { teamId: string; name: string; score: number; rank: number }
  interface HostState { role: 'host'; gameId: string; status: GameStatus; code: string; quizTitle: string;
    questionCount: number; teams: { id: string; name: string }[]; step: number; serverNow: number;
    current: { index: number; text: string; options: string[]; endsAt: number } | null;
    answeredCount: number;
    reveal: { answers: { index: number; text: string; options: string[]; correctIndex: number }[];
              ranking: RankRow[]; finished: boolean } | null }
  interface TeamState { role: 'team'; status: GameStatus; teamName: string; questionCount: number; serverNow: number;
    current: { index: number; text: string; options: string[]; endsAt: number; myChoice: number | null } | null;
    results: { me: RankRow; ranking: RankRow[];
               review: { index: number; text: string; options: string[]; myChoice: number | null; correctIndex: number }[] } | null }
  ```
  `step` είναι ένας μετρητής που αυξάνει σε κάθε μετάπτωση (για το `expectStep`).
- Produces (`schemas.ts`): zod `quizInputSchema` (title 1–120, timeLimitSec, questions ≥ 1), `joinSchema {code: /^\d{6}$/, name}`, `answerSchema {questionIndex: int ≥ 0, choice: int 0..3}`, `hostActionSchema {gameId, expectStep: int}`.
- Produces (`names.ts`): `cleanTeamName(raw: string): string` (trim, συμπτύσσει κενά, NFC), `nameKey(name: string): string` (χωρίς τόνους/διαλυτικά, `toLocaleLowerCase('el')`, τελικό ς → σ).
- Produces (`errors.ts`): `type ErrorCode = 'GAME_NOT_FOUND'|'NAME_TAKEN'|'GAME_OVER'|'TIME_UP'|'TEAM_REMOVED'|'BAD_TOKEN'|'BAD_PASSWORD'|'UNAUTHORIZED'|'INVALID'|'STALE'`, `ERROR_TEXT: Record<ErrorCode, string>` με τα κείμενα της §8 (π.χ. `GAME_NOT_FOUND: 'Δεν βρέθηκε παιχνίδι με αυτόν τον κωδικό.'`).

- [ ] **Step 1: Tests**
  ```ts
  expect(nameKey('Αετοί')).toBe(nameKey('ΑΕΤΟΙ'));
  expect(nameKey('Αετοί')).toBe(nameKey('  αετοι '.trim()));
  expect(nameKey('Λύκος')).toBe(nameKey('ΛΥΚΟΣ'));
  expect(cleanTeamName('  Οι   Σοφοί  ')).toBe('Οι Σοφοί');
  expect(quizInputSchema.safeParse(validQuiz).success).toBe(true);
  // απορρίπτονται: 1 επιλογή, 5 επιλογές, correctIndex εκτός ορίων, κενή επιλογή, timeLimitSec 4 ή 301, κενό όνομα, όνομα 31 χαρ.
  ```
- [ ] **Step 2:** Τρέξε `npm test -- shared`. Expected: FAIL (λείπουν exports).
- [ ] **Step 3:** Υλοποίηση. Το `quizInputSchema` ελέγχει με `superRefine` ότι `correctIndex < options.length`.
- [ ] **Step 4:** Τρέξε `npm test -- shared`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(shared): protocol types, schemas, name keys, error texts`.

### Task 3: Μηχανή καταστάσεων και βαθμολογία (καθαρές συναρτήσεις)

**Files:** Create `server/src/game/model.ts`, `scoring.ts`, `machine.ts` · Test `scoring.test.ts`, `machine.test.ts`

**Interfaces:**
- Produces (`model.ts`):
  ```ts
  interface GameRecord { id: string; code: string; quizTitle: string; questions: Question[]; defaultTimeSec: number;
    status: GameStatus; step: number; currentIndex: number | null; questionEndsAt: number | null;
    revealStep: number | null; teamCountAtReveal: number | null }
  interface TeamRecord { id: string; name: string; joinedAt: number; removed: boolean }
  interface AnswerRecord { teamId: string; questionIndex: number; choice: number }
  class GameError extends Error { constructor(public code: ErrorCode) }
  ```
- Produces (`scoring.ts`): `rank(teams: TeamRecord[], answers: AnswerRecord[], questions: Question[]): RankRow[]`. Μόνο ενεργές ομάδες. Ταξινόμηση κατά πόντους φθίνουσα, μετά `name.localeCompare(b, 'el')`. Κοινή θέση: 1, 1, 3.
- Produces (`machine.ts`), όλες επιστρέφουν νέο `GameRecord` με `step + 1` ή πετούν `GameError('STALE' | 'INVALID')`:
  `start(g, now, expectStep)`, `next(g, now, expectStep)`, `close(g, expectStep | null)` (`null` από τον timer), `beginResults(g, activeTeams: number, expectStep)`, `revealNext(g, expectStep)`, `cancel(g)`.
  Επίσης `timeFor(g, i): number` (χρόνος ερώτησης ή του κουίζ) και `checkAnswer(g, team: TeamRecord, questionIndex, choice, now): void`, που πετά `TIME_UP`, `TEAM_REMOVED`, `INVALID`.
  Το `revealNext` περνά σε `finished` όταν το νέο βήμα είναι `lastRevealStep(Q, T) = T > 0 ? Q + T - 1 : Q`.

- [ ] **Step 1: Tests**
  ```ts
  // scoring
  expect(rank(teams3, answersTie, qs).map(r => r.rank)).toEqual([1, 1, 3]);
  expect(rank(withRemoved, answers, qs).find(r => r.teamId === removedId)).toBeUndefined();
  // απαντήσεις σε ερωτήσεις που η ομάδα δεν είδε (αργοπορημένη) απλώς λείπουν → 0 πόντοι
  // machine
  const g1 = start(lobby, 1000, 0);  expect(g1).toMatchObject({ status: 'question_open', currentIndex: 0, questionEndsAt: 1000 + 30_000, step: 1 });
  expect(() => next(g1, 2000, 0)).toThrow('STALE');           // διπλό πάτημα με παλιό βήμα
  expect(() => next(g1, 2000, 1)).toThrow('INVALID');         // δεν έχει κλείσει ακόμα
  expect(() => checkAnswer(g1, team, 0, 2, 1000 + 30_500)).not.toThrow();
  expect(() => checkAnswer(g1, team, 0, 2, 1000 + 30_501)).toThrow('TIME_UP');
  expect(() => checkAnswer(g1, removedTeam, 0, 2, 1500)).toThrow('TEAM_REMOVED');
  expect(() => checkAnswer(closed, team, 0, 2, 1500)).toThrow('TIME_UP');
  expect(() => beginResults(closedNotLast, 3, s)).toThrow('INVALID');
  // αποκάλυψη: Q=2, T=3 → βήματα 0,1 απαντήσεις, 2,3,4 κατάταξη, finished στο 4
  // T=0 → finished στο βήμα 2
  expect(timeFor(gWithOverride, 1)).toBe(60);
  ```
- [ ] **Step 2:** `npm test -- server/src/game`. Expected: FAIL.
- [ ] **Step 3:** Υλοποίηση.
- [ ] **Step 4:** `npm test -- server/src/game`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(server): game state machine and scoring`.

### Task 4: Στιγμιότυπα ανά ρόλο

**Files:** Create `server/src/game/snapshots.ts` · Test `snapshots.test.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 3 `rank`, `GameRecord`.
- Produces: `hostState(g, teams, answers, now): HostState`, `teamState(g, team, answers, teams, now): TeamState`.
  - `answeredCount` = ενεργές ομάδες με απάντηση στην τρέχουσα ερώτηση.
  - Στο `revealing`, `reveal.answers` = ερωτήσεις `0..min(revealStep, Q-1)`. `reveal.ranking` = οι τελευταίες `max(0, revealStep - Q + 1)` γραμμές της κατάταξης, σε σειρά κατάταξης.
  - `teamState.results` μόνο στο `finished`. `current.myChoice` = η τελευταία επιλογή της ομάδας.

- [ ] **Step 1: Tests**
  ```ts
  for (const s of ['lobby','question_open','question_closed','revealing'])
    expect(JSON.stringify(teamState(gameIn(s), team, answers, teams, now))).not.toMatch(/correctIndex/);
  expect(JSON.stringify(hostState(gOpen, teams, answers, now))).not.toMatch(/choice/i);
  expect(hostState(gOpen, teams, answers, now).answeredCount).toBe(2);
  expect(hostState(revealingAt(2), ...).reveal).toMatchObject({ answers: [{index:0},{index:1}], ranking: [{rank: 3}] });
  expect(teamState(finished, team, ...).results!.review[0]).toMatchObject({ myChoice: 1, correctIndex: 2 });
  expect(teamState(finished, team, ...).results!.ranking).toHaveLength(3);
  ```
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Υλοποίηση. **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `feat(server): role snapshots that never leak answers`.

### Task 5: Βάση: μεταπτώσεις και αποθετήρια

**Files:** Create `server/migrations/001_init.sql`, `server/src/db/pool.ts`, `migrate.ts`, `quizzes.ts`, `games.ts` · Test `server/test/integration/db.int.test.ts`

**Interfaces:**
- Schema όπως §4 της προδιαγραφής, με χρονοσφραγίδες σε `timestamptz` και επιπλέον στήλες `games.step INT`, `games.default_time_sec INT`, `games.team_count_at_reveal INT`, `teams.name_key TEXT` (από το `nameKey`). Partial unique index: `CREATE UNIQUE INDEX games_active_code ON games(code) WHERE status NOT IN ('finished','cancelled')`. Unique index `teams(game_id, name_key) WHERE removed_at IS NULL`.
- Produces:
  - `migrate(pool): Promise<void>` (πίνακας `schema_migrations`, εκτελεί τα `.sql` με αλφαβητική σειρά, το καθένα σε συναλλαγή).
  - `quizzes.ts`: `listQuizzes()`, `getQuiz(id)`, `createQuiz(input)`, `updateQuiz(id, input)`, `deleteQuiz(id)`.
  - `games.ts`: `createGame(quiz): Promise<GameRecord>` (αντίγραφο ερωτήσεων, τυχαίος κωδικός, επανάληψη έως 5 φορές σε σύγκρουση), `loadGame(id)`, `findActiveByCode(code)`, `saveGame(g)`, `listGames(kind: 'active'|'past')`, `addTeam(gameId, name): Promise<{team, token}>` (πετά `NAME_TAKEN` σε παραβίαση του unique), `teamByToken(token)`, `listTeams(gameId)`, `removeTeam(gameId, teamId)`, `upsertAnswer(a: AnswerRecord & {gameId})`, `listAnswers(gameId)`, `activeOpenGames()`.

- [ ] **Step 1:** Δημιούργησε στο Neon το έργο `quiz-night` (περιοχή Frankfurt) και το branch `test`. Βάλε το connection string του `test` ως `DATABASE_URL_TEST` στο sandbox.
- [ ] **Step 2: Tests** (κάθε τρέξιμο σε καινούριο schema `t_<random>` που σβήνεται στο τέλος)
  ```ts
  await migrate(pool); await migrate(pool);           // δεύτερη φορά δεν κάνει τίποτα
  const g = await createGame(quiz); await updateQuiz(quiz.id, changed);
  expect((await loadGame(g.id)).questions[0].text).toBe(quiz.questions[0].text);   // αντίγραφο
  await addTeam(g.id, 'Αετοί'); await expect(addTeam(g.id, 'ΑΕΤΟΙ')).rejects.toThrow('NAME_TAKEN');
  await upsertAnswer({..., choice: 1}); await upsertAnswer({..., choice: 3});
  expect(await listAnswers(g.id)).toEqual([expect.objectContaining({ choice: 3 })]);
  // findActiveByCode δεν βρίσκει finished/cancelled
  ```
- [ ] **Step 3:** `npm run test:int -w server`. Expected: FAIL. **Step 4:** Υλοποίηση. **Step 5:** Expected: PASS.
- [ ] **Step 6:** Commit `feat(server): postgres schema and repositories`.

### Task 6: HTTP API και αυθεντικοποίηση διαχειριστή

**Files:** Create `server/src/config.ts`, `server/src/http/auth.ts`, `routes.ts`, `app.ts` · Test `auth.test.ts`, `server/test/integration/http.int.test.ts`

**Interfaces:**
- Produces (`config.ts`): `loadConfig(env): { databaseUrl, adminPassword, sessionSecret, webOrigin, port }`. Πετά αν λείπει κάποιο.
- Produces (`auth.ts`): `signAdminToken(secret, now): string` (`base64url(JSON{exp}).hmacSha256`), `verifyAdminToken(secret, token, now): boolean`, `checkPassword(expected, given): boolean` (timingSafeEqual σε SHA-256 των δύο), `requireAdmin` middleware → 401 `{error:'UNAUTHORIZED'}`.
- Produces (`app.ts`): `createApp(deps: { config, db, service }): express.Express` με τις διαδρομές της §6, CORS μόνο για `webOrigin`, σφάλματα ως `{ error: ErrorCode }`.

- [ ] **Step 1: Tests**
  ```ts
  const t = signAdminToken('s', 0);
  expect(verifyAdminToken('s', t, 12*3600_000 - 1)).toBe(true);
  expect(verifyAdminToken('s', t, 12*3600_000 + 1)).toBe(false);
  expect(verifyAdminToken('x', t, 1)).toBe(false);
  // http (supertest): POST /api/admin/login λάθος → 401 BAD_PASSWORD · GET /api/quizzes χωρίς token → 401
  // CRUD κουίζ · POST /api/quizzes/:id/games σε κουίζ χωρίς ερωτήσεις → 400 INVALID · GET /health → 200 {ok:true}
  ```
- [ ] **Step 2:** Run both, expect FAIL. **Step 3:** Υλοποίηση. **Step 4:** Expect PASS.
- [ ] **Step 5:** Commit `feat(server): admin auth and REST API`.

### Task 7: Πραγματικός χρόνος: υπηρεσία, timers, sockets, ανάκαμψη

**Files:** Create `server/src/realtime/lock.ts`, `timers.ts`, `service.ts`, `sockets.ts`, `server/src/index.ts`, `server/build.mjs` · Test `lock.test.ts`, `timers.test.ts`, `server/test/integration/game.int.test.ts`

**Interfaces:**
- Produces: `withLock(key: string, fn: () => Promise<T>): Promise<T>` (σειριακή εκτέλεση ανά παιχνίδι). `Timers { schedule(gameId, at: number, fn), cancel(gameId) }`.
- Produces (`service.ts`): `class GameService` με `join(code, name) → {token}`, `resume(token) → TeamState`, `answer(token, questionIndex, choice)`, `host(action: 'start'|'next'|'close'|'results'|'reveal-next', gameId, expectStep)`, `removeTeam(gameId, teamId)`, `cancel(gameId)`, `recover()` (ξαναπρογραμματίζει τα `question_open`). Μετά από κάθε αλλαγή καλεί `publish(gameId)`.
  Ο timer κλεισίματος πυροδοτείται στο `questionEndsAt + ANSWER_GRACE_MS`.
- Produces (`sockets.ts`): `attachSockets(io, service, config)`. Rooms `host:<gameId>`, `team:<teamId>`. Μηνύματα της §6, με ack `{ ok: true, ... } | { ok: false, error: ErrorCode }`. Ο παρουσιαστής περνά `auth.adminToken` στη σύνδεση.
- `build.mjs`: esbuild `src/index.ts` → `dist/index.js`, `platform: node`, `format: esm`, `packages: 'external'`. Ο φάκελος `shared/` ενσωματώνεται επειδή εισάγεται με σχετική διαδρομή.

- [ ] **Step 1: Tests**
  ```ts
  // lock: δύο κλήσεις στο ίδιο κλειδί δεν επικαλύπτονται· σε διαφορετικά κλειδιά τρέχουν παράλληλα
  // timers (vi.useFakeTimers): cancel πριν τη λήξη → fn δεν καλείται
  // game.int (πραγματικός server σε τυχαία θύρα + socket.io-client + Neon test):
  //  30 ομάδες μπαίνουν· 3 ερωτήσεις με χρόνο 5″ (fake now μέσω injectable clock)· κάθε ομάδα αλλάζει απάντηση μία φορά
  //  η ομάδα 7 αποσυνδέεται και κάνει resume → βλέπει την ίδια myChoice
  //  νέο GameService στη μέση ερώτησης + recover() → η ερώτηση κλείνει στην ώρα της
  //  host 'next' δύο φορές με το ίδιο expectStep → η δεύτερη επιστρέφει STALE
  //  αφαίρεση ομάδας 12 → η απάντησή της επιστρέφει TEAM_REMOVED· δεν εμφανίζεται στην κατάταξη
  //  αποκάλυψη ως το τέλος → κάθε ομάδα λαμβάνει results με σωστή θέση· πριν το finished καμία δεν λαμβάνει correctIndex
  //  μια ομάδα μπαίνει στη 2η ερώτηση → παίρνει 0 στην 1η και μπαίνει κανονικά στην κατάταξη
  //  join σε revealing → GAME_OVER
  ```
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Υλοποίηση (`GameService` δέχεται `now: () => number` για τα tests). **Step 4:** Expect PASS.
- [ ] **Step 5:** `npm run build -w server && node server/dist/index.js` στο sandbox με τις μεταβλητές του test. Expected: `GET /health` → 200.
- [ ] **Step 6:** Commit `feat(server): realtime game service with recovery`.

### Task 8: Δημοσίευση του server (Render + Neon)

**Files:** Create `render.yaml` (τεκμηρίωση ρυθμίσεων) · Modify `README.md`

- [ ] **Step 1:** Neon: connection string του κύριου branch του έργου `quiz-night`.
- [ ] **Step 2:** Render: web service `quiz-night-server` από το `agiak/quiz-night`, branch `main`, περιοχή Frankfurt, πλάνο free, Node 22. Build: `npm ci && npm run build -w server`. Start: `node server/dist/index.js`. Health check `/health`. Μεταβλητές: `DATABASE_URL`, `ADMIN_PASSWORD` (τον ορίζει ο χρήστης), `SESSION_SECRET` (τυχαίο 32 bytes), `WEB_ORIGIN` (συμπληρώνεται στο Task 12). Αν το Render δεν έχει πρόσβαση στο αποθετήριο, ο χρήστης εγκαθιστά το GitHub app του Render στον `agiak`.
- [ ] **Step 3:** Expected: το deploy περνά και το `https://quiz-night-server.onrender.com/health` απαντά `{"ok":true}` στον browser.
- [ ] **Step 4:** Commit `chore: render config and readme`.

### Task 9: Βάση του web: routing, API, socket, ρολόι, θέμα

**Files:** Create `web/index.html`, `vite.config.ts`, `vercel.json` (rewrite όλων σε `/index.html`), `src/main.tsx`, `src/App.tsx`, `src/theme.css`, `src/lib/api.ts`, `socket.ts`, `clock.ts`, `storage.ts` · Test `src/lib/clock.test.ts`

**Interfaces:**
- Produces: `api(path, { method?, body?, admin? }): Promise<T>` (πετά `ApiError(code)`). `useGameSocket<S>(opts): { state: S | null; connected: boolean; emit(event, payload): Promise<Ack> }`, με αυτόματη επανασύνδεση και κλήση `onConnect` (για `team:resume` / `host:watch`). `serverOffset(serverNow, localNow): number`, `remainingMs(endsAt, offset, localNow): number` (ποτέ αρνητικό). `storage.get/set/remove` με try/catch. Διαδρομές: `/admin/*`, `/host/:gameId`, `/play`.
- `theme.css`: tokens του πρώτου κουίζ (`--ink`, `--stage`, `--line`, `--brass`, `--ok`, `--bad`, γραμματοσειρές Advent Pro + Commissioner).

- [ ] **Step 1: Tests**
  ```ts
  const off = serverOffset(1_000_000, 1_000_000 - 180_000);           // ρολόι κινητού 3′ πίσω
  expect(remainingMs(1_000_000 + 30_000, off, 1_000_000 - 180_000 + 10_000)).toBe(20_000);
  expect(remainingMs(0, 0, 5)).toBe(0);
  ```
- [ ] **Step 2:** Run, expect FAIL. **Step 3:** Υλοποίηση. **Step 4:** Expect PASS. `npm run build -w web` περνά.
- [ ] **Step 5:** Commit `feat(web): app shell, api, socket and clock sync`.

### Task 10: Οθόνη αρχηγού `/play`

**Files:** Create `src/play/PlayPage.tsx`, `JoinForm.tsx`, `Answering.tsx`, `Finished.tsx`

**Interfaces:**
- Consumes: `TeamState`, `useGameSocket`, `remainingMs`, `ERROR_TEXT`, `storage` key `quiz.teamToken`.
- Συμπεριφορά ανά κατάσταση, ακριβώς όπως η §7 της προδιαγραφής: φόρμα (κωδικός από `?code=`), «Η ομάδα σας μπήκε. Περιμένετε να ξεκινήσει το παιχνίδι», ερώτηση με κουμπιά Α–Δ και «Μπορείτε να την αλλάξετε ως τη λήξη», «Η απάντησή σας καταχωρήθηκε» / «Δεν απαντήσατε», «Κοιτάξτε την κεντρική οθόνη», αποτελέσματα. `BAD_TOKEN` ή `TEAM_REMOVED` → σβήσιμο token και αντίστοιχο μήνυμα. Χωρίς σύνδεση: «Σύνδεση με τον server…».

- [ ] **Step 1:** Υλοποίηση. `npm run build -w web` περνά.
- [ ] **Step 2:** Commit `feat(web): captain screen`.

### Task 11: Διαχείριση `/admin` και οθόνη παρουσιαστή `/host/:gameId`

**Files:** Create `src/admin/*.tsx`, `src/host/*.tsx`

**Interfaces:**
- Consumes: REST της §6, `HostState`, `qrcode.toDataURL(`${location.origin}/play?code=${code}`)`, storage key `quiz.adminToken`.
- Διαχείριση: σύνδεση, λίστα κουίζ, επεξεργαστής με έλεγχο μέσω `quizInputSchema` πριν την αποθήκευση και μηνύματα δίπλα στο πεδίο, «Νέο παιχνίδι» → `/host/:id`, ενεργά παιχνίδια (Συνέχεια, Ακύρωση με επιβεβαίωση μέσα στη σελίδα), παλιά παιχνίδια με κατάταξη. Κλήση `/health` μόλις ανοίξει.
- Παρουσιαστής: Lobby (κωδικός σε μορφή `482 913`, QR, διεύθυνση, ομάδες με αφαίρεση), QuestionView (κυκλικό `Countdown`, «Απάντησαν Χ από Υ», «Κλείσιμο τώρα»), Reveal (μία ερώτηση με τη σωστή απάντηση ανά βήμα, μετά η κατάταξη από κάτω προς τα πάνω, η 1η θέση μεγάλη). Κάθε κουμπί στέλνει `expectStep = state.step` και απενεργοποιείται μέχρι το ack. Πλήκτρο πλήρους οθόνης, πλήκτρο `→` / `Space` = επόμενο βήμα.

- [ ] **Step 1:** Υλοποίηση διαχείρισης. **Step 2:** Υλοποίηση παρουσιαστή. `npm run build -w web` περνά.
- [ ] **Step 3:** Commit `feat(web): admin and host screens`.

### Task 12: Δημοσίευση web (Vercel) και δοκιμή στον browser

- [ ] **Step 1:** Vercel: έργο `quiz-night` από το `agiak/quiz-night`, Root Directory `web`, framework Vite, `VITE_SERVER_URL=https://quiz-night-server.onrender.com`. Αν η εγκατάσταση δεν γίνει από τη ρίζα των workspaces, `installCommand: cd .. && npm ci`.
- [ ] **Step 2:** Render: `WEB_ORIGIN` = η διεύθυνση του Vercel, νέο deploy.
- [ ] **Step 3: Δοκιμή στον browser.** Στο in-app browser: σύνδεση στη διαχείριση, κουίζ 3 ερωτήσεων (μία με δικό της χρόνο), νέο παιχνίδι. Σε δεύτερη και τρίτη καρτέλα, σε μέγεθος κινητού, δύο ομάδες μπαίνουν από τον σύνδεσμο του QR. Expected:
  - η μία αλλάζει απάντηση, η άλλη αφήνει μια ερώτηση αναπάντητη·
  - ανανέωση της καρτέλας ενός αρχηγού στη μέση ερώτησης → επιστρέφει με την ίδια επιλογή·
  - στην αποκάλυψη τα κινητά δείχνουν «Κοιτάξτε την κεντρική οθόνη»·
  - μετά την 1η θέση τα κινητά δείχνουν θέση, πόντους και τις δικές τους απαντήσεις·
  - το παιχνίδι εμφανίζεται στα παλιά παιχνίδια με την ίδια κατάταξη.
- [ ] **Step 4:** Commit και push των τελευταίων διορθώσεων. Ενημέρωση `README.md` με τις διευθύνσεις.
