// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Page } from "@playwright/test";
import { http, HttpResponse, type RequestHandler } from "msw";

import { heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { masFailing, matrixFailing } from "../mocks/failing";
import {
  ACCESS_TOKEN,
  DEFAULT_ROOMS,
  DEFAULT_USERS,
  masError,
  REFRESH_TOKEN,
  roomId,
  SERVER_NAME,
  userId,
} from "../mocks/fixtures";
import { authMetadata, matrixError } from "../mocks/matrix";
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

  /**
   * ESS's haproxy answers 429 while Synapse restarts. The error shows on the
   * first failure, but discovery keeps retrying and unlocks the form once
   * Synapse is back, without a reload.
   */
  test("recovers when Synapse comes back during discovery", async ({
    page,
    network,
  }) => {
    network.use(matrixFailing("/_matrix/client/v1/auth_metadata", 429));

    await page.goto("/login");
    await page.getByLabel("Server name").fill(SERVER_NAME);

    const error = page.getByText("Failed to load the server's auth metadata.");
    const submit = page.getByRole("button", { name: "Get started" });
    await expect(error).toBeVisible();
    await expect(submit).toBeDisabled();

    network.use(authMetadata());

    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await expect(error).toBeHidden();
  });

  /**
   * A declined sign-in is reported as prose, not as the provider's raw
   * `error_description`. The callback loader throws like any other failing
   * loader, so the shell is the generic error page and only the message inside
   * it is specific to the refusal.
   */
  test("surfaces an error returned on the callback", async ({ page }) => {
    await page.goto(
      "/callback?error=access_denied&error_description=The+request+was+denied&state=mock-state",
    );

    await expect(
      page.getByRole("heading", heading("An unexpected error occurred")),
    ).toBeVisible();
    await expect(page.getByText("Sign-in was cancelled.")).toBeVisible();
    await expect(page.getByText("The request was denied")).toBeHidden();
  });

  /**
   * Browsers withhold Web Crypto outside a secure context, which the PKCE
   * challenge needs. The page reads `isSecureContext` while rendering, so it
   * has to be false before any app script runs; `subtle` goes with it so that
   * submitting could not succeed either.
   */
  test("refuses to sign in on an insecure origin", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, "isSecureContext", { value: false });
      Reflect.deleteProperty(globalThis.Crypto.prototype, "subtle");
    });

    await page.goto("/login");
    await page.getByLabel("Server name").fill(SERVER_NAME);

    await expect(
      page.getByText(
        "Sign-in requires a secure connection. Reload this page over https:// and try again.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeDisabled();
  });
});

/** Signs in through the mocked OIDC flow, up to the redirect into the console. */
const signIn = async (page: Page): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Server name").fill(SERVER_NAME);
  const submit = page.getByRole("button", { name: "Get started" });
  await expect(submit).toBeEnabled();
  await submit.click();
};

/**
 * A token endpoint answering `grantType` with `failure`. Its access tokens are
 * expired on arrival, so the first authenticated request after sign-in goes
 * through a refresh grant.
 */
const grantFailing = (
  grantType: "authorization_code" | "refresh_token",
  failure: () => Response,
): RequestHandler =>
  http.post("*/oauth2/token", async ({ request }) => {
    const body = new URLSearchParams(await request.text());
    if (body.get("grant_type") === grantType) return failure();
    return HttpResponse.json({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      token_type: "Bearer",
      expires_in: 0,
    });
  });

const notice = (page: Page) => page.getByText("Your session has expired");
const errorPageTitle = heading("An unexpected error occurred");

test.describe("a rejected session", () => {
  test("signs out on a 401 from Synapse", async ({ page, network }) => {
    network.use(
      matrixFailing(
        "/_synapse/admin/v1/rooms/:roomId",
        401,
        matrixError("M_UNKNOWN_TOKEN", "Invalid access token passed."),
      ),
    );

    await loginAs(page);
    const path = `/rooms/${encodeURIComponent(roomId(DEFAULT_ROOMS, 0))}`;
    await page.goto(path);

    await expect(notice(page)).toBeVisible();
    await expect(page.getByText("Sign in again to continue.")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(path);

    await page.getByRole("button", { name: "Close" }).click();
    await expect(notice(page)).toBeHidden();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(path);
  });

  test("signs out on a 401 from MAS", async ({ page, network }) => {
    network.use(
      masFailing(
        "/api/admin/v1/users/:id",
        401,
        masError("Invalid access token"),
      ),
    );

    await loginAs(page);
    const path = `/users/${userId(DEFAULT_USERS, 1)}`;
    await page.goto(path);

    await expect(notice(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(path);
  });

  // matrixFailing answers with M_UNKNOWN, which is not a rejected token even
  // on a 401.
  for (const status of [401, 403, 500]) {
    test(`keeps the session on a ${status} from Synapse`, async ({
      page,
      network,
    }) => {
      network.use(matrixFailing("/_synapse/admin/v1/rooms/:roomId", status));

      await loginAs(page);
      await page.goto(`/rooms/${encodeURIComponent(roomId(DEFAULT_ROOMS, 0))}`);

      await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sign out and reload" }),
      ).toBeVisible();
      await expect(notice(page)).toBeHidden();
    });
  }

  test("signs out when the refresh token is rejected", async ({
    page,
    network,
  }) => {
    let revoked: URLSearchParams | undefined;
    network.use(
      grantFailing("refresh_token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
      http.post("*/oauth2/revoke", async ({ request }) => {
        revoked = new URLSearchParams(await request.text());
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await signIn(page);

    await expect(notice(page)).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expect.poll(() => revoked?.get("token")).toBe(REFRESH_TOKEN);
    expect(revoked?.get("token_type_hint")).toBe("refresh_token");
  });

  test("keeps the session when the refresh fails transiently", async ({
    page,
    network,
  }) => {
    network.use(
      grantFailing(
        "refresh_token",
        () => new HttpResponse("Service Unavailable", { status: 503 }),
      ),
    );

    await signIn(page);

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out and reload" }),
    ).toBeVisible();
    await expect(notice(page)).toBeHidden();
  });

  test("shows the server's error when the code exchange fails", async ({
    page,
    network,
  }) => {
    network.use(
      grantFailing("authorization_code", () =>
        HttpResponse.json(
          {
            error: "invalid_grant",
            error_description: "The authorization code has expired",
          },
          { status: 400 },
        ),
      ),
    );

    await signIn(page);

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();
    await expect(
      page.getByText(
        "The homeserver's authentication service returned an error: The authorization code has expired",
      ),
    ).toBeVisible();

    await page.goto("/login");
    await expect(page.getByLabel("Server name")).toBeVisible();
    await expect(notice(page)).toBeHidden();
  });
});
