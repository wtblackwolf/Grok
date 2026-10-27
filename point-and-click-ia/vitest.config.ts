import { defineConfig } from 'vitest/config';

// Un seul runner pour tout le monorepo : shared, server et client.
export default defineConfig({
  test: {
    include: ['shared/test/**/*.test.ts', 'server/test/**/*.test.ts', 'client/test/**/*.test.ts'],
    environment: 'node',
  },
});
