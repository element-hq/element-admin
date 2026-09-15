// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Page } from "@playwright/test";

import { ACCESS_TOKEN, SERVER_NAME } from "./fixtures";

/**
 * Log in without driving the OAuth 2 flow, through the app's
 * `__useStaticCredentials` debug hook.
 *
 * Static credentials never refresh, so page tests need no token endpoint and
 * cannot race a refresh grant. `tests/pages/auth.spec.ts` covers the full
 * mocked OIDC flow.
 *
 * `/login` is loaded first because the hook lives on `globalThis` and so needs
 * the app bundle to have run; the login page makes no requests until a server
 * name is typed.
 */
export const loginAs = async (
  page: Page,
  serverName = SERVER_NAME,
): Promise<void> => {
  await page.goto("/login");

  await page.evaluate(
    ({ serverName, accessToken }) => {
      const hook = (globalThis as unknown as Record<string, unknown>)[
        "__useStaticCredentials"
      ];
      if (typeof hook !== "function") {
        throw new TypeError(
          "__useStaticCredentials is not on globalThis: the app bundle has not run, or the debug hook was dropped from the build",
        );
      }
      (hook as (name: string, token: string) => void)(serverName, accessToken);
    },
    { serverName, accessToken: ACCESS_TOKEN },
  );

  // `__useStaticCredentials` does not await the store write, and zustand's
  // persist middleware flushes to localStorage asynchronously. Wait for the
  // credentials to land, or the next navigation can still bounce off
  // `_console`'s `beforeLoad` back to `/login`.
  await page.waitForFunction(() => {
    const persisted = globalThis.localStorage.getItem("auth");
    if (!persisted) return false;
    const { state } = JSON.parse(persisted) as {
      state?: { credentials?: unknown };
    };
    return !!state?.credentials;
  });
};
