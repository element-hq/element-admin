// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * Handlers for the MAS admin API (`/api/admin/v1/...`).
 *
 * Response bodies are typed against `@/api/mas/api`. The generated SDK also
 * validates every response with valibot at runtime, so a fixture that drifts
 * from the spec fails in the browser even when it type-checks here.
 */

import { http, HttpResponse, type RequestHandler } from "msw";

import type {
  PaginatedResponseForUser,
  SiteConfig,
  Ulid,
  Version,
} from "@/api/mas/api";

import {
  countOnly,
  listLinks,
  MAS_VERSION,
  masError,
  SERVER_NAME,
  singleUser,
  userId,
  userPage,
  type UserOverrides,
} from "./fixtures";

/** The part of every `PaginatedResponseFor*` the generic handlers rely on. */
interface MasListResponse {
  meta?: { count?: number | null } | null;
  data?: readonly unknown[] | null;
  links: { self: string };
}

/** The part of every `SingleResponseFor*` the generic handlers rely on. */
interface MasSingleResponse {
  data: unknown;
  links: { self: string };
}

/**
 * A MAS collection endpoint. One handler serves both request forms a list page
 * makes: `count=only` for the header count, anything else for the rows.
 *
 * Callers name the response type explicitly so both bodies are checked against
 * the same generated `PaginatedResponseFor*`.
 */
const listHandler = <R extends MasListResponse>(
  path: string,
  count: (self: string) => R,
  page: () => R,
): RequestHandler =>
  http.get(`*${path}`, ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get("count") === "only"
        ? count(`${path}?count=only`)
        : page(),
    ),
  );

/**
 * A MAS detail endpoint. An id that is a well-formed ULID but unknown to the
 * fixtures gets a 404 titled `notFound`, which `ensureNoError(result, true)`
 * turns into the route's not-found UI.
 */
const detailHandler = <O>(
  path: string,
  items: O[],
  id: (items: O[], index: number) => Ulid,
  single: (index: number, overrides?: O) => MasSingleResponse,
  notFound: string,
): RequestHandler =>
  http.get(`*${path}/:id`, ({ params }) => {
    const index = items.findIndex(
      (_item, position) => id(items, position) === params["id"],
    );

    return index === -1
      ? HttpResponse.json(masError(notFound), { status: 404 })
      : HttpResponse.json(single(index, items[index]));
  });

/**
 * A collection with nothing in it. The pages that read these render their
 * "nothing here" state, which is still a resolved suspense boundary.
 */
const emptyCollection = (path: string): RequestHandler =>
  listHandler<MasListResponse>(
    path,
    (self) => countOnly(0, self),
    () => ({ data: [], links: listLinks(path) }),
  );

export const version = (version = MAS_VERSION): RequestHandler =>
  http.get("*/api/admin/v1/version", () =>
    HttpResponse.json({ version } satisfies Version),
  );

/**
 * `/api/admin/v1/site-config` is not a JSON:API envelope, it is a flat object.
 * It gates which action buttons the user detail drawer renders.
 */
export const siteConfig = (
  overrides: Partial<SiteConfig> = {},
): RequestHandler =>
  http.get("*/api/admin/v1/site-config", () =>
    HttpResponse.json({
      server_name: SERVER_NAME,
      password_login_enabled: true,
      password_registration_enabled: true,
      password_registration_email_required: true,
      password_registration_token_required: false,
      registration_token_required: false,
      email_change_allowed: true,
      displayname_change_allowed: true,
      password_change_allowed: true,
      account_recovery_allowed: false,
      account_deactivation_allowed: true,
      captcha_enabled: false,
      minimum_password_complexity: 0,
      ...overrides,
    } satisfies SiteConfig),
  );

/**
 * The users collection. Filters (`filter[status]`, `filter[search]`, …) are
 * ignored here — these fixtures exist for render coverage, not filter behaviour
 * — so a filtered page shows the same rows as an unfiltered one. Use
 * `usersFiltered` for a test about the filters themselves.
 */
export const usersList = (users: UserOverrides[]): RequestHandler =>
  listHandler<PaginatedResponseForUser>(
    "/api/admin/v1/users",
    (self) => countOnly(users.length, self),
    () => userPage(users),
  );

export const userDetail = (users: UserOverrides[]): RequestHandler =>
  detailHandler(
    "/api/admin/v1/users",
    users,
    userId,
    singleUser,
    "mock 404: unknown user",
  );

// The user detail page's side queries, all three empty.
export const userEmails = (): RequestHandler =>
  emptyCollection("/api/admin/v1/user-emails");

export const upstreamOauthLinks = (): RequestHandler =>
  emptyCollection("/api/admin/v1/upstream-oauth-links");

export const upstreamOauthProviders = (): RequestHandler =>
  emptyCollection("/api/admin/v1/upstream-oauth-providers");
