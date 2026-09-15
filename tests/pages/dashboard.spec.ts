// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  DEFAULT_ROOMS,
  DEFAULT_USERS,
  ESS_VERSION,
  LATEST_ESS_RELEASE,
  SERVER_NAME,
  SYNAPSE_VERSION,
} from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

test.describe("dashboard", () => {
  test("renders the mocked counts and versions", async ({ page }) => {
    await loginAs(page);
    await page.goto("/");

    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
    await expect(
      page.getByRole("heading", { name: SERVER_NAME, level: 2 }),
    ).toBeVisible();

    // Each tile is its own suspense boundary, so all of them are asserted: a
    // tile still loading or errored would drop out of the snapshot.
    const tiles = page.getByRole("list").filter({ hasText: "ESS version" });
    await expect(tiles).toMatchAriaSnapshot(`
      - list:
        - listitem:
          - term: ESS version
          - definition: ${ESS_VERSION}
        - listitem:
          - term: Latest ESS version
          - definition:
            - link "${LATEST_ESS_RELEASE}"
            - text: (New release)
        - listitem:
          - term: Synapse version
          - definition: ${SYNAPSE_VERSION}
        - listitem:
          - term: Rooms total
          - definition: "${DEFAULT_ROOMS.length}"
        - listitem:
          - term: Users registered
          - definition: "${DEFAULT_USERS.length}"
    `);
  });
});
