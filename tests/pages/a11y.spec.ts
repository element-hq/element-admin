// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { ALLOWLIST_SUBTITLE, drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  ADMINBOT_PASSPHRASE,
  DEFAULT_DESTINATIONS,
  DEFAULT_OAUTH2_SESSIONS,
  DEFAULT_ROOMS,
  DEFAULT_USERS,
  oauth2SessionId,
  roomId,
  SYNAPSE_VERSION,
  userId,
} from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

/**
 * Axe scans of the logged-out login page and of every console page. Each scan is
 * guarded by an assertion that the page's own data rendered: the `h1` is inside
 * the pending component, next to an aria-hidden skeleton, so a scan that only
 * waited for the heading would be scanning a skeleton.
 *
 * Only `[data-floating-ui-portal]` is excluded: compound-web mounts tooltips
 * and menus outside the app tree. A page with open defects asserts the exact
 * rules it trips, with a comment on the cause: fixing one moves it out of the
 * expected list, and a new rule fails the scan like on any clean page.
 */

/**
 * Sorted `rule-id [impact] ×nodes` strings. The counts keep the assertion
 * sensitive to a new element tripping an already-expected rule; the offending
 * elements themselves are in the attached report, not the assertion, because
 * their selectors contain hashed CSS-module class names.
 */
const scanViolations = async (page: Page): Promise<string[]> => {
  const results = await new AxeBuilder({ page })
    .exclude("[data-floating-ui-portal]")
    .analyze();

  if (results.violations.length > 0) {
    await test.info().attach("axe-violations", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
  }

  return results.violations
    .map(
      (violation) =>
        `${violation.id} [${violation.impact}] ×${violation.nodes.length}`,
    )
    .toSorted();
};

test("finds no violations on the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();

  expect(await scanViolations(page)).toEqual([]);
});

test("finds no violations on the dashboard", async ({ page }) => {
  await loginAs(page);
  await page.goto("/");

  await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
  // Each tile is its own data boundary, resolving after the heading.
  await expect(page.getByText(SYNAPSE_VERSION)).toBeVisible();

  expect(await scanViolations(page)).toEqual([]);
});

test("finds no violations on the users list", async ({ page }) => {
  await loginAs(page);
  await page.goto("/users");

  await expect(page.getByRole("heading", heading("Users"))).toBeVisible();
  // Display names come from a per-row Matrix profile query.
  await expect(page.getByText("Alice", { exact: true })).toBeVisible();

  expect(await scanViolations(page)).toEqual([]);
});

// The selected list row behind the drawer puts secondary text on a subtle
// background at 4.17:1.
test("finds the known violations on the user detail drawer", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto(`/users/${userId(DEFAULT_USERS, 1)}`);

  await expect(page.getByRole("heading", heading("Users"))).toBeVisible();
  // The account actions exist only in the drawer, and only once the site
  // config resolved, so they are the guard.
  await expect(
    page.getByRole("button", { name: "Deactivate account" }),
  ).toBeVisible();
  // The display name arrives with the profile query, after the drawer.
  await expect(page.getByText("Alice", { exact: true }).first()).toBeVisible();

  expect(await scanViolations(page)).toEqual(["color-contrast [serious] ×2"]);
});

test("finds no violations on the rooms list", async ({ page }) => {
  await loginAs(page);
  await page.goto("/rooms");

  await expect(page.getByRole("heading", heading("Rooms"))).toBeVisible();
  // Row avatars and display names come from a per-room detail query.
  await expect(page.getByText("General", { exact: true })).toBeVisible();

  expect(await scanViolations(page)).toEqual([]);
});

// The selected list row behind the drawer fails contrast.
test("finds the known violations on the room detail drawer", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto(`/rooms/${encodeURIComponent(roomId(DEFAULT_ROOMS, 0))}`);

  await expect(page.getByRole("heading", heading("Rooms"))).toBeVisible();
  // A detail page is a drawer over its list, so the list heading alone is no
  // proof the drawer loaded.
  const roomPane = drawer(page, page.getByRole("button", { name: "Delete" }));
  await expect(
    roomPane.getByRole("heading", { name: "General", exact: true }),
  ).toBeVisible();

  expect(await scanViolations(page)).toEqual(["color-contrast [serious] ×1"]);
});

// compound-web's `NavItem` hardcodes `role="presentation"` on its list items,
// which is only valid inside a tablist — every page with sub-tabs trips axe's
// `list` rule.
test("finds the known violations on the user devices list", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto("/devices/user");

  await expect(
    page.getByRole("heading", heading("User devices")),
  ).toBeVisible();
  // The Application and User columns resolve a client and a user per row, well
  // after the table renders.
  await expect(page.getByText("Alice's laptop")).toBeVisible();
  await expect(page.getByText("Element Web").first()).toBeVisible();

  expect(await scanViolations(page)).toEqual(["list [serious] ×1"]);
});

