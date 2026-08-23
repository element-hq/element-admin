// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Page } from "@playwright/test";

import { heading, navEntry } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  DEFAULT_ROOMS,
  DEFAULT_USERS,
  ESS_VERSION,
  masError,
  roomId,
  SERVER_NAME,
  SYNAPSE_VERSION,
  userId,
} from "../mocks/fixtures";
import { masFailing, matrixFailing } from "../mocks/failing";
import { usersList } from "../mocks/mas";
import { matrixError } from "../mocks/matrix";
import { expect, test } from "../mocks/test";

/**
 * Failed queries, in two shapes: a scoped failure degrades one dashboard tile
 * while the page survives, and a whole-page failure climbs to the root — no
 * route defines an error component — replacing the console layout. These
 * queries never retry (a loader-started fetch forces retry off), so failures
 * settle immediately. The error body picks the rendering: a decodable one is
 * quoted back inside the service's own message, an opaque one falls back to the
 * HTTP status.
 */

/** The error page's `h1`, i.e. "the whole page turned into an error page". */
const errorPageTitle = heading("An unexpected error occurred");

/** One tile of the dashboard grid, addressed by its title. */
const tile = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ hasText: title });

test.describe("a single dashboard tile failing", () => {
  test("degrades the Synapse version tile and keeps the rest of the page", async ({
    page,
    network,
  }) => {
    // The version tile is this query's only reader, and the loader does not
    // await it, so the rejection becomes a scoped fallback rather than a route
    // error.
    network.use(matrixFailing("/_synapse/admin/v1/server_version"));

    await loginAs(page);
    await page.goto("/");

    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();

    const synapseTile = tile(page, "Synapse version");
    await expect(synapseTile.getByText("Failed to load")).toBeVisible();
    await expect(
      synapseTile.getByRole("button", { name: "Retry" }),
    ).toBeVisible();
    await expect(page.getByText(SYNAPSE_VERSION)).toBeHidden();

    await expect(page.getByText(ESS_VERSION, { exact: true })).toBeVisible();
    await expect(
      tile(page, "Users registered").getByText(String(DEFAULT_USERS.length)),
    ).toBeVisible();
    await expect(
      tile(page, "Rooms total").getByText(String(DEFAULT_ROOMS.length)),
    ).toBeVisible();
    await expect(page.getByText("Failed to load")).toHaveCount(1);

    await expect(page.getByRole("heading", errorPageTitle)).toBeHidden();
    await expect(navEntry(page, "Users")).toBeVisible();
  });

  test("degrades the registered-users tile on a typed MAS error", async ({
    page,
    network,
  }) => {
    // The same boundary with the other MAS body shape: a decodable error
    // response. The dashboard only asks this endpoint for a count, so the
    // failure stays inside one tile.
    network.use(
      masFailing("/api/admin/v1/users", 500, masError("The database is down")),
    );

    await loginAs(page);
    await page.goto("/");

    const usersTile = tile(page, "Users registered");
    await expect(usersTile.getByText("Failed to load")).toBeVisible();

    await expect(page.getByText(SYNAPSE_VERSION)).toBeVisible();
    await expect(
      tile(page, "Rooms total").getByText(String(DEFAULT_ROOMS.length)),
    ).toBeVisible();
    await expect(page.getByText("Failed to load")).toHaveCount(1);
    await expect(page.getByRole("heading", errorPageTitle)).toBeHidden();
  });
});

