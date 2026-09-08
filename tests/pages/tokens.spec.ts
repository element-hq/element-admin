// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Locator, Page } from "@playwright/test";
import { http, HttpResponse } from "msw";

import { drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { masFailingPost } from "../mocks/failing";
import * as mas from "../mocks/mas";
import {
  DEFAULT_PERSONAL_SESSIONS,
  DEFAULT_REGISTRATION_TOKENS,
  personalSessionId,
  registrationTokenId,
  SERVER_NAME,
  singlePersonalSession,
  ulid,
} from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

const registrationTokensHeading = "Registration tokens";
const personalTokensHeading = "Personal tokens";

/**
 * Open the revoke dialog from a token drawer and cancel it, leaving the token
 * active. Mutations are unmocked, so the dialog is only ever cancelled here.
 */
const expectRevokeCancelled = async (
  page: Page,
  dialogTitle: string,
): Promise<void> => {
  const detail = drawer(
    page,
    page.getByRole("button", { name: "Revoke token" }),
  );
  await detail.getByRole("button", { name: "Revoke token" }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: dialogTitle }),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(detail.getByText("Active", { exact: true })).toBeVisible();
};

/**
 * Fill the create-token dialog's mandatory fields — a name, an acting user and
 * one scope — leaving the expiry alone.
 */
const fillNewToken = async (dialog: Locator, name: string): Promise<void> => {
  await dialog.getByRole("textbox", { name: "Token name" }).fill(name);
  await dialog.getByRole("combobox").fill("alice");
  await dialog.getByRole("option").first().click();
  await dialog.getByRole("checkbox", { name: "urn:mas:admin" }).check();
};

/**
 * A personal token with ten days left to run, and the handlers serving it. The
 * shared fixtures are deliberately clock-independent, so none of them has a
 * future expiry, which is the only thing the regenerate dialog prefills from.
 */
