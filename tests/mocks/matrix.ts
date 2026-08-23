// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * Handlers for everything that is not the MAS admin API: Matrix
 * client-server, the Synapse admin API, the ESS endpoints and the public
 * GitHub releases API.
 *
 * Handlers match a `*\/path` pattern rather than an absolute URL, because the
 * app discovers the Synapse root from the well-known document and the MAS
 * issuer from the auth metadata: a handler has to match whatever origin
 * discovery produced.
 */

import {
  http,
  HttpResponse,
  type JsonBodyType,
  type RequestHandler,
} from "msw";

import type { AdminbotResponse } from "@/api/ess";
import type {
  Destination,
  DestinationsListResponse,
  RoomDetail,
  RoomMembers,
  RoomsListResponse,
  ScheduledTask,
} from "@/api/synapse";

import {
  ACCESS_TOKEN,
  ADMIN_MXID,
  type AllowlistEntry,
  DEFAULT_ADMINBOT,
  destinationName,
  destinationPage,
  type DestinationOverrides,
  destinationPageSlice,
  ESS_VERSION,
  FIXTURE_EPOCH_MS,
  LATEST_ESS_RELEASE,
  MAS_ROOT,
  REFRESH_TOKEN,
  roomId,
  roomPage,
  type RoomOverrides,
  roomPageSlice,
  type ServerSupport,
  singleDestination,
  singleRoom,
  SYNAPSE_ROOT,
  SYNAPSE_VERSION,
} from "./fixtures";

/** The `client_id` the mocked dynamic client registration hands out. */
const CLIENT_ID = "01KSQRH31ZXCCDHN71NBX8TSXX";

/** The authorization code the mocked `/authorize` redirect carries. */
const AUTHORIZATION_CODE = "mock-authorization-code";

const SCOPE =
  "urn:matrix:org.matrix.msc2967.client:api:* urn:mas:admin urn:synapse:admin:*";

/**
 * The mocked avatar thumbnail: a solid 96×96 PNG, the size
 * `mediaThumbnailQuery` asks for (`?width=96&height=96&method=crop`). Opaque so
 * that avatars are visibly rendered in screenshots; an invisible fixture would
 * hide real image-loading regressions.
 */
const AVATAR_PNG: ArrayBuffer = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAAjklEQVR42u3QMQ0AAAgDsBlAOZrwhgNOriZV0NQ0hygQJEiQIEGCBAlCkCBBggQJEiQIQYIECRIkSJAgBAkSJEiQIEGCBCFIkCBBggQJEoQgQYIECRIkSBCCBAkSJEiQIEGCECRIkCBBggQJQpAgQYIECRIkCEGCBAkSJEiQIEEIEiRIkCBBggQhSJCgPwu9JPbCXw1n/wAAAABJRU5ErkJggg==",
    "base64",
  ),
).buffer;

/** A Matrix standard error body, the shape Synapse reports failures in. */
export const matrixError = (
  errcode: string,
  error: string,
): { errcode: string; error: string } => ({ errcode, error });

const notFound = () =>
  HttpResponse.json(matrixError("M_NOT_FOUND", "Not found"), { status: 404 });

const badLimit = (limit: string | null) =>
  HttpResponse.json(matrixError("M_INVALID_PARAM", `Invalid limit: ${limit}`), {
    status: 400,
  });

/**
 * Is this the count-only form of a Synapse list request? The console spells it
 * `limit=0` exactly; a `limit` of any other size is a real page.
 */
const isCountOnly = (parameters: URLSearchParams): boolean =>
  parameters.get("limit") === "0";

/**
 * The `limit` a request asked for, `fallback` when it sends none, or null for a
 * `limit` that is not a number; callers answer that with `badLimit`.
 */
const limitOf = (
  parameters: URLSearchParams,
  fallback: number,
): number | null => {
  const limit = parameters.get("limit");
  if (limit === null) return fallback;
  return Number.isFinite(Number(limit)) ? Number(limit) : null;
};

