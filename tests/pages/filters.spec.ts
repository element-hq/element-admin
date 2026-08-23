// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { NetworkFixture } from "@msw/playwright";
import type { Page } from "@playwright/test";

import { expectRowCount, heading, navEntry } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  clientId,
  DEFAULT_OAUTH2_CLIENTS,
  type RoomOverrides,
  SERVER_NAME,
  type UserOverrides,
  type UserRelations,
} from "../mocks/fixtures";
import { observeQuery, usersFiltered } from "../mocks/mas";
import { roomDetail, roomsFiltered } from "../mocks/matrix";
import { expect, test } from "../mocks/test";

/**
 * Filters and search: the mapping from a UI control to the query parameters it
 * emits, and the rows and count that come back. A filter wired to the wrong
 * parameter looks fine on screen, so every test asserts on the observed
 * parameters as well as on the DOM. The rows and the count are separate
 * requests and both have to carry the filters, so both are asserted. Matching
 * is on parsed parameters, since the emitted order is not contractual. Search
 * boxes are debounced, so every wait here is a retrying assertion.
 */

/**
 * One observed request's query parameters. Repeated parameters keep every
 * value, because `filter[active-oauth2-client]` is emitted in exploded form
 * (`…=A&…=B`) and a single-valued map would silently drop half of it.
 */
type Observed = Record<string, string[]>;

const observe = (parameters: URLSearchParams): Observed =>
  Object.fromEntries(
    [...new Set(parameters.keys())].map((key) => [key, parameters.getAll(key)]),
  );

/**
 * Only the `filter[...]` half of an observed request. Asserting on exactly this
 * with `toEqual` fails for a spurious filter as well as for a missing one.
 */
const filtersOf = (request: Observed | undefined): Observed =>
  Object.fromEntries(
    Object.entries(request ?? {}).filter(([key]) => key.startsWith("filter[")),
  );

/** `?count=only`: the header-count request, not the rows one. */
const isCountRequest = (request: Observed): boolean =>
  request["count"]?.[0] === "only";

/**
 * A recorder for one endpoint: `onRequest` goes to a handler factory, and the
 * accessors read back what the app asked for. `rows` and `counts` split the two
 * request forms a MAS list page makes, which land in either order.
 */
const recorder = (): {
  onRequest: (parameters: URLSearchParams) => void;
  rows: () => Observed[];
  counts: () => Observed[];
  lastRows: () => Observed | undefined;
  lastCount: () => Observed | undefined;
} => {
  const all: Observed[] = [];
  const rows = (): Observed[] =>
    all.filter((request) => !isCountRequest(request));
  const counts = (): Observed[] =>
    all.filter((request) => isCountRequest(request));

  return {
    onRequest: (parameters: URLSearchParams): void => {
      all.push(observe(parameters));
    },
    rows,
    counts,
    lastRows: () => rows().at(-1),
    lastCount: () => counts().at(-1),
  };
};

/** The `DataTable.FilterMenu` trigger: an icon button labelled "Filter". */
const openFilterMenu = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByRole("menu")).toBeVisible();
};

/**
 * Toggle one `CheckboxMenuItem` in the filter menu, then close the menu. The
 * menu stays open across a selection, so it has to be dismissed explicitly:
 * left open it overlays the table and makes later row assertions ambiguous.
 */
