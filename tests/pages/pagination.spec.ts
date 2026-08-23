// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Locator, Page } from "@playwright/test";

import { loginAs } from "../mocks/auth";
import {
  type DestinationOverrides,
  destinationName,
  PAGE_SIZE,
  type RoomOverrides,
  SERVER_NAME,
  userId,
  type UserOverrides,
} from "../mocks/fixtures";
import { usersPaginated } from "../mocks/mas";
import {
  federationDestinationsPaginated,
  roomDetail,
  roomsPaginated,
} from "../mocks/matrix";
import { expect, test } from "../mocks/test";

/**
 * Infinite-list pagination. There is no load-more button: the window is the
 * scroll container and the next page is fetched as the end nears, so scrolling
 * is the only trigger. `PAGE_SIZE` is 200, so a real second page needs over 200
 * items. The three collections cover the three mechanisms — a MAS opaque
 * cursor, a Synapse offset via `next_batch`, and the same offset via
 * `next_token` as a string — and each asserts the observed request sequence.
 */

/** One full page plus a short one, so the second page is unmistakably second. */
const SECOND_PAGE = 50;
const TOTAL = PAGE_SIZE + SECOND_PAGE;

/**
 * The tail row rendered while another page remains. It is virtualized like any
 * other row, so it is only in the DOM when the bottom of the list is on screen.
 */
const loadingRow = (page: Page): Locator =>
  page.getByText("Loading more…", { exact: true });

const scrollToBottom = (page: Page): Promise<void> =>
  page.evaluate(() => {
    globalThis.window.scrollTo(
      0,
      globalThis.document.documentElement.scrollHeight,
    );
  });

/**
 * Scroll the window to the bottom until `locator` is on screen. One scroll is
 * not enough: reaching the bottom is what triggers the fetch, and the page that
 * arrives makes the document taller, putting the target row below the new
 * bottom.
 */
