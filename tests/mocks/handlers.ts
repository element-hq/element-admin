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
  DEFAULT_ROOMS,
  DEFAULT_USERS,
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
  matrix.githubLatestRelease(),

  mas.siteConfig(),
  mas.usersList(DEFAULT_USERS),
  mas.userEmails(),
  mas.upstreamOauthLinks(),
  mas.upstreamOauthProviders(),
  mas.userDetail(DEFAULT_USERS),
];

/**
 * The default deployment: ESS Pro on a recent MAS, so every route in the
 * console is reachable.
 */
const essPro = (): RequestHandler[] => [
  ...common(),
  mas.version(),
  matrix.essVersion(),
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