const EXPIRING = [
  {
    ...DEFAULT_PERSONAL_SESSIONS[0],
    expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const expiringSessionHandlers = () => [
  mas.personalSessionsList(EXPIRING),
  mas.personalSessionDetail(EXPIRING),
];

test.describe("registration tokens", () => {
  test("lists the mocked registration tokens", async ({ page }) => {
    await loginAs(page);
    await page.goto("/registration-tokens");

    await expect(
      page.getByRole("heading", heading(registrationTokensHeading)),
    ).toBeVisible();
    // The badge derives "Revoked", "Expired" and "Used up" from the token's own
    // attributes and only falls back to the server-computed `valid`, which is
    // why the expired fixture still says it is valid. No fixture has a future
    // expiry, which is the one thing that would rot.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "4 tokens":
        - rowgroup:
          - row "Token Created at Expires at Uses Status"
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
      - heading "welcome-2026" [level=3]
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

  test("cancels revoking a registration token", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/registration-tokens/${registrationTokenId(DEFAULT_REGISTRATION_TOKENS, 0)}`,
    );

    await expectRevokeCancelled(page, "Revoke this registration token?");
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
          - row "Name Acting user Status Last active Expires at"
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
            - gridcell "Revoked"
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

  test("shows a revoked personal token's expiry as revoked", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(
      `/personal-tokens/${personalSessionId(DEFAULT_PERSONAL_SESSIONS, 1)}`,
    );

    // A revoked session has no token left, so MAS reports no expiry for it —
    // which must not read as a token that never expires.
    const detail = drawer(
      page,
      page.getByRole("heading", { name: "Retired bridge" }),
    );

    await expect(detail).toMatchAriaSnapshot(`
      - listitem:
        - term: Expires at
        - definition: Revoked
      - listitem:
        - term: Revoked at
        - definition: /2026/
    `);
  });

  test("asks for a day count only once an expiry is wanted", async ({
    page,
    network,
  }) => {
    let body: unknown;
    network.use(
      http.post("*/api/admin/v1/personal-sessions", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(singlePersonalSession(0), { status: 201 });
      }),
    );

    await loginAs(page);
    await page.goto("/personal-tokens");
    await page.getByRole("button", { name: "Add" }).click();

    const dialog = page.getByRole("dialog");
    const days = dialog.getByRole("spinbutton", { name: "Expires in (days)" });
    await expect(days).toBeHidden();

    await fillNewToken(dialog, "Expiring token");
    await dialog.getByRole("checkbox", { name: "Set an expiry" }).check();
    await expect(days).toHaveValue("30");

    // Radix suppresses the browser's own validation bubble, so an empty day
    // count has to be reported in the form or the submit does nothing at all.
    await days.fill("");
    await dialog.getByRole("button", { name: "Create token" }).click();
    await expect(
      dialog.getByText("Enter how many days the token should last"),
    ).toBeVisible();

    await days.fill("30");
    await dialog.getByRole("button", { name: "Create token" }).click();

    await expect
      .poll(() => body)
      .toEqual(expect.objectContaining({ expires_in: 30 * 24 * 60 * 60 }));
  });

  test("offers the days a regenerated token has left", async ({
    page,
    network,
  }) => {
    network.use(...expiringSessionHandlers());

    await loginAs(page);
    await page.goto(`/personal-tokens/${personalSessionId(EXPIRING, 0)}`);

    await page.getByRole("button", { name: "Regenerate token" }).click();
    const dialog = page.getByRole("dialog");

    await expect(
      dialog.getByRole("checkbox", { name: "Set an expiry" }),
    ).toBeChecked();
    await expect(
      dialog.getByRole("spinbutton", { name: "Expires in (days)" }),
    ).toHaveValue("10");
  });

  test("forgets an abandoned expiry choice on the next regenerate", async ({
    page,
    network,
  }) => {
    network.use(...expiringSessionHandlers());

    await loginAs(page);
    await page.goto(`/personal-tokens/${personalSessionId(EXPIRING, 0)}`);

    const regenerate = page.getByRole("button", { name: "Regenerate token" });
    await regenerate.click();

    const expires = page
      .getByRole("dialog")
      .getByRole("checkbox", { name: "Set an expiry" });
    await expires.uncheck();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // Dismissing the dialog abandons the choice: reopening it starts from the
    // token again, rather than from the never-expires the admin backed out of.
    await regenerate.click();
    await expect(expires).toBeChecked();
  });

  test("asks for no expiry when the checkbox is left unticked", async ({
    page,
    network,
  }) => {
    let body: unknown;
    network.use(
      http.post("*/api/admin/v1/personal-sessions", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(singlePersonalSession(0), { status: 201 });
      }),
    );

    await loginAs(page);
    await page.goto("/personal-tokens");
    await page.getByRole("button", { name: "Add" }).click();

    const dialog = page.getByRole("dialog");
    await fillNewToken(dialog, "Never expires");
    await dialog.getByRole("button", { name: "Create token" }).click();

    // MAS mints a token that never expires when the request carries no
    // `expires_in` at all.
    await expect
      .poll(() => body)
      .toEqual(expect.objectContaining({ human_name: "Never expires" }));
    expect(body).not.toHaveProperty("expires_in");
  });

  test("cancels revoking a personal token", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/personal-tokens/${personalSessionId(DEFAULT_PERSONAL_SESSIONS, 0)}`,
    );

    await expectRevokeCancelled(page, "Revoke this personal token?");
  });

  test("reports a failed revocation inside the dialog", async ({
    page,
    network,
  }) => {
    // A toast would render in the app root, which the open dialog marks
    // aria-hidden, so the failure has to be reported in the dialog itself —
    // which stays open, with the token untouched.
    network.use(masFailingPost("/api/admin/v1/personal-sessions/:id/revoke"));

    await loginAs(page);
    await page.goto(
      `/personal-tokens/${personalSessionId(DEFAULT_PERSONAL_SESSIONS, 0)}`,
    );

    const detail = drawer(
      page,
      page.getByRole("button", { name: "Revoke token" }),
    );
    await detail.getByRole("button", { name: "Revoke token" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Revoke token" }).click();

    await expect(dialog.getByText("Failed to revoke the token")).toBeVisible();

    // The dialog is still open on the failure; the drawer behind it is
    // aria-hidden while it is, so the badge is checked once it is dismissed.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(detail.getByText("Active", { exact: true })).toBeVisible();
  });

  test("shows a not-found alert for an unknown personal token", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(`/personal-tokens/${ulid(9999)}`);

    await expect(page.getByText("Personal token not found")).toBeVisible();
  });
});
