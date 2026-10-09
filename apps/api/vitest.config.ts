import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // PGlite compiles its WebAssembly on first use; on a busy CI runner that can take longer than
    // the 10 s default when several test files open a database at once.
    hookTimeout: 30_000,
  },
})
