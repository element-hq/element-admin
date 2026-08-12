// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { coerce, parseRange, satisfies, type SemVerRange } from "verkit";

import { versionQuery } from "@/api/mas";

// The MAS release range in which each feature is available
const range = (range: string): SemVerRange =>
  parseRange(range, { includePrerelease: true });
const masFeaturesRanges = {
  personalTokens: range(">=1.5.0"),
  devices: range(">=1.20.0"),
} as const satisfies Record<string, SemVerRange>;

type MasFeature = keyof typeof masFeaturesRanges;

export type MasFeaturesStatus = Record<MasFeature, boolean>;

const computeFeaturesStatus = (version: string): MasFeaturesStatus => {
  const coerced = coerce(version);

  // If we can't parse the version, conservatively assume no feature is available.
  if (!coerced) {
    return Object.fromEntries(
      Object.keys(masFeaturesRanges).map((feature) => [feature, false]),
    ) as MasFeaturesStatus;
  }

  return Object.fromEntries(
    Object.entries(masFeaturesRanges).map(([feature, range]) => [
      feature,
      satisfies(coerced, range),
    ]),
  ) as MasFeaturesStatus;
};

/**
 * A hook to get the availability of all the features on the given server
 *
 * @param serverName The server name to which the query is sent
 * @returns A record indicating which features are available
 */
export const useFeaturesStatus = (serverName: string): MasFeaturesStatus => {
  const {
    data: { version },
  } = useSuspenseQuery(versionQuery(serverName));
  const featuresStatus = useMemo(
    () => computeFeaturesStatus(version),
    [version],
  );
  return featuresStatus;
};

/**
 * Get the availability of all the features on the given server
 *
 * @param queryClient The Tanstack Query client to use
 * @param serverName The server name to which the query is sent
 * @returns A record indicating which features are available
 */
export const getFeaturesStatus = async (
  queryClient: QueryClient,
  serverName: string,
): Promise<MasFeaturesStatus> => {
  const { version } = await queryClient.ensureQueryData(
    versionQuery(serverName),
  );
  return computeFeaturesStatus(version);
};
