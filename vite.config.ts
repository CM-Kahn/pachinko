import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the same build works at any path (GitHub Pages serves from /<repo>/).
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  test: { include: ['src/**/*.test.ts'] },
});
