import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'mobility.spec.ts',
  timeout: 600_000,
  expect: { timeout: 45_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5198',
    actionTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 5198 --strictPort',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: false,
  },
});