test.describe("a list page's main query failing", () => {
  test("replaces /users with the generic error page", async ({
    page,
    network,
  }) => {
    // The list query is awaited by the loader, so its rejection is the route
    // match's error rather than a component's.
    network.use(
      masFailing(
        "/api/admin/v1/users",
        500,
        masError("Users are temporarily unavailable"),
      ),
    );

    await loginAs(page);
    await page.goto("/users");

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();

    // A decodable MAS body becomes a localized error carrying the titles it
    // listed, so the reader gets a sentence rather than the decoded object.
    await expect(
      page.getByText(
        "The homeserver's authentication service returned an error: Users are temporarily unavailable",
      ),
    ).toBeVisible();
    await expect(page.getByText('{"errors"')).toBeHidden();

    await expect(page.getByRole("heading", heading("Users"))).toBeHidden();
    await expect(page.getByRole("navigation")).toBeHidden();

    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out and reload" }),
    ).toBeVisible();
  });

  test("recovers the /users list when Retry finds a working endpoint", async ({
    page,
    network,
  }) => {
    network.use(masFailing("/api/admin/v1/users"));

    await loginAs(page);
    await page.goto("/users");

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();

    // "Retry" resets the boundary and invalidates the router, so the loader
    // runs again — against the working handler this time.
    network.use(usersList(DEFAULT_USERS));
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByRole("heading", heading("Users"))).toBeVisible();
    await expect(page.getByText(`@alice:${SERVER_NAME}`)).toBeVisible();
  });

  test("signs out from the error page and lands back on the login page", async ({
    page,
    network,
  }) => {
    network.use(masFailing("/api/admin/v1/users"));

    await loginAs(page);
    await page.goto("/users");

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();

    // The button revokes the token before reloading the document, and an
    // unmocked revocation would fail the run under strict mode.
    await page.getByRole("button", { name: "Sign out and reload" }).click();

    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", errorPageTitle)).toBeHidden();
  });

  test("replaces /rooms with the generic error page on an opaque failure", async ({
    page,
    network,
  }) => {
    // The branch a proxy or gateway error takes: a body that is not a Matrix
    // error cannot be decoded, so the underlying HTTP status error is rethrown
    // and rendered as its translated message.
    network.use(
      matrixFailing(
        "/_synapse/admin/v1/rooms",
        500,
        "<html><body>502 Bad Gateway</body></html>",
      ),
    );

    await loginAs(page);
    await page.goto("/rooms");

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();

    // Only the status code is asserted: the reason phrase depends on how the
    // fulfilled response is serialised.
    await expect(page.getByText("failed with status code 500")).toBeVisible();

    await expect(page.getByRole("heading", heading("Rooms"))).toBeHidden();
  });

  test("replaces /registration-tokens on an opaque MAS failure", async ({
    page,
    network,
  }) => {
    // The MAS side of the same distinction: a body that is not a MAS error
    // cannot be decoded, so the HTTP status error is thrown with the raw body
    // as its cause, which the cause chain still renders.
    network.use(
      masFailing(
        "/api/admin/v1/user-registration-tokens",
        502,
        "upstream connect error or disconnect/reset before headers",
      ),
    );

    await loginAs(page);
    await page.goto("/registration-tokens");

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();
    // Status code only, as above.
    await expect(page.getByText("failed with status code 502")).toBeVisible();
    await expect(
      page.getByText(
        "upstream connect error or disconnect/reset before headers",
      ),
    ).toBeVisible();
  });
});

test.describe("a detail page's query failing with a non-404", () => {
  test("shows the error page, not the not-found pane, for a user", async ({
    page,
    network,
  }) => {
    // Only a 404 turns into a not-found; every other status is rethrown, which
    // separates "this user does not exist" from "we could not find out".
    network.use(
      masFailing(
        "/api/admin/v1/users/:id",
        500,
        masError("Could not read the user"),
      ),
    );

    await loginAs(page);
    await page.goto(`/users/${userId(DEFAULT_USERS, 1)}`);

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();
    await expect(page.getByText("Could not read the user")).toBeVisible();

    await expect(page.getByText("User not found")).toBeHidden();
  });

  test("shows the error page, with the Matrix errcode, for a room", async ({
    page,
    network,
  }) => {
    // Synapse's rich-error branch: a decodable `{errcode, error}` renders as a
    // message interpolating both fields. Turning it into a not-found instead
    // would need both a 404 and `M_NOT_FOUND`, and this is neither.
    network.use(
      matrixFailing(
        "/_synapse/admin/v1/rooms/:roomId",
        500,
        matrixError("M_UNKNOWN", "The room store is unavailable"),
      ),
    );

    await loginAs(page);
    await page.goto(`/rooms/${encodeURIComponent(roomId(DEFAULT_ROOMS, 0))}`);

    await expect(page.getByRole("heading", errorPageTitle)).toBeVisible();

    await expect(page.getByText("M_UNKNOWN")).toBeVisible();
    await expect(page.getByText("The room store is unavailable")).toBeVisible();

    await expect(page.getByText("Room not found")).toBeHidden();
    await expect(page.getByText(`#general:${SERVER_NAME}`)).toBeHidden();
  });
});
