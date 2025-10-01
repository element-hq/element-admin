// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { notFound } from "@tanstack/react-router";
import * as v from "valibot";

import { vUlid } from "@/api/mas/api/valibot.gen";

const RecordOfUlids = v.record(v.string(), vUlid);

/**
 * Ensure that the given parameters are ULIDs.
 * Throws a 'not found' error if not.
 * Intended to use in routes loader, not beforeLoad else parent routes never
 * resolve!
 */
export function ensureParametersAreUlids(parameters: Record<string, string>) {
  const result = v.safeParse(RecordOfUlids, parameters);
  if (!result.success) {
    console.warn(
      "One or more path parameters are not ULIDs, throwing a 'notFound' error",
      parameters,
      ...result.issues,
    );
    throw notFound();
  }
}
