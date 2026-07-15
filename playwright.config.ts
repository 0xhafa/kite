import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.KITE_E2E_PORT ?? "4173";
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${e2ePort}`,
    env: {
      AI_PROVIDER: "mock",
      DATABASE_URL: `file:.data/kite-e2e-${e2ePort}.db`,
      KITE_E2E: "1",
    },
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
