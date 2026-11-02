import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'server/src/**/*.test.ts', 'web/src/lib/**/*.test.ts'],
  },
});
