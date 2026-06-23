// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import { queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

// Matrix spec v1.10 — GET /.well-known/matrix/support
const Contact = v.object({
  email_address: v.optional(v.string()),
  matrix_id: v.optional(v.string()),
  role: v.string(),
});

const WellKnownSupport = v.object({
  contacts: v.optional(v.array(Contact)),
  support_page: v.optional(v.pipe(v.string(), v.url())),
});

/**
 * Fetch /.well-known/matrix/support from a remote server (Matrix spec v1.10).
 * Gracefully returns null on any error (CORS, 404, invalid response, etc.)
 */
export const serverSupportQuery = (destination: string) =>
  queryOptions({
    queryKey: ["well-known", "support", destination],
    queryFn: async ({ signal }) => {
      try {
        const url = new URL(
          `https://${destination}/.well-known/matrix/support`,
        );
        const response = await globalThis.fetch(url, { signal });

        if (!response.ok) return null;

        const data = v.parse(WellKnownSupport, await response.json());
        return data;
      } catch {
        return null;
      }
    },
    // These are remote servers; cache longer and don't refetch aggressively
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: false,
  });
