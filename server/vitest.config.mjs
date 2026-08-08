import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Every file wipes the shared test database between tests, so they must not
    // run concurrently.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.js'],
  },
});