const toggleFilter = async (page: Page, label: string): Promise<void> => {
  await openFilterMenu(page);
  await page
    .getByRole("menuitemcheckbox", { name: label, exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
};

/** The route's own search parameters, which is what makes a filter linkable. */
const searchParameters = (page: Page): URLSearchParams =>
  new URL(page.url()).searchParams;

const mxid = (username: string): string => `@${username}:${SERVER_NAME}`;

test.describe("/users", () => {
  /**
   * Five users, each satisfying exactly one branch of an attribute-derived
   * filter: `alicia` is the admin, `bob` is locked, `carol` is deactivated,
   * `guest42` is the legacy guest, and `alice` is none of those. The two `ali`
   * prefixes let a substring search pick a strict subset.
   */
  const USERS: UserOverrides[] = [
    { username: "alice" },
    { username: "alicia", admin: true },
    { username: "bob", locked_at: "2026-07-01T09:00:00.000000Z" },
    { username: "carol", deactivated_at: "2026-07-02T09:00:00.000000Z" },
    { username: "guest42", legacy_guest: true },
  ];

  /**
   * MAS answers these two filters by joining against the session tables, so a
   * fixture has to state them outright. `alice` has an active legacy device;
   * `alicia` has an active device on the first fixture application.
   */
  const ELEMENT_WEB = clientId(DEFAULT_OAUTH2_CLIENTS, 0);
  const RELATIONS: UserRelations = {
    activeCompatSessions: [0],
    activeClients: { 1: [ELEMENT_WEB] },
  };

  /** A user row is identified by its Matrix ID cell. */
  const mxidCell = (page: Page, username: string) =>
    page.getByText(mxid(username), { exact: true });

  /** Returns the recorder for the users handler it installs. */
  const visit = async (
    page: Page,
    network: NetworkFixture,
    search = "",
  ): Promise<ReturnType<typeof recorder>> => {
    const requests = recorder();
    network.use(
      usersFiltered(USERS, {
        onRequest: requests.onRequest,
        relations: RELATIONS,
      }),
    );

    await loginAs(page);
    await page.goto(`/users${search}`);
    await expect(page.getByRole("heading", heading("Users"))).toBeVisible();

    return requests;
  };

  test("sends no filters at all when nothing is filtered", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    // The unfiltered baseline every test below narrows from: all five users, so
    // a later "1 user" cannot be a small fixture.
    await expect(page.getByText("5 users", { exact: true })).toBeVisible();
    await expectRowCount(page, 5);

    expect(filtersOf(requests.lastRows())).toEqual({});
    expect(filtersOf(requests.lastCount())).toEqual({});
    // The row query pages forward, which is what `dir=backward` flips.
    expect(requests.lastRows()?.["page[first]"]).toEqual(["200"]);
  });

  test("the search box sends filter[search] and filters rows and count alike", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    await page.getByPlaceholder("Search users…").fill("ali");

    await expect(page.getByText("2 users", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alice")).toBeVisible();
    await expect(mxidCell(page, "alicia")).toBeVisible();
    await expect(mxidCell(page, "bob")).toBeHidden();
    await expectRowCount(page, 2);

    expect(searchParameters(page).get("search")).toBe("ali");

    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[search]": ["ali"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[search]": ["ali"],
    });
  });

  test("Admins sends filter[admin]=true, and un-toggling removes it without refetching", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    await toggleFilter(page, "Admins");

    await expect(page.getByText("1 user", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alicia")).toBeVisible();
    await expect(mxidCell(page, "alice")).toBeHidden();
    await expectRowCount(page, 1);

    expect(searchParameters(page).get("admin")).toBe("true");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[admin]": ["true"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[admin]": ["true"],
    });

    // Toggling the same item again removes the filter rather than negating it:
    // there is no "Non-admins" item, and `filter[admin]=false` must not appear.
    const requestsSoFar = requests.rows().length;
    await toggleFilter(page, "Admins");

    await expect(page.getByText("5 users", { exact: true })).toBeVisible();
    await expectRowCount(page, 5);
    expect(searchParameters(page).has("admin")).toBe(false);

    // No new request at all: the filters are part of the query key, so going
    // back to the unfiltered list is a cache hit on the initial load's query.
    expect(requests.rows()).toHaveLength(requestsSoFar);
  });

  test("the three account-status filters send filter[status]", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    // The three share one search parameter, so selecting one in the same visit
    // replaces the previous. "Active" is the residual status — neither locked
    // nor deactivated — so it catches the legacy guest too.
    await toggleFilter(page, "Active users");

    await expect(page.getByText("3 users", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alice")).toBeVisible();
    await expectRowCount(page, 3);
    expect(searchParameters(page).get("status")).toBe("active");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[status]": ["active"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[status]": ["active"],
    });

    await toggleFilter(page, "Locked users");

    await expect(page.getByText("1 user", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "bob")).toBeVisible();
    await expectRowCount(page, 1);
    expect(searchParameters(page).get("status")).toBe("locked");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[status]": ["locked"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[status]": ["locked"],
    });

    await toggleFilter(page, "Deactivated users");

    await expect(page.getByText("1 user", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "carol")).toBeVisible();
    await expectRowCount(page, 1);
    expect(searchParameters(page).get("status")).toBe("deactivated");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[status]": ["deactivated"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[status]": ["deactivated"],
    });
  });

  test("the guest filters send filter[legacy-guest]", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    await toggleFilter(page, "Guests (legacy)");

    await expect(page.getByText("1 user", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "guest42")).toBeVisible();
    await expectRowCount(page, 1);
    expect(searchParameters(page).get("guest")).toBe("true");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[legacy-guest]": ["true"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[legacy-guest]": ["true"],
    });

    await toggleFilter(page, "Non-guests (legacy)");

    await expect(page.getByText("4 users", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "guest42")).toBeHidden();
    await expectRowCount(page, 4);
    expect(searchParameters(page).get("guest")).toBe("false");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[legacy-guest]": ["false"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[legacy-guest]": ["false"],
    });
  });

  test("the legacy-device filters send filter[has-active-compat-session]", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    await toggleFilter(page, "Has active legacy device");

    await expect(page.getByText("1 user", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alice")).toBeVisible();
    await expectRowCount(page, 1);
    expect(searchParameters(page).get("legacy")).toBe("true");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[has-active-compat-session]": ["true"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[has-active-compat-session]": ["true"],
    });

    await toggleFilter(page, "No active legacy device");

    await expect(page.getByText("4 users", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alice")).toBeHidden();
    await expectRowCount(page, 4);
    expect(searchParameters(page).get("legacy")).toBe("false");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[has-active-compat-session]": ["false"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[has-active-compat-session]": ["false"],
    });
  });

  test("?client= sends an exploded filter[active-oauth2-client] and a removable chip", async ({
    page,
    network,
  }) => {
    // The one user filter with no menu item and no link in the console:
    // `?client=` is reachable only by URL, and the page turns it into a
    // removable chip.
    const requests = await visit(
      page,
      network,
      `?client=${encodeURIComponent(JSON.stringify([ELEMENT_WEB]))}`,
    );

    await expect(page.getByText("1 user", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alicia")).toBeVisible();
    await expectRowCount(page, 1);

    // Exploded form, one value per occurrence — a comma-joined single value
    // would be a different serialization.
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[active-oauth2-client]": [ELEMENT_WEB],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[active-oauth2-client]": [ELEMENT_WEB],
    });

    // The chip names the application, so the ULID was resolved rather than
    // echoed.
    const chip = page.getByText("Has active device on: Element Web", {
      exact: true,
    });
    await expect(chip).toBeVisible();

    await page.getByRole("link", { name: "Remove" }).click();

    await expect(page.getByText("5 users", { exact: true })).toBeVisible();
    await expect(chip).toBeHidden();
    await expectRowCount(page, 5);
    expect(searchParameters(page).has("client")).toBe(false);
    expect(filtersOf(requests.lastRows())).toEqual({});
  });

  test("two filters compose into two query parameters", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    await openFilterMenu(page);
    await page
      .getByRole("menuitemcheckbox", { name: "Admins", exact: true })
      .click();
    await page
      .getByRole("menuitemcheckbox", { name: "Active users", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();

    // `alicia` is the only user who is both an admin and active.
    await expect(page.getByText("1 user", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alicia")).toBeVisible();
    await expectRowCount(page, 1);

    const parameters = searchParameters(page);
    expect(parameters.get("admin")).toBe("true");
    expect(parameters.get("status")).toBe("active");

    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[admin]": ["true"],
      "filter[status]": ["active"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[admin]": ["true"],
      "filter[status]": ["active"],
    });

    // "Clear" drops both filters, and like un-toggling a single one it fires no
    // request: the unfiltered query is already cached from the initial load.
    const requestsSoFar = requests.rows().length;
    await page.getByRole("link", { name: "Clear", exact: true }).click();

    await expect(page.getByText("5 users", { exact: true })).toBeVisible();
    await expectRowCount(page, 5);
    expect(searchParameters(page).toString()).toBe("");
    await expect(page.getByRole("link", { name: "Clear" })).toBeHidden();
    expect(requests.rows()).toHaveLength(requestsSoFar);
  });

  test("Clear drops the filters and keeps the search term", async ({
    page,
    network,
  }) => {
    // "Clear" unsets the keys of the filter definition, and search is not one
    // of them: the search box is not a filter chip, so it survives.
    const requests = await visit(page, network);

    await toggleFilter(page, "Admins");
    await expect(page.getByText("1 user", { exact: true })).toBeVisible();

    await page.getByPlaceholder("Search users…").fill("ali");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({ "filter[admin]": ["true"], "filter[search]": ["ali"] });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({ "filter[admin]": ["true"], "filter[search]": ["ali"] });

    await page.getByRole("link", { name: "Clear", exact: true }).click();

    // Search-only was never requested before, so this reads a new request
    // rather than a cached one.
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({ "filter[search]": ["ali"] });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({ "filter[search]": ["ali"] });

    await expect(page.getByText("2 users", { exact: true })).toBeVisible();
    await expect(mxidCell(page, "alice")).toBeVisible();
    await expect(mxidCell(page, "alicia")).toBeVisible();

    const parameters = searchParameters(page);
    expect(parameters.get("search")).toBe("ali");
    expect(parameters.has("admin")).toBe(false);
    await expect(page.getByPlaceholder("Search users…")).toHaveValue("ali");
  });

  test("Newest first flips the pagination direction instead of adding a filter", async ({
    page,
    network,
  }) => {
    // The odd one out in the filter menu: "Newest first" is the infinite
    // query's direction, so it swaps `page[first]` for `page[last]` and adds no
    // filter.
    const requests = await visit(page, network);

    await expect
      .poll(() => requests.lastRows()?.["page[first]"])
      .toEqual(["200"]);
    expect(requests.lastRows()?.["page[last]"]).toBeUndefined();

    await toggleFilter(page, "Newest first");

    await expect
      .poll(() => requests.lastRows()?.["page[last]"])
      .toEqual(["200"]);
    expect(requests.lastRows()?.["page[first]"]).toBeUndefined();
    expect(filtersOf(requests.lastRows())).toEqual({});
    expect(searchParameters(page).get("dir")).toBe("backward");

    // The count query has no direction, so the heading is unchanged.
    await expect(page.getByText("5 users", { exact: true })).toBeVisible();
    expect(filtersOf(requests.lastCount())).toEqual({});
  });

  test("the sidebar link lands on the Active users filter", async ({
    page,
    network,
  }) => {
    // The sidebar's "Users" entry points at `?status=active`, the only filter
    // any navigation applies on the user's behalf.
    const requests = await visit(page, network);

    await expect(page.getByText("5 users", { exact: true })).toBeVisible();

    await navEntry(page, "Users").click();

    await expect(page.getByText("3 users", { exact: true })).toBeVisible();
    expect(searchParameters(page).get("status")).toBe("active");
    expect(filtersOf(requests.lastRows())).toEqual({
      "filter[status]": ["active"],
    });
    expect(filtersOf(requests.lastCount())).toEqual({
      "filter[status]": ["active"],
    });
  });
});