/**
 * A Synapse list endpoint paginated by offset: `from` is a numeric offset the
 * app echoes back from the previous page's continuation token, and the
 * count-only form reports the whole total with no continuation token — one
 * there would start a pagination nothing asked for.
 *
 * `count` and `slice` build the two response shapes; callers name the generated
 * response type so both are checked against it. `onPage` receives each observed
 * `from`, null on the first request; the count-only form is not reported.
 */
const offsetPaginated = <R extends JsonBodyType>({
  path,
  total,
  count,
  slice,
  onPage,
}: {
  path: string;
  total: number;
  count: () => R;
  slice: (from: number, limit: number) => R;
  onPage?: (from: string | null) => void;
}): RequestHandler =>
  http.get(`*${path}`, ({ request }) => {
    const parameters = new URL(request.url).searchParams;
    if (isCountOnly(parameters)) return HttpResponse.json(count());

    const limit = limitOf(parameters, total);
    if (limit === null) return badLimit(parameters.get("limit"));

    const from = parameters.get("from");
    onPage?.(from);

    return HttpResponse.json(slice(Number(from ?? 0), limit));
  });

export const wellKnown = (): RequestHandler =>
  http.get("*/.well-known/matrix/client", () =>
    HttpResponse.json({
      "m.homeserver": { base_url: SYNAPSE_ROOT },
      "org.matrix.msc2965.authentication": {
        issuer: `${MAS_ROOT}/`,
        account: `${MAS_ROOT}/account/`,
      },
    }),
  );

/**
 * MSC2965 auth metadata. `graphql_endpoint` is present because real MAS sends
 * it, and `masBaseOptions` prefers it (stripped of `/graphql`) over `issuer`
 * when deriving the admin API base URL.
 */
export const authMetadata = (): RequestHandler =>
  http.get("*/_matrix/client/unstable/org.matrix.msc2965/auth_metadata", () =>
    HttpResponse.json({
      issuer: `${MAS_ROOT}/`,
      account_management_uri: `${MAS_ROOT}/account/`,
      authorization_endpoint: `${MAS_ROOT}/authorize`,
      token_endpoint: `${MAS_ROOT}/oauth2/token`,
      registration_endpoint: `${MAS_ROOT}/oauth2/registration`,
      revocation_endpoint: `${MAS_ROOT}/oauth2/revoke`,
      "org.matrix.matrix-authentication-service.graphql_endpoint": `${MAS_ROOT}/graphql`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    }),
  );

/**
 * RFC 7591 dynamic client registration. Real MAS is idempotent here and
 * echoes the submitted metadata back with a 201.
 */
export const clientRegistration = (): RequestHandler =>
  http.post("*/oauth2/registration", async ({ request }) => {
    const metadata = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        ...metadata,
        client_id: CLIENT_ID,
        // RFC 7591 counts this one in seconds, not milliseconds.
        client_id_issued_at: FIXTURE_EPOCH_MS / 1000,
      },
      { status: 201 },
    );
  });

/**
 * The authorization endpoint, fulfilled as the 302 back to `/callback` that
 * real MAS issues after its own login and consent pages. `state` and
 * `redirect_uri` are echoed from the request so the callback route's state
 * check passes.
 */
export const authorize = (): RequestHandler =>
  http.get("*/authorize", ({ request }) => {
    const parameters = new URL(request.url).searchParams;
    const redirectUri = parameters.get("redirect_uri");
    const state = parameters.get("state");

    if (!redirectUri || !state) {
      return HttpResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const location = new URL(redirectUri);
    location.searchParams.set("code", AUTHORIZATION_CODE);
    location.searchParams.set("state", state);

    return new HttpResponse(null, {
      status: 302,
      headers: { Location: location.toString() },
    });
  });

/**
 * The token endpoint. Bodies are form-encoded, and both grants have to work:
 * the mocked access token lives 300 seconds, so a `refresh_token` grant fires
 * on essentially every page load once dynamic credentials are in play.
 */
export const token = (): RequestHandler =>
  http.post("*/oauth2/token", async ({ request }) => {
    const body = new URLSearchParams(await request.text());
    const grantType = body.get("grant_type");

    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
      return HttpResponse.json(
        { error: "unsupported_grant_type" },
        { status: 400 },
      );
    }

    return HttpResponse.json({
      access_token: ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      token_type: "Bearer",
      expires_in: 300,
      scope: SCOPE,
    });
  });

