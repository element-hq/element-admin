// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * The fixture deployments. A deployment is the set of handlers standing in for
 * one kind of server; a spec picks one with `test.use({ deployment: ... })`.
 *
 * Deployments exist because two responses gate what the console shows at all:
 * MAS's `/api/admin/v1/version` gates the devices (>= 1.20) and personal-tokens
 * (>= 1.5) routes, and Synapse's `/_synapse/ess/version` gates the ESS-only
 * surfaces.
 */

import type { RequestHandler } from "msw";

import * as mas from "./mas";
import * as matrix from "./matrix";

import {
  ADMIN_MXID,
  DEFAULT_ALLOWLIST,
  DEFAULT_COMPAT_SESSIONS,
  DEFAULT_DESTINATIONS,
  DEFAULT_OAUTH2_CLIENTS,
  DEFAULT_OAUTH2_SESSIONS,
  DEFAULT_PERSONAL_SESSIONS,
  DEFAULT_REGISTRATION_TOKENS,
  DEFAULT_ROOMS,
  DEFAULT_SERVER_SUPPORT,
  DEFAULT_USERS,
  roomId,
  SERVER_NAME,
} from "./fixtures";

/** Profiles for the default users. `bob` is deactivated, so he has none. */
const DEFAULT_PROFILES = {
  [ADMIN_MXID]: {
    displayname: "Admin",
    avatar_url: "mxc://example.com/admin-avatar",
  },
  [`@alice:${SERVER_NAME}`]: { displayname: "Alice" },
};

/**
 * Members for the default rooms. Only the third room has neither a name nor a
 * canonical alias, which is the only case that makes the app ask for members.
 */
const DEFAULT_ROOM_MEMBERS = {
  [roomId(DEFAULT_ROOMS, 2)]: [ADMIN_MXID, `@alice:${SERVER_NAME}`],
};

/** Handlers every page needs, whatever the deployment. */
const common = (): RequestHandler[] => [
  matrix.wellKnown(),
  matrix.authMetadata(),
  matrix.clientRegistration(),
  matrix.authorize(),
  matrix.token(),
  matrix.revoke(),
  matrix.whoami(),
  matrix.profiles(DEFAULT_PROFILES),
  matrix.mediaThumbnail(),
  matrix.serverVersion(),
  matrix.rooms(DEFAULT_ROOMS),
  matrix.roomDetail(DEFAULT_ROOMS),
  matrix.roomMembers(DEFAULT_ROOM_MEMBERS),
  matrix.scheduledTasks(),
  matrix.federationDestinations(DEFAULT_DESTINATIONS),
  matrix.federationDestination(DEFAULT_DESTINATIONS),
  matrix.serverSupport(DEFAULT_SERVER_SUPPORT),
  matrix.githubLatestRelease(),

  mas.siteConfig(),
  mas.usersList(DEFAULT_USERS),
  mas.userEmails(),
  mas.upstreamOauthLinks(),
  mas.upstreamOauthProviders(),
  mas.oauth2ClientsList(DEFAULT_OAUTH2_CLIENTS),
  mas.oauth2SessionsList(DEFAULT_OAUTH2_SESSIONS),
  mas.compatSessionsList(DEFAULT_COMPAT_SESSIONS),
  mas.registrationTokensList(DEFAULT_REGISTRATION_TOKENS),
  mas.personalSessionsList(DEFAULT_PERSONAL_SESSIONS),
  mas.userDetail(DEFAULT_USERS),
  mas.oauth2ClientDetail(DEFAULT_OAUTH2_CLIENTS),
  mas.oauth2SessionDetail(DEFAULT_OAUTH2_SESSIONS),
  mas.compatSessionDetail(DEFAULT_COMPAT_SESSIONS),
  mas.registrationTokenDetail(DEFAULT_REGISTRATION_TOKENS),
  mas.personalSessionDetail(DEFAULT_PERSONAL_SESSIONS),
];

/**
 * The default deployment: ESS Pro on a recent MAS, so every route in the
 * console is reachable.
 */
const essPro = (): RequestHandler[] => [
  ...common(),
  mas.version(),
  matrix.essVersion(),
  // The SBG allowlist module and supervision are both ESS-Pro-only, so they
  // belong to this deployment rather than to `common()`.
  matrix.federationAllowlist(DEFAULT_ALLOWLIST),
  matrix.adminbot(),
];

/**
 * Every deployment, by name. Playwright collapses an array-valued option passed
 * through `test.use` (any array whose second element is an object is read as a
 * `[value, options]` tuple), so the `deployment` option selects a deployment by
 * name — `test.use({ deployment: "plainMas" })` — rather than by handler array.
 */
export const deployments = {
  essPro,
} satisfies Record<string, () => RequestHandler[]>;

export type DeploymentName = keyof typeof deployments;
