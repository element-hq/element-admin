// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { RequestHandler } from "msw";

import { ALLOWLIST_SUBTITLE, expectRowCount, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  compatSessionsList,
  oauth2ClientsList,
  oauth2SessionsList,
  personalSessionsList,
  registrationTokensList,
  usersList,
} from "../mocks/mas";
import {
  federationAllowlist,
  federationDestinations,
  rooms,
} from "../mocks/matrix";
import { expect, test } from "../mocks/test";

/**
 * Zero-item collections, a separate rendering path from a populated list. There
 * is no empty-table placeholder, so a page's empty state is its count heading
 * plus the absence of data rows. `/federation/allowed-domains` is the one page
 * with empty-state copy of its own.
 */

/**
 * One row per list page: the handler that serves nothing, the route, its `h1`
 * and its count heading. Every federation tab shares the "Federation" title, so
 * there the count heading is also what identifies the tab.
 */
const EMPTY_LISTS: {
  handler: () => RequestHandler;
  path: string;
  title: string;
  empty: string;
}[] = [
  {
    handler: () => usersList([]),
    path: "/users",
    title: "Users",
    empty: "No users",
  },
  {
    handler: () => rooms([]),
    path: "/rooms",
    title: "Rooms",
    empty: "No rooms",
  },
  {
    handler: () => oauth2SessionsList([]),
    path: "/devices/user",
    title: "User devices",
    empty: "No devices",
  },
  {
    handler: () => compatSessionsList([]),
    path: "/devices/legacy",
    title: "Legacy devices",
    empty: "No legacy devices",
  },
  {
    handler: () => oauth2ClientsList([]),
    path: "/devices/applications",
    title: "Applications",
    empty: "No applications",
  },
  {
    handler: () => federationDestinations([]),
    path: "/federation/known-domains",
    title: "Federation",
    empty: "No domains",
  },
  {
    handler: () => registrationTokensList([]),
    path: "/registration-tokens",
    title: "Registration tokens",
    empty: "No tokens",
  },
  {
    handler: () => personalSessionsList([]),
    path: "/personal-tokens",
    title: "Personal tokens",
    empty: "No personal tokens",
  },
];

test.describe("empty collections", () => {
  for (const { handler, path, title, empty } of EMPTY_LISTS) {
    test(`renders ${path} with ${empty.toLowerCase()}`, async ({
      page,
      network,
    }) => {
      network.use(handler());

      await loginAs(page);
      await page.goto(path);

      await expect(page.getByRole("heading", heading(title))).toBeVisible();

      await expect(page.getByText(empty, { exact: true })).toBeVisible();
      await expectRowCount(page, 0);
    });
  }

  test("renders /federation/allowed-domains with an empty allowlist", async ({
    page,
    network,
  }) => {
    // The availability probe is answered by the same handler, so it too returns
    // 200 with an empty list: the module is present and has nothing in it.
    network.use(federationAllowlist([]));

    await loginAs(page);
    await page.goto("/federation/allowed-domains");

    await expect(
      page.getByRole("heading", heading("Federation")),
    ).toBeVisible();

    await expect(page.getByText(ALLOWLIST_SUBTITLE)).toBeVisible();

    // The console's only real empty-state copy; everywhere else the count
    // heading is the empty state.
    await expect(
      page.getByText(
        "No domains in the allowlist yet. Add a domain pattern above to get started.",
      ),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Add domain" }),
    ).toBeVisible();
  });
});
