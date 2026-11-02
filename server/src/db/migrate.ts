import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { withTx, type Queryable } from './pool';

/**
 * Default folder: server/migrations, found relative to this module. From
 * server/src/db/ (tests) it is ../../migrations/, from the bundle server/dist/ it is ../migrations/.
 */
function defaultDir(): URL {
  const fromSrc = new URL('../../migrations/', import.meta.url);
  return existsSync(fileURLToPath(fromSrc)) ? fromSrc : new URL('../migrations/', import.meta.url);
}

export async function migrate(db: Queryable, dir: URL | string = defaultDir()): Promise<void> {
  const path = (typeof dir === 'string' ? dir : fileURLToPath(dir)).replace(/[\\/]$/, '');
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const files = (await readdir(path)).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set(
    (await db.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  );
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = await readFile(`${path}/${f}`, 'utf8');
    await withTx(db, async (q) => {
      await q.query(sql);
      await q.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
    });
  }
}
