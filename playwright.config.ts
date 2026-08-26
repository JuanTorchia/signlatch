import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-browser",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      SIGNLATCH_DEMO_ENABLED: "false",
      SIGNLATCH_PUBLIC_SHOWCASE_ENABLED: "true",
    },
  },
});
