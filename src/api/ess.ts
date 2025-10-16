// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type SemVer from "semver/classes/semver";
import parseSemver from "semver/functions/parse";
import * as v from "valibot";

import { accessToken } from "@/stores/auth";
import { ensureResponseOk, fetch } from "@/utils/fetch";

const VersionResponse = v.object({
  version: v.nullable(v.string()),
  edition: v.fallback(v.nullable(v.picklist(["community", "pro"])), null),
});

export const essVersionQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["ess", "version", synapseRoot],
    queryFn: async ({ client, signal }) => {
      const versionUrl = new URL("/_synapse/ess/version", synapseRoot);
      try {
        const token = await accessToken(client, signal);
        const response = await fetch(versionUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        ensureResponseOk(response);

        const versionData = v.parse(VersionResponse, await response.json());

        return versionData;
      } catch (error) {
        console.warn(
          "Failed to detect ESS version, this is probably not an ESS deployment",
          error,
        );
        return {
          version: null,
          edition: null,
        };
      }
    },
  });

export const useEssVariant = (
  synapseRoot: string,
): null | "community" | "pro" => {
  const { data } = useSuspenseQuery(essVersionQuery(synapseRoot));
  return data.edition;
};

export const useEssVersion = (synapseRoot: string): null | SemVer => {
  const { data } = useSuspenseQuery(essVersionQuery(synapseRoot));
  if (!data) return null;
  return parseSemver(data.version);
};