// The sub-tab list items carry `role="presentation"` outside a tablist, and
// the selected list row behind the drawer fails contrast.
test("finds the known violations on the device detail drawer", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto(
    `/devices/user/${oauth2SessionId(DEFAULT_OAUTH2_SESSIONS, 0)}`,
  );

  await expect(
    page.getByRole("heading", heading("User devices")),
  ).toBeVisible();

  // The entity cards render their `<a>` immediately and suspend only its body,
  // so the drawer heading is no proof they resolved — and a card with a
  // suspended body is a focusable link with an empty accessible name. Naming
  // both links is the guard that the transient state is over.
  const deviceDrawer = drawer(
    page,
    page.getByRole("button", { name: "Remove device" }),
  );
  await expect(
    deviceDrawer.getByRole("heading", { name: "Alice's laptop", exact: true }),
  ).toBeVisible();
  await expect(deviceDrawer.getByRole("link", { name: /Alice/ })).toBeVisible();
  await expect(
    deviceDrawer.getByRole("link", { name: /Element Web/ }),
  ).toBeVisible();

  expect(await scanViolations(page)).toEqual([
    "color-contrast [serious] ×3",
    "list [serious] ×1",
  ]);
});

// Sub-tabs again: `role="presentation"` list items outside a tablist trip the
// `list` rule.
test("finds the known violations on the legacy devices list", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto("/devices/legacy");

  await expect(
    page.getByRole("heading", heading("Legacy devices")),
  ).toBeVisible();
  // The device name and the user cell are separate per-row queries.
  await expect(
    page.getByText("Riot on Android", { exact: true }),
  ).toBeVisible();

  expect(await scanViolations(page)).toEqual(["list [serious] ×1"]);
});

// Sub-tabs again: `role="presentation"` list items outside a tablist trip the
// `list` rule.
test("finds the known violations on the applications list", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto("/devices/applications");

  await expect(
    page.getByRole("heading", heading("Applications")),
  ).toBeVisible();
  await expect(page.getByText("Element Web", { exact: true })).toBeVisible();

  expect(await scanViolations(page)).toEqual(["list [serious] ×1"]);
});

// Sub-tabs again: `role="presentation"` list items outside a tablist trip the
// `list` rule.
test("finds the known violations on the federation known-domains tab", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto("/federation/known-domains");

  await expect(page.getByRole("heading", heading("Federation"))).toBeVisible();
  // Every federation route shares one page title, so the `h1` cannot tell the
  // tabs apart and the body has to be pinned instead.
  await expect(
    page.getByText(`${DEFAULT_DESTINATIONS.length} domains`),
  ).toBeVisible();
  await expect(page.getByText("matrix.org", { exact: true })).toBeVisible();

  expect(await scanViolations(page)).toEqual(["list [serious] ×1"]);
});

// Sub-tabs again: `role="presentation"` list items outside a tablist trip the
// `list` rule.
test("finds the known violations on the federation allowed-domains tab", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto("/federation/allowed-domains");

  await expect(page.getByRole("heading", heading("Federation"))).toBeVisible();
  // Proves both the availability probe and the list resolved, i.e. the
  // Pro-gated body rendered rather than the marketing fallback.
  await expect(page.getByText(ALLOWLIST_SUBTITLE)).toBeVisible();
  await expect(page.getByText("*.example.net", { exact: true })).toBeVisible();

  expect(await scanViolations(page)).toEqual(["list [serious] ×1"]);
});

test("finds no violations on the registration tokens list", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto("/registration-tokens");

  await expect(
    page.getByRole("heading", heading("Registration tokens")),
  ).toBeVisible();
  await expect(page.getByText("welcome-2026")).toBeVisible();

  expect(await scanViolations(page)).toEqual([]);
});

test("finds no violations on the personal tokens list", async ({ page }) => {
  await loginAs(page);
  await page.goto("/personal-tokens");

  await expect(
    page.getByRole("heading", heading("Personal tokens")),
  ).toBeVisible();
  // Every row resolves its acting user through two further queries.
  await expect(page.getByText("CI automation", { exact: true })).toBeVisible();

  expect(await scanViolations(page)).toEqual([]);
});

test("finds no violations on the auditing page", async ({ page }) => {
  await loginAs(page);
  await page.goto("/auditing");

  await expect(
    page.getByRole("heading", { name: "Auditing", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("keep records of end-to-end encrypted conversations"),
  ).toBeVisible();

  expect(await scanViolations(page)).toEqual([]);
});

test("finds no violations on the supervision page", async ({ page }) => {
  await loginAs(page);
  await page.goto("/supervision");

  await expect(page.getByRole("heading", heading("Supervision"))).toBeVisible();
  // The recovery key is only in the resolved supervision config.
  await expect(page.getByLabel("Recovery key")).toHaveValue(
    ADMINBOT_PASSPHRASE,
  );

  expect(await scanViolations(page)).toEqual([]);
});
