// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  DEFAULT_PERSONAL_SESSIONS,
  DEFAULT_REGISTRATION_TOKENS,
  personalSessionId,
  registrationTokenId,
  SERVER_NAME,
  ulid,
} from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

const registrationTokensHeading = "Registration tokens";
const personalTokensHeading = "Personal tokens";

test.describe("registration tokens", () => {
  test("lists the mocked registration tokens", async ({ page }) => {
    await loginAs(page);
    await page.goto("/registration-tokens");

    await expect(
      page.getByRole("heading", heading(registrationTokensHeading)),
    ).toBeVisible();
    // "Active" comes from the server-computed `valid`, which the badge
    // short-circuits on, so the three other fixtures set `valid: false`. No
    // fixture has a future expiry, which is the one thing that would rot.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "4 tokens":
        - rowgroup:
          - row "Token Created at Valid Until Uses Status"
        - rowgroup:
          - row:
            - gridcell:
              - link "welcome-2026"
            - gridcell /2026/
            - gridcell "Never expires"
            - gridcell "0 / ∞"
            - gridcell "Active"
          - row:
            - gridcell:
              - link "revoked-token"
            - gridcell /2026/
            - gridcell "Never expires"
            - gridcell "0 / ∞"
            - gridcell "Revoked"
          - row:
            - gridcell:
              - link "used-up-token"
            - gridcell /2026/
            - gridcell "Never expires"
            - gridcell "5 / 5"
            - gridcell "Used up"
          - row:
            - gridcell:
              - link "expired-token"
            - gridcell /2026/
            - gridcell /2026/
            - gridcell "0 / ∞"
            - gridcell "Expired"
    `);
  });

  test("shows a registration token's details", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/registration-tokens/${registrationTokenId(DEFAULT_REGISTRATION_TOKENS, 0)}`,
    );

    // The detail page is a drawer over the list, so the list is still there.
    await expect(
      page.getByRole("heading", heading(registrationTokensHeading)),
    ).toBeVisible();

    // This fixture has no `revoked_at`, so the drawer's button is the "Revoke"
    // variant rather than "Unrevoke".
    const detail = drawer(
      page,
      page.getByRole("button", { name: "Revoke token" }),
    );

    await expect(detail).toMatchAriaSnapshot(`
      - heading /welcome-2026/ [level=3]
      - list:
        - listitem:
          - term: Status
          - definition: Active
        - listitem:
          - term: Expires at
          - definition: Never expires
        - listitem:
          - term: Usage count
          - definition: 0 / ∞
    `);

    // Only an unrevoked token can be edited.
    await expect(
      detail.getByRole("button", { name: "Edit properties" }),
    ).toBeEnabled();
  });

  test("shows a not-found alert for an unknown registration token", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(`/registration-tokens/${ulid(9999)}`);

    await expect(page.getByText("Registration token not found")).toBeVisible();
  });
});

test.describe("personal tokens", () => {
  test("lists the mocked personal tokens", async ({ page }) => {
    await loginAs(page);
    await page.goto("/personal-tokens");

    await expect(
      page.getByRole("heading", heading(personalTokensHeading)),
    ).toBeVisible();
    // Every row resolves its `actor_user_id` to a user and then to a Matrix
    // profile; the deactivated user's profile 404s, so his cell is a bare
    // Matrix ID with no display name.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "3 personal tokens":
        - rowgroup:
          - row "Name Acting User Status Last Active Expires at"
        - rowgroup:
          - row:
            - gridcell:
              - link "CI automation"
            - gridcell:
              - paragraph: Alice
              - paragraph: "@alice:${SERVER_NAME}"
            - gridcell "Active"
            - gridcell "Never used"
            - gridcell "Never expires"
          - row:
            - gridcell:
              - link "Retired bridge"
            - gridcell:
              - paragraph: Admin
              - paragraph: "@admin:${SERVER_NAME}"
            - gridcell "Revoked"
            - gridcell "Never used"
            - gridcell "Never expires"
          - row:
            - gridcell:
              - link "Old migration script"
            - gridcell:
              - paragraph: "@bob:${SERVER_NAME}"
            - gridcell "Expired"
            - gridcell "Never used"
            - gridcell /2026/
    `);
  });

  test("shows a personal token's details", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/personal-tokens/${personalSessionId(DEFAULT_PERSONAL_SESSIONS, 0)}`,
    );

    await expect(
      page.getByRole("heading", heading(personalTokensHeading)),
    ).toBeVisible();

    const detail = drawer(
      page,
      page.getByRole("button", { name: "Revoke token" }),
    );

    await expect(detail).toMatchAriaSnapshot(`
      - heading "CI automation" [level=3]
      - paragraph: Acting user
      - link:
        - paragraph: Alice
        - paragraph: "@alice:${SERVER_NAME}"
      - paragraph: Owner
      - link:
        - paragraph: Admin
        - paragraph: "@admin:${SERVER_NAME}"
      - list:
        - listitem:
          - term: Status
          - definition: Active
        - listitem:
          - term: Scopes
          - definition: Access to the MAS admin API
          - definition: Access to the Matrix Client-Server API
        - listitem:
          - term: Expires at
          - definition: Never expires
    `);

    // `whoami` reports the admin, who owns this token, so the regenerate button
    // is the enabled variant.
    await expect(
      detail.getByRole("button", { name: "Regenerate token" }),
    ).toBeEnabled();
  });

  test("shows a not-found alert for an unknown personal token", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(`/personal-tokens/${ulid(9999)}`);

    await expect(page.getByText("Personal token not found")).toBeVisible();
  });
});
