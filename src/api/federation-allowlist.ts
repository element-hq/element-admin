// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

import { accessToken } from "@/stores/auth";
import { ensureResponseOk, fetch } from "@/utils/fetch";

const ALLOWLIST_BASE_PATH =
  "/_synapse/io.element/admin/v1/federation/whitelist";

const AllowlistEntry = v.object({
  server_name: v.string(),
  creator_user_id: v.string(),
  created_at: v.number(),
});

const AllowlistResponse = v.object({
  server_names: v.array(AllowlistEntry),
  total_count: v.number(),
});

const baseOptions = async (
  client: QueryClient,
  signal?: AbortSignal,
): Promise<{ signal?: AbortSignal; headers: HeadersInit }> => ({
  headers: {
    Authorization: `Bearer ${await accessToken(client, signal)}`,
  },
  signal,
});

/**
 * Probe whether the SBG federation allowlist module is available.
 * Returns true if the endpoint responds, false on 404 or other errors.
 */
export const federationAllowlistAvailableQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["federation", "allowlist", "available", synapseRoot],
    queryFn: async ({ client, signal }) => {
      const url = new URL(ALLOWLIST_BASE_PATH, synapseRoot);
      url.searchParams.set("page", "0");
      url.searchParams.set("limit", "1");

      try {
        const response = await fetch(url, await baseOptions(client, signal));
        ensureResponseOk(response);
        return true;
      } catch {
        return false;
      }
    },
  });

/**
 * Get a paginated list of allowed federation destinations.
 */
export const federationAllowlistQuery = (
  synapseRoot: string,
  page: number,
  limit: number,
) =>
  queryOptions({
    queryKey: ["federation", "allowlist", "list", synapseRoot, page, limit],
    queryFn: async ({ client, signal }) => {
      const url = new URL(ALLOWLIST_BASE_PATH, synapseRoot);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));

      const response = await fetch(url, await baseOptions(client, signal));
      ensureResponseOk(response);

      return v.parse(AllowlistResponse, await response.json());
    },
  });

/**
 * Add one or more server names/patterns to the federation allowlist.
 */
export const addToAllowlist = async (
  client: QueryClient,
  synapseRoot: string,
  serverNames: string[],
  signal?: AbortSignal,
): Promise<void> => {
  const url = new URL(ALLOWLIST_BASE_PATH, synapseRoot);

  const requestOptions = await baseOptions(client, signal);
  const response = await fetch(url, {
    ...requestOptions,
    method: "PUT",
    body: JSON.stringify({ server_names: serverNames }),
    headers: {
      ...requestOptions.headers,
      "Content-Type": "application/json",
    },
  });

  ensureResponseOk(response);
};

/**
 * Remove one or more server names/patterns from the federation allowlist.
 */
export const removeFromAllowlist = async (
  client: QueryClient,
  synapseRoot: string,
  serverNames: string[],
  signal?: AbortSignal,
): Promise<void> => {
  const url = new URL(ALLOWLIST_BASE_PATH, synapseRoot);

  const requestOptions = await baseOptions(client, signal);
  const response = await fetch(url, {
    ...requestOptions,
    method: "DELETE",
    body: JSON.stringify({ server_names: serverNames }),
    headers: {
      ...requestOptions.headers,
      "Content-Type": "application/json",
    },
  });

  ensureResponseOk(response);
};
