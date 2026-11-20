// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useAuthStore } from "@/stores/auth";

import { fetch } from "./fetch";

/**
 * Authenticated API transport. Keep public discovery, OAuth and release
 * requests on the generic fetch wrapper so they cannot invalidate a session.
 */
export const authenticatedFetch: typeof globalThis.fetch = async (
  request: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const headers = new Headers(
    init?.headers ?? (request instanceof Request ? request.headers : undefined),
  );
  const credentials = useAuthStore.getState().credentials;
  const response = await fetch(request, init);

  if (
    response.status === 401 &&
    credentials &&
    headers.get("Authorization") === `Bearer ${credentials.accessToken}`
  ) {
    await useAuthStore.getState().invalidateRejectedCredentials(credentials);
  }

  return response;
};
