import { defineConfig } from 'vitest/config';

import { resolveBase } from './src/utils/paths.ts';

// The site is served from a GitHub Pages project subpath in production and from
// the domain root during development. `resolveBase` derives the right value from
// the environment (see src/utils/paths.ts), so the repository name is never
// hard-coded here and `npm run dev` keeps working at '/'.
const base = resolveBase(process.env);

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    // Phaser is large; the default 500 kB warning would fire on every build and
    // train us to ignore it. Raised so the warning stays meaningful.
    chunkSizeWarningLimit: 1600,
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
  test: {
    // Foundation and gameplay logic are deliberately free of Phaser and DOM
    // dependencies, so the fast Node environment is all the tests need.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
