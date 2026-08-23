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
  PaginatedResponseForCompatSession,
  PaginatedResponseForOAuth2Client,
  PaginatedResponseForOAuth2Session,
  PaginatedResponseForPersonalSession,
  PaginatedResponseForUser,
  PaginatedResponseForUserRegistrationToken,
  SiteConfig,
  Ulid,
  Version,
} from "@/api/mas/api";

import {
  clientId,
  compatSessionId,
  compatSessionPage,
  type CompatSessionOverrides,
  countOnly,
  listLinks,
  MAS_VERSION,
  masError,
  oauth2ClientPage,
  type OAuth2ClientOverrides,
  oauth2SessionId,
  oauth2SessionPage,
  type OAuth2SessionOverrides,
  personalSessionId,
  personalSessionPage,
  type PersonalSessionOverrides,
  registrationTokenId,
  registrationTokenPage,
  type RegistrationTokenOverrides,
  SERVER_NAME,
  singleCompatSession,
  singleOauth2Client,
  singleOauth2Session,
  singlePersonalSession,
  singleRegistrationToken,
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

/**
 * The applications collection, behind `/devices/applications`. Filters are
 * ignored as in `usersList` — the list page always asks for
 * `filter[client-kind]=dynamic` and the tab bar adds
 * `filter[has-active-sessions]`, but every fixture client is dynamic anyway.
 */
export const oauth2ClientsList = (
  clients: OAuth2ClientOverrides[],
): RequestHandler =>
  listHandler<PaginatedResponseForOAuth2Client>(
    "/api/admin/v1/oauth2-clients",
    (self) => countOnly(clients.length, self),
    () => oauth2ClientPage(clients),
  );

/**
 * A single application by ULID. Reached from `/devices/applications/$clientId`,
 * but also once per row of both device lists (`ClientCell`) and from every
 * device detail pane (`ClientCard`), all of which resolve a session's
 * `client_id` through here.
 */
export const oauth2ClientDetail = (
  clients: OAuth2ClientOverrides[],
): RequestHandler =>
  detailHandler(
    "/api/admin/v1/oauth2-clients",
    clients,
    clientId,
    singleOauth2Client,
    "Client not found",
  );

/**
 * The devices collection, behind `/devices/user`. The user detail page also
 * reads its `count=only` form for the per-user device badge.
 *
 * Filters are ignored: `/devices/user` defaults to `filter[status]=active` and
 * the application detail page asks for three differently-filtered counts, and
 * all of them see every fixture session.
 */
export const oauth2SessionsList = (
  sessions: OAuth2SessionOverrides[],
): RequestHandler =>
  listHandler<PaginatedResponseForOAuth2Session>(
    "/api/admin/v1/oauth2-sessions",
    (self) => countOnly(sessions.length, self),
    () => oauth2SessionPage(sessions),
  );

export const oauth2SessionDetail = (
  sessions: OAuth2SessionOverrides[],
): RequestHandler =>
  detailHandler(
    "/api/admin/v1/oauth2-sessions",
    sessions,
    oauth2SessionId,
    singleOauth2Session,
    "Session not found",
  );

/**
 * The legacy-devices collection, behind `/devices/legacy`, plus the `count=only`
 * form the user detail page reads for its legacy-device badge. Filters are
 * ignored, as above.
 */
export const compatSessionsList = (
  sessions: CompatSessionOverrides[],
): RequestHandler =>
  listHandler<PaginatedResponseForCompatSession>(
    "/api/admin/v1/compat-sessions",
    (self) => countOnly(sessions.length, self),
    () => compatSessionPage(sessions),
  );

export const compatSessionDetail = (
  sessions: CompatSessionOverrides[],
): RequestHandler =>
  detailHandler(
    "/api/admin/v1/compat-sessions",
    sessions,
    compatSessionId,
    singleCompatSession,
    "Session not found",
  );

/**
 * The registration-tokens collection, behind `/registration-tokens`. Filters
 * (`filter[valid]`, `filter[used]`, `filter[revoked]`, `filter[expired]`) are
 * ignored as everywhere else; the page starts unfiltered anyway.
 */
export const registrationTokensList = (
  tokens: RegistrationTokenOverrides[],
): RequestHandler =>
  listHandler<PaginatedResponseForUserRegistrationToken>(
    "/api/admin/v1/user-registration-tokens",
    (self) => countOnly(tokens.length, self),
    () => registrationTokenPage(tokens),
  );

export const registrationTokenDetail = (
  tokens: RegistrationTokenOverrides[],
): RequestHandler =>
  detailHandler(
    "/api/admin/v1/user-registration-tokens",
    tokens,
    registrationTokenId,
    singleRegistrationToken,
    "mock 404: unknown registration token",
  );

/**
 * The personal-tokens collection, behind `/personal-tokens`. Filters
 * (`filter[status]`, `filter[scope]`, `filter[expires]`, …) are ignored, so a
 * filtered page shows every fixture.
 */
export const personalSessionsList = (
  sessions: PersonalSessionOverrides[],
): RequestHandler =>
  listHandler<PaginatedResponseForPersonalSession>(
    "/api/admin/v1/personal-sessions",
    (self) => countOnly(sessions.length, self),
    () => personalSessionPage(sessions),
  );

export const personalSessionDetail = (
  sessions: PersonalSessionOverrides[],
): RequestHandler =>
  detailHandler(
    "/api/admin/v1/personal-sessions",
    sessions,
    personalSessionId,
    singlePersonalSession,
    "Personal session not found",
  );

/**
 * Record the query parameters of every `GET *{path}` and then fall through to
 * whatever handler comes next.
 *
 * MSW's `executeHandlers` keeps walking the handler list until one returns a
 * response, so a resolver that returns nothing observes a request without
 * answering it. Prepended with `network.use()`, this turns any deployment's
 * handler into a recorded one without duplicating its response logic — useful
 * when the assertion is only about the emitted parameters, as on the device and
 * token lists.
 *
 * If nothing else answers the path, MSW treats the request as passed through
 * rather than unhandled, so `onUnhandledRequest: "error"` does not fire and the
 * request escapes to the real network. Only point this at a path the current
 * deployment already serves.
 */
export const observeQuery = (
  path: string,
  onRequest: (parameters: URLSearchParams) => void,
): RequestHandler =>
  http.get(`*${path}`, ({ request }) => {
    onRequest(new URL(request.url).searchParams);
  });
