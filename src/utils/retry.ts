// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { FetchError, HttpStatusError } from "@/errors";

// ess-helm's haproxy answers 429 instead of 503 while a backend is down.
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);

/** Whether retrying may fix a failed request, e.g. once the server restarted. */
const isTransientError = (error: unknown): boolean =>
  error instanceof FetchError ||
  (error instanceof HttpStatusError && TRANSIENT_STATUSES.has(error.status));

/**
 * TanStack Query options that retry transient failures for as long as the query
 * is observed, backing off exponentially up to 10 seconds between attempts.
 */
export const retryWhileTransient = {
  retry: (_failureCount: number, error: unknown) => isTransientError(error),
  retryDelay: (failureCount: number) =>
    Math.min(1000 * 2 ** failureCount, 10_000),
};