export const revoke = (): RequestHandler =>
  http.post("*/oauth2/revoke", () => new HttpResponse(null, { status: 200 }));

export const whoami = (): RequestHandler =>
  http.get("*/_matrix/client/v3/account/whoami", () =>
    HttpResponse.json({ user_id: ADMIN_MXID, is_guest: false }),
  );

export interface Profile {
  displayname?: string;
  avatar_url?: string;
}

/**
 * Per-Matrix-ID profiles. A 404 is a normal response here: deactivated users
 * have no profile and the app renders those rows with just the Matrix ID, so
 * any MXID absent from `profiles` gets one.
 *
 * The MXID is read out of the path rather than a `:param` because it arrives
 * percent-encoded (`%40admin%3Aexample.com`).
 */
export const profiles = (profiles: Record<string, Profile>): RequestHandler =>
  http.get("*/_matrix/client/v3/profile/*", ({ request }) => {
    const { pathname } = new URL(request.url);
    const mxid = decodeURIComponent(
      pathname.slice(pathname.lastIndexOf("/") + 1),
    );
    const profile = profiles[mxid];
    return profile ? HttpResponse.json(profile) : notFound();
  });

export const mediaThumbnail = (): RequestHandler =>
  http.get("*/_matrix/client/v1/media/thumbnail/*", () =>
    HttpResponse.arrayBuffer(AVATAR_PNG, {
      headers: { "Content-Type": "image/png" },
    }),
  );

export const serverVersion = (): RequestHandler =>
  http.get("*/_synapse/admin/v1/server_version", () =>
    HttpResponse.json({ server_version: SYNAPSE_VERSION }),
  );

/**
 * The rooms list. The count-only form the dashboard uses gets the full
 * envelope, with no rooms in it.
 *
 * The filters (`search_term`, `public_rooms`, `empty_rooms`) are ignored; use
 * `roomsFiltered` for a test about filtering. Rendering a row fires one
 * `roomDetailQuery`, so the same fixture array has to go to `roomDetail()`.
 */
export const rooms = (rooms: RoomOverrides[]): RequestHandler =>
  http.get("*/_synapse/admin/v1/rooms", ({ request }) => {
    const page = roomPage(rooms);
    return HttpResponse.json({
      ...page,
      rooms: isCountOnly(new URL(request.url).searchParams) ? [] : page.rooms,
    } satisfies RoomsListResponse);
  });

/**
 * The rooms list, paginated: the multi-page counterpart of `rooms`. Prepend it
 * with `network.use()` for a test about pagination; every deployment keeps the
 * single-page handler.
 *
 * The continuation token is `next_batch`, which the app echoes back as `from`;
 * `roomsInfiniteQuery`'s `getNextPageParam` is `lastPage.next_batch ?? null`.
 *
 * A large fixture array has to be handed to `roomDetail()` too, or the rows
 * fire that many unhandled per-row requests. See `usersPaginated` in `mas.ts`
 * for why `onPage` is a closure rather than `network.events`.
 */
export const roomsPaginated = (
  rooms: RoomOverrides[],
  onPage?: (from: string | null) => void,
): RequestHandler =>
  offsetPaginated<RoomsListResponse>({
    path: "/_synapse/admin/v1/rooms",
    total: rooms.length,
    count: () => ({ rooms: [], offset: 0, total_rooms: rooms.length }),
    slice: (from, limit) => roomPageSlice(rooms, from, limit),
    onPage,
  });

/**
 * A single room. Room IDs reach MSW percent-encoded
 * (`%21room0%3Aexample.com`), but MSW decodes path params, so `roomId` is the
 * real `!…:…` form. An unknown room 404s with `M_NOT_FOUND`, which
 * `ensureNotError(response, true)` turns into the route's not-found UI.
 *
 * The rooms list needs this handler too: `RoomAvatar` fires one
 * `roomDetailQuery` per rendered row to find the room's avatar.
 */
