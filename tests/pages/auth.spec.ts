// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { heading } from "../helpers";
import { SERVER_NAME } from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

test.describe("authentication", () => {
  /**
   * The only test that walks the whole sign-in flow — discovery, client
   * registration, the `/authorize` redirect and the token exchange on
   * `/callback`. Every other spec short-circuits it with `loginAs`.
   */
  test("signs in through the mocked OIDC flow", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Login • Element Admin");

    await page.getByLabel("Server name").fill(SERVER_NAME);

    // Enabled only once discovery, auth metadata and client registration have
    // all resolved.
    const submit = page.getByRole("button", { name: "Get started" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("surfaces an error returned on the callback", async ({ page }) => {
    await page.goto(
      "/callback?error=access_denied&error_description=The+request+was+denied&state=mock-state",
    );

    await expect(
      page.getByRole("heading", heading("An unexpected error occurred")),
    ).toBeVisible();
    await expect(page.getByText("The request was denied")).toBeVisible();
  });
});
