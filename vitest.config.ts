import { defineConfig } from 'vitest/config'

// One root run covers every workspace, so CI produces a single lcov report for SonarCloud.
export default defineConfig({
  test: {
    projects: ['packages/shared', 'apps/api', 'apps/web'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['{apps,packages}/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'apps/web/src/components/ui/**',
        'apps/web/src/main.tsx',
        'apps/api/src/server.ts',
        'apps/api/src/cli/**',
        'apps/api/src/testing/**',
      ],
    },
  },
})
