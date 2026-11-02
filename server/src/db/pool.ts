import pg from 'pg';

export type Queryable = Pick<pg.Pool, 'query'>;

/** When `schema` is given every connection of the pool uses it as search_path (tests). */
export function createPool(url: string, schema?: string): pg.Pool {
  return new pg.Pool({
    connectionString: url,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });
}

/** Run fn inside a transaction. Needs a Pool; anything else runs fn directly. */
export async function withTx<T>(db: Queryable, fn: (q: Queryable) => Promise<T>): Promise<T> {
  const maybePool = db as Partial<pg.Pool>;
  if (typeof maybePool.connect !== 'function') return fn(db);
  const client = await maybePool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
