// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { DEFAULT_USERS, SYNAPSE_VERSION, userId } from "../mocks/fixtures";
import { usersList } from "../mocks/mas";
import { expect, test } from "../mocks/test";

/**
 * Visual regression baselines, one test per distinct layout rather than one per
 * route. The `@screenshot` tag is what runs a test in all six projects (desktop
 * / tablet / mobile × light / dark), so each one costs six images. Determinism
 * rests on fixed fixtures with absolute timestamps plus the timezone and locale
 * pinned in `playwright.config.ts`. `tests/README.md` has the recipe for
 * regenerating the baselines.
 */

const shot = { tag: "@screenshot" } as const;

/**
 * The query-heaviest pages chain several dependent requests per row, which
 * intermittently takes longer than Playwright's 5s default.
 */
const READY = { timeout: 20_000 } as const;

test("login page", shot, async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible(
    READY,
  );
  await expect(page).toHaveScreenshot();
});

test.describe("console", () => {
  /**
   * WebKit enforces CORS on the responses Playwright fulfils, so the mocks for
   * Synapse and MAS — which the app discovers on other origins — fail there and
   * the console renders degraded: no ESS tiles, no rows, `/devices` gated off
   * as Not Found. The tablet and mobile projects use `iPad` / `iPhone 15`
   * descriptors, which default to WebKit. Lifting this needs
   * `Access-Control-Allow-Origin` on the mocked responses plus a preflight
   * handler for the `Authorization` header.
   */
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The cross-origin mocks fail CORS in WebKit.",
  );

  test("dashboard", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto("/");
    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible(
      READY,
    );
    // Each tile is its own data boundary, resolving after the heading.
    await expect(page.getByText(SYNAPSE_VERSION)).toBeVisible(READY);
    await expect(page).toHaveScreenshot();
  });

  test("users list", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto("/users");
    await expect(page.getByRole("heading", heading("Users"))).toBeVisible(
      READY,
    );
    // Display names come from a per-row Matrix profile query.
    await expect(page.getByText("Alice", { exact: true })).toBeVisible(READY);
    await expect(page).toHaveScreenshot();
  });

  test("user detail drawer", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto(`/users/${userId(DEFAULT_USERS, 1)}`);
    const deactivate = page.getByRole("button", {
      name: "Deactivate account",
    });
    await expect(deactivate).toBeVisible(READY);
    // The display name arrives with the profile query, after the drawer, and
    // the list row behind the drawer carries it too.
    await expect(
      drawer(page, deactivate).getByText("Alice", { exact: true }),
    ).toBeVisible(READY);
    await expect(page).toHaveScreenshot();
  });

  test("rooms list", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto("/rooms");
    await expect(page.getByRole("heading", heading("Rooms"))).toBeVisible(
      READY,
    );
    // Row avatars and display names come from a per-room detail query.
    await expect(page.getByText("General", { exact: true })).toBeVisible(READY);
    await expect(page).toHaveScreenshot();
  });

  test("user devices list", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto("/devices/user");
    await expect(
      page.getByRole("heading", heading("User devices")),
    ).toBeVisible(READY);
    // The Application and User columns resolve a client and a user per row,
    // well after the table renders.
    await expect(page.getByText("Element Web", { exact: true })).toBeVisible(
      READY,
    );
    await expect(page.getByText("Alice's laptop")).toBeVisible(READY);
    await expect(page).toHaveScreenshot();
  });

  test("federation known domains", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto("/federation/known-domains");
    await expect(page.getByRole("heading", heading("Federation"))).toBeVisible(
      READY,
    );
    await expect(page.getByText("matrix.org", { exact: true })).toBeVisible(
      READY,
    );
    await expect(page).toHaveScreenshot();
  });

  test("registration tokens list", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto("/registration-tokens");
    await expect(
      page.getByRole("heading", heading("Registration tokens")),
    ).toBeVisible(READY);
    await expect(page.getByText("welcome-2026")).toBeVisible(READY);
    await expect(page).toHaveScreenshot();
  });

  // The body of this page is chosen by the ESS edition, and the default
  // deployment is Pro.
  test("auditing", shot, async ({ page }) => {
    await loginAs(page);
    await page.goto("/auditing");
    await expect(
      page.getByRole("heading", { name: "Auditing", exact: true, level: 1 }),
    ).toBeVisible(READY);
    await expect(page).toHaveScreenshot();
  });

  test("empty users list", shot, async ({ page, network }) => {
    network.use(usersList([]));
    await loginAs(page);
    await page.goto("/users");
    await expect(page.getByText("No users", { exact: true })).toBeVisible(
      READY,
    );
    await expect(page).toHaveScreenshot();
  });
});
