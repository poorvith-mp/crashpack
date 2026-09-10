import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 10000,
    // Several integration files spawn runtime probes; bound process contention.
    maxWorkers: 2,
  },
});