test.describe("/rooms", () => {
  /**
   * Four rooms spanning the three Synapse room filters. Every one has a `name`,
   * which keeps the rows from firing a members query each; the last has no
   * members at all, which is the only way to exercise `empty_rooms`.
   */
  const ROOMS: RoomOverrides[] = [
    {
      name: "General",
      canonical_alias: `#general:${SERVER_NAME}`,
      public: true,
    },
    { name: "General chatter", joined_members: 4 },
    { name: "Private planning", joined_members: 2 },
    { name: "Deserted", joined_members: 0, joined_local_members: 0 },
  ];

  const visit = async (
    page: Page,
    network: NetworkFixture,
  ): Promise<ReturnType<typeof recorder>> => {
    const requests = recorder();
    network.use(
      roomsFiltered(ROOMS, requests.onRequest),
      // Each rendered row fetches its own room for the avatar, so the detail
      // handler has to know the same rooms as the list one.
      roomDetail(ROOMS),
    );

    await loginAs(page);
    await page.goto("/rooms");
    await expect(page.getByRole("heading", heading("Rooms"))).toBeVisible();

    return requests;
  };

  test("sends no filters at all when nothing is filtered", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    await expect(page.getByText("4 rooms", { exact: true })).toBeVisible();
    await expectRowCount(page, 4);

    // The unfiltered baseline for the rooms tests: `limit` is the only
    // parameter an unfiltered list carries.
    expect(requests.lastRows()).toEqual({ limit: ["200"] });
  });

  test("the search box sends search_term", async ({ page, network }) => {
    const requests = await visit(page, network);

    await page.getByPlaceholder("Search…").fill("General");

    await expect(page.getByText("2 rooms", { exact: true })).toBeVisible();
    await expect(page.getByText("General", { exact: true })).toBeVisible();
    await expect(page.getByText("Deserted", { exact: true })).toBeHidden();
    await expectRowCount(page, 2);

    expect(searchParameters(page).get("search_term")).toBe("General");
    expect(requests.lastRows()?.["search_term"]).toEqual(["General"]);
  });

  test("the room-visibility filters send public_rooms", async ({
    page,
    network,
  }) => {
    const requests = await visit(page, network);

    await toggleFilter(page, "Public rooms");

    await expect(page.getByText("1 room", { exact: true })).toBeVisible();
    await expect(page.getByText("General", { exact: true })).toBeVisible();
    await expectRowCount(page, 1);
    expect(searchParameters(page).get("public_rooms")).toBe("true");
    expect(requests.lastRows()?.["public_rooms"]).toEqual(["true"]);

    await toggleFilter(page, "Private rooms");

    await expect(page.getByText("3 rooms", { exact: true })).toBeVisible();
    await expect(page.getByText("General", { exact: true })).toBeHidden();
    expect(searchParameters(page).get("public_rooms")).toBe("false");
    expect(requests.lastRows()?.["public_rooms"]).toEqual(["false"]);
  });

  test("the emptiness filters send empty_rooms", async ({ page, network }) => {
    const requests = await visit(page, network);

    await toggleFilter(page, "Empty rooms");

    await expect(page.getByText("1 room", { exact: true })).toBeVisible();
    await expect(page.getByText("Deserted", { exact: true })).toBeVisible();
    await expectRowCount(page, 1);
    expect(searchParameters(page).get("empty_rooms")).toBe("true");
    expect(requests.lastRows()?.["empty_rooms"]).toEqual(["true"]);

    await toggleFilter(page, "Non-empty rooms");

    await expect(page.getByText("3 rooms", { exact: true })).toBeVisible();
    await expect(page.getByText("Deserted", { exact: true })).toBeHidden();
    expect(searchParameters(page).get("empty_rooms")).toBe("false");
    expect(requests.lastRows()?.["empty_rooms"]).toEqual(["false"]);
  });

  test("a search term and a filter compose", async ({ page, network }) => {
    const requests = await visit(page, network);

    await page.getByPlaceholder("Search…").fill("General");
    await expect(page.getByText("2 rooms", { exact: true })).toBeVisible();

    await toggleFilter(page, "Public rooms");

    // Only the first room is both named "General…" and public.
    await expect(page.getByText("1 room", { exact: true })).toBeVisible();
    await expect(page.getByText("General", { exact: true })).toBeVisible();
    await expectRowCount(page, 1);

    // The whole request, so a dropped `limit` would show up too.
    expect(requests.lastRows()).toEqual({
      limit: ["200"],
      search_term: ["General"],
      public_rooms: ["true"],
    });
  });
});

