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

import { http, HttpResponse, type RequestHandler } from "msw";

import type { RoomsListResponse } from "@/api/synapse";

import {
  ACCESS_TOKEN,
  ADMIN_MXID,
  ESS_VERSION,
  FIXTURE_EPOCH_MS,
  LATEST_ESS_RELEASE,
  MAS_ROOT,
  REFRESH_TOKEN,
  roomPage,
  type RoomOverrides,
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

/**
 * Is this the count-only form of a Synapse list request? The console spells it
 * `limit=0` exactly; a `limit` of any other size is a real page.
 */
const isCountOnly = (parameters: URLSearchParams): boolean =>
  parameters.get("limit") === "0";

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
