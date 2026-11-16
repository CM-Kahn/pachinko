import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // The test browser draws with software rendering, which is slow on big screens and on
  // the small machines GitHub provides, so be patient and don't run tests side by side there.
  timeout: 180_000,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    browserName: 'chromium',
    trace: 'off',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 1366 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
