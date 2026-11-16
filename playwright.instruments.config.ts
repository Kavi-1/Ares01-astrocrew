import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'instruments.spec.ts',
  timeout: 1_200_000,
  expect: { timeout: 45_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5201',
    actionTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5201 --strictPort',
    url: 'http://127.0.0.1:5201',
    reuseExistingServer: false,
  },
});
