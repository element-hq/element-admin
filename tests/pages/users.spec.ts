// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { DEFAULT_USERS, ulid, userId } from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

const usersHeading = "Users";

test.describe("users", () => {
  test("lists the mocked users", async ({ page }) => {
    await loginAs(page);
    await page.goto("/users");

    await expect(
      page.getByRole("heading", heading(usersHeading)),
    ).toBeVisible();

    // The deactivated user's Matrix profile 404s, so that row shows a Matrix
    // ID and no display name.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "3 users":
        - rowgroup:
          - row "Matrix ID Created at Account status"
        - rowgroup:
          - row:
            - gridcell:
              - link:
                - paragraph: Admin
                - paragraph: "@admin:example.com"
            - gridcell "Admin"
          - row:
            - gridcell:
              - link:
                - paragraph: Alice
                - paragraph: "@alice:example.com"
            - gridcell "Active"
          - row:
            - gridcell:
              - link:
                - paragraph: "@bob:example.com"
            - gridcell "Deactivated"
    `);
  });

  test("shows a user's details", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/users/${userId(DEFAULT_USERS, 1)}`);

    // The detail page is a drawer over the list, so the list is still there.
    await expect(
      page.getByRole("heading", heading(usersHeading)),
    ).toBeVisible();

    const pane = drawer(
      page,
      page.getByRole("button", { name: "Lock account" }),
    );

    await expect(pane).toMatchAriaSnapshot(`
      - img "@alice:example.com"
      - heading "Alice" [level=3]
      - paragraph: "@alice:example.com"
      - button "Lock account"
      - button "Deactivate account"
      - list:
        - listitem:
          - term: Status
          - definition: Active
    `);
  });

  test("shows a not-found alert for an unknown user", async ({ page }) => {
    await loginAs(page);
    // A well-formed ULID, so it reaches MAS rather than being rejected by the
    // route's ULID guard.
    await page.goto(`/users/${ulid(9999)}`);

    await expect(page.getByText("User not found")).toBeVisible();
  });
});
