import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPool } from './pool';

describe('createPool', () => {
  afterEach(() => vi.restoreAllMocks());

  it('survives an error from an idle client instead of crashing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pool = createPool('postgres://u:p@localhost:5432/db');
    expect(() => pool.emit('error', new Error('idle client dropped'))).not.toThrow();
    expect(log).toHaveBeenCalled();
    await pool.end();
  });
});