/**
 * The remaining list pages, covered on the request side only: `observeQuery`
 * records a request and falls through to the deployment's own handler, so the
 * rows and the count stay unfiltered. Nothing visible changes when a filter is
 * applied, so the wait is `expect.poll` on the recorded request rather than a
 * DOM assertion.
 */
test.describe("device and token lists — emitted parameters", () => {
  const install = (
    network: NetworkFixture,
    path: string,
  ): ReturnType<typeof recorder> => {
    const requests = recorder();
    network.use(observeQuery(path, requests.onRequest));
    return requests;
  };

  test("/devices/user always narrows to dynamic clients, and maps the activity buckets to filter[status]", async ({
    page,
    network,
  }) => {
    const requests = install(network, "/api/admin/v1/oauth2-sessions");

    await loginAs(page);
    await page.goto("/devices/user");
    await expect(
      page.getByRole("heading", heading("User devices")),
    ).toBeVisible();

    // Two filters with no control behind them: devices of statically-registered
    // applications are hidden everywhere, and with no activity bucket selected
    // the list hides signed-out devices. Both requests carry them.
    const defaults = {
      "filter[client-kind]": ["dynamic"],
      "filter[status]": ["active"],
    };
    await expect.poll(() => filtersOf(requests.lastRows())).toEqual(defaults);
    await expect.poll(() => filtersOf(requests.lastCount())).toEqual(defaults);

    await toggleFilter(page, "Signed out");

    // "Signed out" is the one bucket that changes `filter[status]`; the others
    // keep `active` and add a last-active bound.
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[client-kind]": ["dynamic"],
        "filter[status]": ["finished"],
      });
    expect(searchParameters(page).get("activity")).toBe("signed-out");

    await toggleFilter(page, "Recently used");

    // The bound derives from the current clock, so only the presence of
    // `filter[last-active-after]` is assertable; a fixed value would rot.
    await expect
      .poll(() => Object.keys(filtersOf(requests.lastRows())).toSorted())
      .toEqual([
        "filter[client-kind]",
        "filter[last-active-after]",
        "filter[status]",
      ]);
    expect(requests.lastRows()?.["filter[status]"]).toEqual(["active"]);
    expect(searchParameters(page).get("activity")).toBe("recently-used");
  });

  test("/devices/legacy narrows to active sessions and has no client-kind filter", async ({
    page,
    network,
  }) => {
    const requests = install(network, "/api/admin/v1/compat-sessions");

    await loginAs(page);
    await page.goto("/devices/legacy");
    await expect(
      page.getByRole("heading", heading("Legacy devices")),
    ).toBeVisible();

    // The same activity mapping as `/devices/user`, but a compatibility session
    // has no client, so there is no `filter[client-kind]` to add.
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({ "filter[status]": ["active"] });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({ "filter[status]": ["active"] });

    await toggleFilter(page, "Signed out");

    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({ "filter[status]": ["finished"] });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({ "filter[status]": ["finished"] });
    expect(searchParameters(page).get("activity")).toBe("signed-out");
  });

  test("/devices/applications maps its search box to filter[client-name]", async ({
    page,
    network,
  }) => {
    const requests = install(network, "/api/admin/v1/oauth2-clients");

    await loginAs(page);
    await page.goto("/devices/applications");
    await expect(
      page.getByRole("heading", heading("Applications")),
    ).toBeVisible();

    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({ "filter[client-kind]": ["dynamic"] });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({ "filter[client-kind]": ["dynamic"] });

    // The search box is `name` in the route and `filter[client-name]` in the
    // API.
    await page.getByPlaceholder("Search by name…").fill("Element");

    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[client-kind]": ["dynamic"],
        "filter[client-name]": ["Element"],
      });
    expect(searchParameters(page).get("name")).toBe("Element");

    await toggleFilter(page, "With active devices");

    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[client-kind]": ["dynamic"],
        "filter[client-name]": ["Element"],
        "filter[has-active-sessions]": ["true"],
      });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({
        "filter[client-kind]": ["dynamic"],
        "filter[client-name]": ["Element"],
        "filter[has-active-sessions]": ["true"],
      });
    expect(searchParameters(page).get("hasActiveSessions")).toBe("true");
  });

  test("/registration-tokens maps its four filters to four boolean parameters", async ({
    page,
    network,
  }) => {
    const requests = install(network, "/api/admin/v1/user-registration-tokens");

    await loginAs(page);
    await page.goto("/registration-tokens");
    await expect(
      page.getByRole("heading", heading("Registration tokens")),
    ).toBeVisible();

    // An unfiltered list emits no `filter[...]` at all, so the recorder has to
    // have caught a request before that is worth asserting.
    await expect.poll(() => requests.rows().length).toBeGreaterThan(0);
    expect(filtersOf(requests.lastRows())).toEqual({});

    // Four independent booleans rather than one status picklist, so each item
    // adds a parameter instead of replacing the previous one.
    await toggleFilter(page, "Active");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({ "filter[valid]": ["true"] });

    await toggleFilter(page, "Revoked");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[valid]": ["true"],
        "filter[revoked]": ["true"],
      });

    await toggleFilter(page, "Expired");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[valid]": ["true"],
        "filter[revoked]": ["true"],
        "filter[expired]": ["true"],
      });

    await toggleFilter(page, "Unused");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[valid]": ["true"],
        "filter[revoked]": ["true"],
        "filter[expired]": ["true"],
        "filter[used]": ["false"],
      });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({
        "filter[valid]": ["true"],
        "filter[revoked]": ["true"],
        "filter[expired]": ["true"],
        "filter[used]": ["false"],
      });

    const parameters = searchParameters(page);
    expect(parameters.get("valid")).toBe("true");
    expect(parameters.get("revoked")).toBe("true");
    expect(parameters.get("expired")).toBe("true");
    expect(parameters.get("used")).toBe("false");
  });

  test("/personal-tokens maps status, expiry and scope", async ({
    page,
    network,
  }) => {
    const requests = install(network, "/api/admin/v1/personal-sessions");

    await loginAs(page);
    await page.goto("/personal-tokens");
    await expect(
      page.getByRole("heading", heading("Personal tokens")),
    ).toBeVisible();

    // As on /registration-tokens: an unfiltered list emits no `filter[...]` at
    // all.
    await expect.poll(() => requests.rows().length).toBeGreaterThan(0);
    expect(filtersOf(requests.lastRows())).toEqual({});

    await toggleFilter(page, "Revoked");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({ "filter[status]": ["revoked"] });
    expect(searchParameters(page).get("status")).toBe("revoked");

    await toggleFilter(page, "Never expires");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[status]": ["revoked"],
        "filter[expires]": ["false"],
      });
    expect(searchParameters(page).get("expires")).toBe("false");

    // `?scope=` is one space-separated string in the route, while
    // `filter[scope]` is an exploded array, so one menu item emits exactly one
    // occurrence.
    await toggleFilter(page, "Access to the MAS admin API");
    await expect
      .poll(() => filtersOf(requests.lastRows()))
      .toEqual({
        "filter[status]": ["revoked"],
        "filter[expires]": ["false"],
        "filter[scope]": ["urn:mas:admin"],
      });
    await expect
      .poll(() => filtersOf(requests.lastCount()))
      .toEqual({
        "filter[status]": ["revoked"],
        "filter[expires]": ["false"],
        "filter[scope]": ["urn:mas:admin"],
      });
    expect(searchParameters(page).get("scope")).toBe("urn:mas:admin");
  });
});