export const roomDetail = (rooms: RoomOverrides[]): RequestHandler =>
  http.get("*/_synapse/admin/v1/rooms/:roomId", ({ params }) => {
    const index = rooms.findIndex(
      (_room, position) => roomId(rooms, position) === params["roomId"],
    );

    return index === -1
      ? notFound()
      : HttpResponse.json(singleRoom(index, rooms[index]) satisfies RoomDetail);
  });

/**
 * Room members, keyed by room ID. Only a room with neither a `name` nor a
 * `canonical_alias` reaches this endpoint — that is when the console derives
 * the display name and avatar heroes from the first few members — so most
 * fixture rooms need no entry.
 *
 * A `:roomId` parameter matches a single path segment, so the `/rooms/:roomId`
 * handler above cannot swallow this one, whatever the registration order.
 */
export const roomMembers = (
  members: Record<string, string[]>,
): RequestHandler =>
  http.get("*/_synapse/admin/v1/rooms/:roomId/members", ({ params }) => {
    const roomMembers = members[String(params["roomId"])];
    return roomMembers
      ? HttpResponse.json({
          members: roomMembers,
          total: roomMembers.length,
        } satisfies RoomMembers)
      : notFound();
  });

/**
 * The scheduled tasks for one resource, which the room detail page reads to
 * decide between a delete button and a deletion-status alert.
 *
 * The list is empty because `scheduledTasksForResource` refetches every second
 * for as long as any task is `scheduled` or `active`: a live task would poll
 * for the whole test. The handler ignores `resource_id`, so tasks for one
 * resource cannot be expressed here at all.
 */
export const scheduledTasks = (): RequestHandler =>
  http.get("*/_synapse/admin/v1/scheduled_tasks", () =>
    HttpResponse.json({ scheduled_tasks: [] } satisfies {
      scheduled_tasks: ScheduledTask[];
    }),
  );

/**
 * The federation destinations list. The count-only form
 * (`federationDestinationsCountQuery`) gets the full envelope, with no
 * destinations in it.
 *
 * The undocumented `destination` substring filter is ignored, as are
 * `order_by`/`dir`.
 */
export const federationDestinations = (
  destinations: DestinationOverrides[],
): RequestHandler =>
  http.get("*/_synapse/admin/v1/federation/destinations", ({ request }) => {
    const page = destinationPage(destinations);
    return HttpResponse.json({
      ...page,
      destinations: isCountOnly(new URL(request.url).searchParams)
        ? []
        : page.destinations,
    } satisfies DestinationsListResponse);
  });

/**
 * The federation destinations list, paginated: the multi-page counterpart of
 * `federationDestinations`. Same offset pagination as `roomsPaginated`, except
 * the continuation token comes back in `next_token`, and a destination row
 * fires no per-row query.
 *
 * The schema types `next_token` as `string | number`; real Synapse sends the
 * string form, which is what `destinationPageSlice` produces.
 */
export const federationDestinationsPaginated = (
  destinations: DestinationOverrides[],
  onPage?: (from: string | null) => void,
): RequestHandler =>
  offsetPaginated<DestinationsListResponse>({
    path: "/_synapse/admin/v1/federation/destinations",
    total: destinations.length,
    count: () => ({ destinations: [], total: destinations.length }),
    slice: (from, limit) => destinationPageSlice(destinations, from, limit),
    onPage,
  });

/**
 * A single destination. An unknown one 404s with `M_NOT_FOUND`, which
 * `ensureNotError(response, true)` turns into the route's not-found UI.
 *
 * Unlike rooms, the destinations list does not need this handler: a destination
 * row's avatar is generated from the name.
 */
export const federationDestination = (
  destinations: DestinationOverrides[],
): RequestHandler =>
  http.get(
    "*/_synapse/admin/v1/federation/destinations/:destination",
    ({ params }) => {
      const index = destinations.findIndex(
        (_destination, position) =>
          destinationName(destinations, position) === params["destination"],
      );

      return index === -1
        ? notFound()
        : HttpResponse.json(
            singleDestination(index, destinations[index]) satisfies Destination,
          );
    },
  );

/**
 * `/.well-known/matrix/support` on a third-party server, the one origin the
 * console reaches without discovering it first, from the destination detail
 * page. Keyed by hostname, since the request goes to
 * `https://{destination}/...`.
 *
 * A 404 is a normal response here: `serverSupportQuery` swallows every failure
 * and returns null, and the detail page then renders no contact info. The
 * request still has to be handled, or `onUnhandledRequest: "error"` fails the
 * test.
 */
