import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3215",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    {
      name: "mobile-edge",
      use: {
        ...devices["Pixel 7"],
        channel: "msedge",
      },
    },
  ],
  webServer: [
    {
      command:
        ".\\.venv\\Scripts\\python -m uvicorn tests.e2e_server:app --host 127.0.0.1 --port 8012",
      cwd: "../backend",
      url: "http://127.0.0.1:8012/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3215",
      url: "http://127.0.0.1:3215",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        BACKEND_API_URL: "http://127.0.0.1:8012",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
