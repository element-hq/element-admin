// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? [["github"], ["html"]] : "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",

    // Pinned so screenshots are reproducible wherever they are generated.
    // Without this, a machine in a different zone renders every date one day
    // off from the CI container's UTC and every baseline mismatches.
    timezoneId: "UTC",
    locale: "en-US",
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
    command: "pnpm serve --strictPort --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env["CI"],
  },
});