export const serverSupport = (
  support: Record<string, ServerSupport>,
): RequestHandler =>
  http.get("*/.well-known/matrix/support", ({ request }) => {
    const document = support[new URL(request.url).hostname];
    return document ? HttpResponse.json(document) : notFound();
  });

/**
 * ESS edition detection. The app treats any failure here as "not an ESS
 * deployment", which is how the `plainMas` deployment is built.
 */
export const essVersion = (
  version: string | null = ESS_VERSION,
  edition: "community" | "pro" | null = "pro",
): RequestHandler =>
  http.get("*/_synapse/ess/version", () =>
    HttpResponse.json({ version, edition }),
  );

export const essVersionMissing = (): RequestHandler =>
  http.get("*/_synapse/ess/version", () => notFound());

/** The ESS supervision ("adminbot") module. */
const ADMINBOT_PATH = "*/_synapse/ess/adminbot";

/**
 * The supervision configuration. `/supervision`'s loader always prefetches
 * this, outside the edition check, so every deployment needs a handler for it
 * whatever `/_synapse/ess/version` says.
 */
export const adminbot = (
  config: AdminbotResponse = DEFAULT_ADMINBOT,
): RequestHandler => http.get(ADMINBOT_PATH, () => HttpResponse.json(config));

/**
 * The same endpoint on a deployment where supervision is not enabled, which is
 * a 404. `adminbotQuery` special-cases that status and resolves to `null`
 * rather than throwing, so on ESS Pro the page renders its "Supervision is
 * currently disabled" alert.
 */
export const adminbotDisabled = (): RequestHandler =>
  http.get(ADMINBOT_PATH, () => notFound());

/** The SBG federation allowlist module, which is ESS-Pro-only. */
const ALLOWLIST_PATH = "*/_synapse/io.element/admin/v1/federation/whitelist";

/**
 * The federation allowlist. One handler serves both request forms:
 * `federationAllowlistAvailableQuery` probes it with `?page=0&limit=1` and only
 * cares whether the response is OK, and `federationAllowlistQuery` asks for a
 * real page with `?page=0&limit=100`. `limit` is honoured so the probe gets the
 * one-entry response it asked for; `page` is not, because nothing requests a
 * second page.
 *
 * An entry's `created_at` is a number, not the ISO string every MAS timestamp
 * uses.
 */
export const federationAllowlist = (
  entries: AllowlistEntry[],
): RequestHandler =>
  http.get(ALLOWLIST_PATH, ({ request }) => {
    const parameters = new URL(request.url).searchParams;
    const limit = limitOf(parameters, entries.length);
    if (limit === null) return badLimit(parameters.get("limit"));

    return HttpResponse.json({
      server_names: entries.slice(0, limit),
      total_count: entries.length,
    } satisfies { server_names: AllowlistEntry[]; total_count: number });
  });

/**
 * The same endpoint with the module not installed. `M_UNRECOGNIZED` is how
 * Synapse answers a path no module registered; the availability probe swallows
 * the error and resolves to `false`, so `/federation/allowed-domains` renders
 * its "Secure Border Gateway is not enabled" alert and marketing cards instead
 * of the allowlist.
 */
export const federationAllowlistMissing = (): RequestHandler =>
  http.get(ALLOWLIST_PATH, () =>
    HttpResponse.json(matrixError("M_UNRECOGNIZED", "Unrecognized request"), {
      status: 404,
    }),
  );

export const githubLatestRelease = (): RequestHandler =>
  http.get(
    "https://api.github.com/repos/element-hq/ess-helm/releases/latest",
    () =>
      // The app's release schema requires all five fields.
      HttpResponse.json({
        html_url: `https://github.com/element-hq/ess-helm/releases/tag/${LATEST_ESS_RELEASE}`,
        name: LATEST_ESS_RELEASE,
        tag_name: LATEST_ESS_RELEASE,
        created_at: "2026-08-01T10:00:00Z",
        body: "Mocked release notes.",
      }),
  );
