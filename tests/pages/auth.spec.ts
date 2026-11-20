// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { http, HttpResponse } from "msw";

import { heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { masFailing, matrixFailing } from "../mocks/failing";
import { ACCESS_TOKEN, SERVER_NAME, SYNAPSE_VERSION } from "../mocks/fixtures";
import { authMetadata } from "../mocks/matrix";
import { expect, test } from "../mocks/test";

test.describe("authentication", () => {
  test("a delayed 401 cannot sign out replacement credentials with the same token", async ({
    page,
    network,
  }) => {
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    let releaseResponse!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    // Trigger the 401 from a retry inside the existing document, avoiding a
    // navigation that would cancel the old request before it can be observed.
    network.use(matrixFailing("/_synapse/admin/v1/server_version", 503));
    await loginAs(page);
    await page.goto("/");
    const tile = page
      .getByRole("listitem")
      .filter({ hasText: "Synapse version" });
    await expect(tile.getByText("Failed to load")).toBeVisible();

    let firstResponse = true;
    network.use(
      http.get("*/_synapse/admin/v1/server_version", async () => {
        if (!firstResponse) {
          return HttpResponse.json({ server_version: SYNAPSE_VERSION });
        }
        firstResponse = false;
        requestStarted();
        await release;
        return HttpResponse.json(
          { errcode: "M_UNKNOWN_TOKEN", error: "Expired" },
          { status: 401 },
        );
      }),
    );

    // Dispatch the query retry without Playwright actionability waiting on this
    // suspended tile; the browser still runs its real React click handler.
    await tile.getByRole("button", { name: "Retry" }).dispatchEvent("click");
    await started;
    await expect(tile.getByRole("definition")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await page.evaluate(
      ({ serverName, token }) => {
        const hook = (globalThis as unknown as Record<string, unknown>)[
          "__useStaticCredentials"
        ] as (serverName: string, token: string) => void;
        hook(serverName, token);
      },
      { serverName: SERVER_NAME, token: ACCESS_TOKEN },
    );
    releaseResponse();
    await expect(tile.getByText(SYNAPSE_VERSION)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = JSON.parse(localStorage.getItem("auth") ?? "{}") as {
            state?: { credentials?: { accessToken?: string } | null };
          };
          return state.state?.credentials?.accessToken;
        }),
      )
      .toBe(ACCESS_TOKEN);
  });

  test("a late successful refresh cannot overwrite replacement credentials", async ({
    page,
    network,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Server name").fill(SERVER_NAME);
    const submit = page.getByRole("button", { name: "Get started" });
    await expect(submit).toBeEnabled();
    // Dispatch the real React handler without relying on CSS stability in CI.
    await submit.dispatchEvent("click");
    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
    await page.clock.install();

    let refreshStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    let releaseRefresh!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    network.use(
      http.post("*/oauth2/token", async () => {
        refreshStarted();
        await release;
        return HttpResponse.json({
          access_token: "stale-refreshed-token",
          refresh_token: "stale-refresh-token",
          expires_in: 300,
        });
      }),
    );

    await page.clock.fastForward(6 * 60_000);
    await page.getByRole("link", { name: "Users" }).dispatchEvent("click");
    await started;
    await page.evaluate(
      ({ serverName }) => {
        const hook = (globalThis as unknown as Record<string, unknown>)[
          "__useStaticCredentials"
        ] as (serverName: string, token: string) => void;
        hook(serverName, "replacement-session-token");
      },
      { serverName: SERVER_NAME },
    );
    const refreshResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/oauth2/token") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    releaseRefresh();
    await refreshResponse;
    // The old refresh has returned, and the replacement session can finish
    // the navigation without inheriting its discarded credentials.
    await expect(page.getByRole("heading", heading("Users"))).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const stored = JSON.parse(localStorage.getItem("auth") ?? "{}") as {
            state?: {
              credentials?: { static: boolean; accessToken: string } | null;
            };
          };
          return stored.state?.credentials;
        }),
      )
      .toEqual({
        static: true,
        serverName: SERVER_NAME,
        accessToken: "replacement-session-token",
      });
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeHidden();
  });

  test("logs out when a refresh grant is permanently rejected", async ({
    page,
    network,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Server name").fill(SERVER_NAME);
    const submit = page.getByRole("button", { name: "Get started" });
    await expect(submit).toBeEnabled();
    // Dispatch the real React handler without relying on CSS stability in CI.
    await submit.dispatchEvent("click");
    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
    await page.clock.install();

    network.use(
      http.post("*/oauth2/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );

    await page.clock.fastForward(6 * 60_000);
    await page.goto("/users");
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
  });

  test("a transient refresh failure preserves the current session", async ({
    page,
    network,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Server name").fill(SERVER_NAME);
    const submit = page.getByRole("button", { name: "Get started" });
    await expect(submit).toBeEnabled();
    // Dispatch the real React handler without relying on CSS stability in CI.
    await submit.dispatchEvent("click");
    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
    await page.clock.install();

    network.use(
      http.post("*/oauth2/token", () =>
        HttpResponse.json(
          { error: "temporarily_unavailable" },
          { status: 503 },
        ),
      ),
    );

    await page.clock.fastForward(6 * 60_000);
    await page.goto("/users");
    await expect(
      page.getByRole("heading", heading("An unexpected error occurred")),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out and reload" }),
    ).toBeVisible();
  });

  test("a transient OAuth 503 is not mistaken for invalid_grant", async ({
    page,
    network,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Server name").fill(SERVER_NAME);
    const submit = page.getByRole("button", { name: "Get started" });
    await expect(submit).toBeEnabled();
    await submit.dispatchEvent("click");
    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
    await page.clock.install();

    // Only a correctly formed OAuth 400 invalid_grant means the session is lost.
    network.use(
      http.post("*/oauth2/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 503 }),
      ),
    );
    await page.clock.fastForward(6 * 60_000);
    await page.goto("/users");
    await expect(
      page.getByRole("heading", heading("An unexpected error occurred")),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out and reload" }),
    ).toBeVisible();
  });

  test("logs out when the current access token is rejected", async ({
    page,
    network,
  }) => {
    network.use(matrixFailing("/_matrix/client/v3/account/whoami", 401));
    await loginAs(page);
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", heading("Dashboard"))).toBeHidden();

    // A reloaded document must not resurrect the rejected session from storage.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
  });

  test("logs out on a rejected MAS admin token", async ({ page, network }) => {
    network.use(masFailing("/api/admin/v1/users", 401));
    await loginAs(page);
    await page.goto("/users");

    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
  });

  test("does not log out on a permissions failure", async ({
    page,
    network,
  }) => {
    network.use(masFailing("/api/admin/v1/users", 403));
    await loginAs(page);
    await page.goto("/users");

    await expect(
      page.getByRole("heading", heading("An unexpected error occurred")),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out and reload" }),
    ).toBeVisible();
  });

  test("does not log out on a temporary authenticated server failure", async ({
    page,
    network,
  }) => {
    network.use(matrixFailing("/_matrix/client/v3/account/whoami", 503));
    await loginAs(page);
    await page.goto("/");

    await expect(
      page.getByRole("heading", heading("An unexpected error occurred")),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out and reload" }),
    ).toBeVisible();
  });

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