const scrollUntilVisible = async (
  page: Page,
  locator: Locator,
): Promise<void> => {
  await expect(async () => {
    await scrollToBottom(page);
    await expect(locator).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
};

test.describe("rooms — Synapse offset pagination (`from` / `next_batch`)", () => {
  // Every generated room has a name, so no row falls back to naming itself from
  // a members query.
  const ROOMS: RoomOverrides[] = Array.from({ length: TOTAL }, () => ({}));
  const firstRoom = "Room 0";
  const lastRoom = `Room ${TOTAL - 1}`;

  test("loads the second page when the list is scrolled to the bottom", async ({
    page,
    network,
  }) => {
    const requested: (string | null)[] = [];
    network.use(
      roomsPaginated(ROOMS, (from) => requested.push(from)),
      roomDetail(ROOMS),
    );

    await loginAs(page);
    await page.goto("/rooms");

    await expect(
      page.getByRole("heading", { name: "Rooms", exact: true, level: 1 }),
    ).toBeVisible();

    // The count heading reports the whole collection, not the rows loaded so
    // far, before and after the second page lands.
    await expect(
      page.getByText(`${TOTAL} rooms`, { exact: true }),
    ).toBeVisible();

    // Page one is rows 0–199, so the last row is only in the DOM after a second
    // fetch.
    await expect(page.getByText(firstRoom, { exact: true })).toBeVisible();
    await expect(page.getByText(lastRoom, { exact: true })).toHaveCount(0);
    expect(requested).toEqual([null]);

    await scrollUntilVisible(page, page.getByText(lastRoom, { exact: true }));

    expect(requested).toEqual([null, String(PAGE_SIZE)]);

    await expect(
      page.getByText(`${TOTAL} rooms`, { exact: true }),
    ).toBeVisible();

    // Page two carries no `next_batch`, and once the tail row is gone no third
    // request can still be in flight for the sequence check to miss.
    await expect(loadingRow(page)).toHaveCount(0);
    expect(requested).toEqual([null, String(PAGE_SIZE)]);
  });
});

test.describe("federation destinations — Synapse `from` / `next_token`", () => {
  const DESTINATIONS: DestinationOverrides[] = Array.from(
    { length: TOTAL },
    () => ({}),
  );
  const firstDomain = destinationName(DESTINATIONS, 0);
  const lastDomain = destinationName(DESTINATIONS, TOTAL - 1);

  test("loads the second page, continuing from a string token", async ({
    page,
    network,
  }) => {
    const requested: (string | null)[] = [];
    network.use(
      federationDestinationsPaginated(DESTINATIONS, (from) =>
        requested.push(from),
      ),
    );

    await loginAs(page);
    await page.goto("/federation/known-domains");

    // Every federation tab shares one page title, so the count heading below is
    // what identifies this one.
    await expect(
      page.getByRole("heading", { name: "Federation", exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(`${TOTAL} domains`, { exact: true }),
    ).toBeVisible();

    await expect(page.getByText(firstDomain, { exact: true })).toBeVisible();
    await expect(page.getByText(lastDomain, { exact: true })).toHaveCount(0);
    expect(requested).toEqual([null]);

    await scrollUntilVisible(page, page.getByText(lastDomain, { exact: true }));

    // `next_token` is typed `string | number`, and the fixture returns the
    // string form Synapse sends here.
    expect(requested).toEqual([null, String(PAGE_SIZE)]);

    await expect(
      page.getByText(`${TOTAL} domains`, { exact: true }),
    ).toBeVisible();

    await expect(loadingRow(page)).toHaveCount(0);
    expect(requested).toEqual([null, String(PAGE_SIZE)]);
  });

  test("stops at a first page that is exactly PAGE_SIZE long", async ({
    page,
    network,
  }) => {
    // The off-by-one boundary of "are there items left after this page": a full
    // page that happens to be the last one must not lead to a request for an
    // empty second page.
    const FULL_PAGE_DESTINATIONS: DestinationOverrides[] = Array.from(
      { length: PAGE_SIZE },
      () => ({}),
    );
    const requested: (string | null)[] = [];
    network.use(
      federationDestinationsPaginated(FULL_PAGE_DESTINATIONS, (from) =>
        requested.push(from),
      ),
    );

    await loginAs(page);
    await page.goto("/federation/known-domains");

    await expect(
      page.getByText(`${PAGE_SIZE} domains`, { exact: true }),
    ).toBeVisible();

    await scrollUntilVisible(
      page,
      page.getByText(destinationName(FULL_PAGE_DESTINATIONS, PAGE_SIZE - 1), {
        exact: true,
      }),
    );

    await expect(loadingRow(page)).toHaveCount(0);
    expect(requested).toEqual([null]);
  });
});

test.describe("users — MAS cursor pagination (`page[after]`)", () => {
  // None of these users has a Matrix profile, so every row degrades to its bare
  // Matrix ID and fetches no avatar thumbnail.
  const USERS: UserOverrides[] = Array.from({ length: TOTAL }, () => ({}));
  const firstUser = `@user0:${SERVER_NAME}`;
  const lastUser = `@user${TOTAL - 1}:${SERVER_NAME}`;

  /**
   * The cursor page two must be asked for: the last item of page one, whose
   * cursor is its own ULID. Asserting it proves the app read the cursor off the
   * page rather than counting requests.
   */
  const pageOneCursor = userId(USERS, PAGE_SIZE - 1);

  test("loads the second page using the last item's cursor", async ({
    page,
    network,
  }) => {
    const requested: (string | null)[] = [];
    network.use(usersPaginated(USERS, (after) => requested.push(after)));

    await loginAs(page);
    await page.goto("/users");

    await expect(
      page.getByRole("heading", { name: "Users", exact: true, level: 1 }),
    ).toBeVisible();

    await expect(
      page.getByText(`${TOTAL} users`, { exact: true }),
    ).toBeVisible();

    await expect(page.getByText(firstUser, { exact: true })).toBeVisible();
    await expect(page.getByText(lastUser, { exact: true })).toHaveCount(0);
    expect(requested).toEqual([null]);

    await scrollUntilVisible(page, page.getByText(lastUser, { exact: true }));

    expect(requested).toEqual([null, pageOneCursor]);

    await expect(
      page.getByText(`${TOTAL} users`, { exact: true }),
    ).toBeVisible();

    // Page two has no `links.next`, so the app stops asking; a `next` left on
    // the final page would keep it requesting pages that no longer exist.
    await expect(loadingRow(page)).toHaveCount(0);
    expect(requested).toEqual([null, pageOneCursor]);
  });
});
