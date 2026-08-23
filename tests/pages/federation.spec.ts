// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { ALLOWLIST_SUBTITLE, drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { DEFAULT_DESTINATIONS, destinationName } from "../mocks/fixtures";
import { federationAllowlistMissing } from "../mocks/matrix";
import { expect, test } from "../mocks/test";

// Every federation route renders the same "Federation" h1, so the mocked data
// is what identifies which tab is showing.
const federationHeading = heading("Federation");

test.describe("federation", () => {
  test("lists the mocked known domains", async ({ page }) => {
    await loginAs(page);
    await page.goto("/federation/known-domains");

    await expect(page.getByRole("heading", federationHeading)).toBeVisible();

    // The grid's name is the count from the list envelope's `total`; each row
    // pairs a destination with the status badge derived from its numeric
    // fields, one per branch of the status helper.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "${DEFAULT_DESTINATIONS.length} domains":
        - rowgroup:
          - row "Server name Status"
        - rowgroup:
          - row /matrix.org .*Working/
          - row /flaky.example.net .*Failing/
          - row /paused.example.net .*Inactive/
          - row /unreachable.example.net .*Never worked/
    `);
  });

  test("shows a known domain's details", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/federation/known-domains/${destinationName(DEFAULT_DESTINATIONS, 0)}`,
    );

    await expect(page.getByRole("heading", federationHeading)).toBeVisible();

    const detail = drawer(page, page.getByRole("link", { name: "Close" }));

    await expect(
      detail.getByRole("heading", { name: "matrix.org" }),
    ).toBeVisible();
    await expect(detail.getByText("Working", { exact: true })).toBeVisible();

    // The stream ordering is the only drawer field that renders independently
    // of timezone and locale, and it is interpolated raw, so it is not
    // group-separated.
    await expect(detail.getByText("4812003", { exact: true })).toBeVisible();

    // The contacts come from the destination's own third-party
    // `/.well-known/matrix/support` document, so seeing them proves the
    // cross-origin handler answered.
    await expect(detail.getByText("admin@matrix.org")).toBeVisible();
    await expect(detail.getByText("@security:matrix.org")).toBeVisible();
    await expect(detail.getByText("https://matrix.org/support/")).toBeVisible();
  });

  test("shows a not-found alert for an unknown domain", async ({ page }) => {
    await loginAs(page);
    // A destination is a bare server name with no ULID guard on the route, so a
    // plausible domain no fixture serves reaches Synapse and 404s.
    await page.goto(
      `/federation/known-domains/${destinationName(DEFAULT_DESTINATIONS, 9999)}`,
    );

    await expect(page.getByText("Destination not found")).toBeVisible();
  });

  test("lists the mocked allowed domains", async ({ page }) => {
    await loginAs(page);
    await page.goto("/federation/allowed-domains");

    await expect(page.getByRole("heading", federationHeading)).toBeVisible();

    // This section renders only on ESS Pro and only once the allowlist
    // availability probe succeeds.
    await expect(page.getByText(ALLOWLIST_SUBTITLE)).toBeVisible();

    await expect(page.getByText("matrix.org", { exact: true })).toBeVisible();
    await expect(
      page.getByText("*.example.net", { exact: true }),
    ).toBeVisible();
  });

  test("falls back to marketing when the allowlist module is missing", async ({
    page,
    network,
  }) => {
    // A 404 from the allowlist endpoint is all it takes to model a deployment
    // without the SBG module.
    network.use(federationAllowlistMissing());

    await loginAs(page);
    await page.goto("/federation/allowed-domains");

    await expect(page.getByRole("heading", federationHeading)).toBeVisible();

    await expect(
      page.getByText(
        "Secure Border Gateway is not enabled on this deployment.",
      ),
    ).toBeVisible();
    await expect(page.getByText(ALLOWLIST_SUBTITLE)).toBeHidden();
  });
});
