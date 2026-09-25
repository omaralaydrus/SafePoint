import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, timeout: 30000,
  use: { baseURL: 'http://localhost:3400', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } } }],
  webServer: { command: 'npm run dev', url: 'http://localhost:3400', reuseExistingServer: !process.env.CI, timeout: 90000 },
});
