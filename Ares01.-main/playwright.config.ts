import { defineConfig } from '@playwright/test';
const port = Number(process.env.ARES_TEST_PORT || 5176);
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  workers: 1,
  use: {
    actionTimeout: 30_000,
    screenshot: 'only-on-failure',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
