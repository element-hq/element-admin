// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * `/auditing` and `/supervision`, the two pages whose whole body is chosen by
 * the ESS edition. Every branch asserts the header logo too: its aria-label is
 * the cheapest proof of which edition actually resolved, rather than the page
 * having merely defaulted to a non-Pro layout.
 */

import { heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  ADMINBOT_MXID,
  ADMINBOT_PASSPHRASE,
  ESS_VERSION,
} from "../mocks/fixtures";
import {
  adminbotDisabled,
  essVersion,
  essVersionMissing,
} from "../mocks/matrix";
import { expect, test } from "../mocks/test";

const proLogo = { name: "Element Pro" } as const;
const communityLogo = { name: "Element Community" } as const;

/** Copy shared by both pages' non-Pro alerts, and by nothing else. */
const upgradeHint =
  "This feature is not available in ESS Community. Upgrade to ESS Pro to enable it.";

/** The upsell card, which only the non-Pro paths show. */
const alsoAvailableInPro = {
  name: "Also available in Pro…",
  level: 2,
} as const;

test.describe("auditing", () => {
  test("shows the auditing card without an upsell on ESS Pro", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/auditing");

    // The page header's h1 and the marketing card's h2 both say "Auditing";
    // the sidebar entry and the breadcrumb also do.
    await expect(
      page.getByRole("heading", { name: "Auditing", exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Auditing", exact: true, level: 2 }),
    ).toBeVisible();

    await expect(
      page.getByText("keep records of end-to-end encrypted conversations"),
    ).toBeVisible();

    await expect(page.getByRole("img", proLogo)).toBeVisible();

    await expect(
      page.getByText("Auditing is a feature available in ESS Pro"),
    ).toBeHidden();
    await expect(page.getByRole("heading", alsoAvailableInPro)).toBeHidden();
  });

  test("shows the ESS Pro upsell on ESS Community", async ({
    page,
    network,
  }) => {
    network.use(essVersion(ESS_VERSION, "community"));

    await loginAs(page);
    await page.goto("/auditing");

    await expect(
      page.getByRole("heading", { name: "Auditing", exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("img", communityLogo)).toBeVisible();

    // The card's PRO badge is an aria-hidden SVG, so the alert and the upsell
    // card are all the non-Pro branch exposes.
    await expect(
      page.getByText("Auditing is a feature available in ESS Pro"),
    ).toBeVisible();
    await expect(page.getByText(upgradeHint)).toBeVisible();
    await expect(page.getByRole("heading", alsoAvailableInPro)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Upgrade to Pro" }),
    ).toBeVisible();
  });

  test("treats a non-ESS deployment like ESS Community", async ({
    page,
    network,
  }) => {
    // A failing version endpoint is how the app detects a deployment that is
    // not ESS at all, so this is a product path rather than a broken mock.
    network.use(essVersionMissing());

    await loginAs(page);
    await page.goto("/auditing");

    await expect(
      page.getByRole("heading", { name: "Auditing", exact: true, level: 1 }),
    ).toBeVisible();

    // An unknown edition is not "community", but the logo and every feature
    // check fall back to it.
    await expect(page.getByRole("img", communityLogo)).toBeVisible();
    await expect(
      page.getByText("Auditing is a feature available in ESS Pro"),
    ).toBeVisible();
    await expect(page.getByRole("heading", alsoAvailableInPro)).toBeVisible();
  });
});

test.describe("supervision", () => {
  test("shows the mocked supervision configuration on ESS Pro", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/supervision");

    await expect(
      page.getByRole("heading", heading("Supervision")),
    ).toBeVisible();
    await expect(page.getByRole("img", proLogo)).toBeVisible();

    // The mxid is bolded mid-sentence, so matching the whole sentence proves
    // the supervision config resolved and validated.
    await expect(
      page.getByText(
        `Sign in as ${ADMINBOT_MXID} to perform administrative actions in any room.`,
      ),
    ).toBeVisible();

    // The recovery key is optional in the config, so the field exists only
    // because the fixture sets it.
    await expect(page.getByLabel("Recovery key")).toHaveValue(
      ADMINBOT_PASSPHRASE,
    );

    // The config carries a UI address, so the launch button renders instead of
    // the "requires Element Web" alert. It is never clicked, because clicking
    // it opens a real popup at that address.
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

    await expect(page.getByRole("heading", alsoAvailableInPro)).toBeHidden();
    await expect(
      page.getByText("Supervision is currently disabled"),
    ).toBeHidden();
  });

  test("shows the disabled alert when supervision is off on ESS Pro", async ({
    page,
    network,
  }) => {
    // A 404 from the supervision config means "not enabled" rather than an
    // error, so the page takes its disabled-on-Pro branch.
    network.use(adminbotDisabled());

    await loginAs(page);
    await page.goto("/supervision");

    await expect(page.getByRole("img", proLogo)).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Supervision", exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText("Supervision enables an organisation to administer all"),
    ).toBeVisible();

    // The Pro wording tells the admin to enable the feature rather than buy it.
    await expect(
      page.getByText("Supervision is currently disabled"),
    ).toBeVisible();
    await expect(
      page.getByText("This feature is part of your subscription."),
    ).toBeVisible();
    await expect(page.getByRole("heading", alsoAvailableInPro)).toBeHidden();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeHidden();
  });

  test("shows the ESS Pro upsell on ESS Community", async ({
    page,
    network,
  }) => {
    // The route only prefetches the supervision config once it knows the
    // deployment is Pro, and the non-Pro branch never reads it anyway.
    network.use(essVersion(ESS_VERSION, "community"));

    await loginAs(page);
    await page.goto("/supervision");

    await expect(page.getByRole("img", communityLogo)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Supervision", exact: true, level: 1 }),
    ).toBeVisible();

    await expect(
      page.getByText("Supervision is a feature available in ESS Pro"),
    ).toBeVisible();
    await expect(page.getByText(upgradeHint)).toBeVisible();
    await expect(page.getByRole("heading", alsoAvailableInPro)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Upgrade to Pro" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Sign in" })).toBeHidden();
    await expect(page.getByLabel("Recovery key")).toBeHidden();
    await expect(page.getByText(ADMINBOT_MXID)).toBeHidden();
  });
});
