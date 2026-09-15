// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { ALLOWLIST_SUBTITLE, heading, navEntry } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  ESS_VERSION,
  LATEST_ESS_RELEASE,
  SYNAPSE_VERSION,
} from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

/**
 * The reduced deployments. Everything else runs in `essPro`, where every
 * route is reachable; this spec covers what disappears elsewhere.
 *
 * Two independent axes gate the console: the ESS edition and the MAS version.
 * `plainMas` is off on both and `essCommunity` on only one, which is what
 * proves the axes are independent. Absence assertions mean nothing on a blank
 * page, so the first test asserts the same selectors in the default deployment.
 */

const proLogo = { name: "Element Pro" } as const;
const communityLogo = { name: "Element Community" } as const;

test("positive control: the default deployment shows every entry and tile the reduced ones lack", async ({
  page,
}) => {
  await loginAs(page);
  await page.goto("/");

  await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
  await expect(page.getByRole("img", proLogo)).toBeVisible();

  await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
    - navigation:
      - link "Dashboard"
      - link "Users"
      - link "Rooms"
      - link "Devices"
      - link "Federation"
      - link "Auditing"
      - link "Supervision"
      - link "Personal tokens"
      - link "Registration tokens"
      - link "Documentation"
  `);

  await expect(page.getByText("ESS version", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Latest ESS version", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(ESS_VERSION, { exact: true })).toBeVisible();
});

test.describe("plainMas deployment", () => {
  test.use({ deployment: "plainMas" });

  test("hides the ESS version tiles on the dashboard", async ({ page }) => {
    await loginAs(page);
    await page.goto("/");

    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();

    // A null edition and "community" are indistinguishable everywhere but the
    // dashboard tiles, since the app falls back to community and only the
    // tiles key off the ESS version.
    await expect(page.getByRole("img", communityLogo)).toBeVisible();

    await expect(page.getByText("ESS version", { exact: true })).toBeHidden();
    await expect(
      page.getByText("Latest ESS version", { exact: true }),
    ).toBeHidden();
    await expect(page.getByText(ESS_VERSION, { exact: true })).toBeHidden();
    await expect(
      page.getByRole("link", { name: LATEST_ESS_RELEASE }),
    ).toBeHidden();

    // The non-ESS tiles still render, so the page loaded rather than failing
    // above the grid.
    await expect(page.getByText(SYNAPSE_VERSION)).toBeVisible();
  });

  test("hides the version-gated navigation entries", async ({ page }) => {
    await loginAs(page);
    await page.goto("/");

    // The snapshot retries until the sidebar has rendered; the two absence
    // assertions below would pass against an empty page.
    await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
      - navigation:
        - link "Dashboard"
        - link "Users"
        - link "Rooms"
        - link "Federation"
        - link "Auditing"
        - link "Supervision"
        - link "Registration tokens"
        - link "Documentation"
    `);

    // An aria snapshot matches by containment, so it cannot prove the gated
    // entries are gone on its own.
    await expect(navEntry(page, "Devices")).toBeHidden();
    await expect(navEntry(page, "Personal tokens")).toBeHidden();
  });

  test("404s the devices section, which is gated at the route", async ({
    page,
  }) => {
    await loginAs(page);
    // The asserted "Not Found" is the router's built-in page, not a
    // section-level one.
    await page.goto("/devices/user");

    await expect(page.getByText("Not Found", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", heading("User devices")),
    ).toBeHidden();
  });

  test("still serves /personal-tokens, which is only nav-gated", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/personal-tokens");

    await expect(
      page.getByRole("heading", heading("Personal tokens")),
    ).toBeVisible();
    await expect(navEntry(page, "Personal tokens")).toBeHidden();
  });

  test("shows the non-Pro fallback on /federation/allowed-domains", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/federation/allowed-domains");

    // The tabs are not gated, so the page is reachable and only its body
    // changes.
    await expect(
      page.getByRole("heading", heading("Federation")),
    ).toBeVisible();

    // The "not available in Community" wording, distinct from the "module
    // missing on Pro" one covered in `federation.spec.ts`.
    await expect(
      page.getByText(
        "Secure Border Gateway is not available in ESS Community. Upgrade to ESS Pro to enable it.",
      ),
    ).toBeVisible();
    await expect(page.getByText(ALLOWLIST_SUBTITLE)).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Also available in Pro…", level: 2 }),
    ).toBeVisible();
  });

  test("shows the ESS Pro upsell on /auditing", async ({ page }) => {
    await loginAs(page);
    await page.goto("/auditing");

    // `/auditing` has no page header here, so the marketing card's `h2` is the
    // only heading.
    await expect(
      page.getByRole("heading", { name: "Auditing", exact: true, level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText("Auditing is a feature available in ESS Pro"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Upgrade to Pro" }),
    ).toBeVisible();
  });
});

test.describe("essCommunity deployment", () => {
  test.use({ deployment: "essCommunity" });

  test("shows the ESS version tiles and the Community logo", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/");

    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();

    // The one place Community and non-ESS diverge: the edition is Community
    // but the version is present, so the tiles render.
    await expect(page.getByText("ESS version", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Latest ESS version", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(ESS_VERSION, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: LATEST_ESS_RELEASE }),
    ).toBeVisible();

    await expect(page.getByRole("img", communityLogo)).toBeVisible();
    await expect(page.getByRole("img", proLogo)).toBeHidden();
  });

  test("keeps the MAS-version-gated routes, because that axis is separate", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/devices/user");

    await expect(
      page.getByRole("heading", heading("User devices")),
    ).toBeVisible();
    await expect(page.getByText("Not Found", { exact: true })).toBeHidden();

    await expect(navEntry(page, "Devices")).toBeVisible();
    await expect(navEntry(page, "Personal tokens")).toBeVisible();
  });

  test("still gates /federation/allowed-domains, which needs Pro", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/federation/allowed-domains");

    // Community is no better than a null edition here: the allowlist needs Pro.
    await expect(
      page.getByText(
        "Secure Border Gateway is not available in ESS Community. Upgrade to ESS Pro to enable it.",
      ),
    ).toBeVisible();
    await expect(page.getByText(ALLOWLIST_SUBTITLE)).toBeHidden();
  });
});
