import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "html",
  use: {
    baseURL: process.env["BASE_URL"] || "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },

  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",

  projects: [
    {
      name: "desktop-light",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "desktop-dark",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
      grep: /@screenshot/,
    },
    {
      name: "tablet-light",
      use: { ...devices["iPad (gen 11) landscape"], colorScheme: "light" },
      grep: /@screenshot/,
    },
    {
      name: "tablet-dark",
      use: { ...devices["iPad (gen 11) landscape"], colorScheme: "dark" },
      grep: /@screenshot/,
    },
    {
      name: "mobile-light",
      use: { ...devices["iPhone 15"], colorScheme: "light" },
      grep: /@screenshot/,
    },
    {
      name: "mobile-dark",
      use: { ...devices["iPhone 15"], colorScheme: "dark" },
      grep: /@screenshot/,
    },
  ],

  webServer: {
    command: "pnpx serve -L -l 4173 dist",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env["CI"],
  },
});
