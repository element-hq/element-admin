// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import * as v from "valibot";
import { parse, type SemVer } from "verkit";

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
  if (!data || !data.version) return null;
  return parse(data.version);
};

const AdminbotResponse = v.object({
  access_token: v.string(),
  device_id: v.string(),
  mxid: v.string(),
  secure_passphrase: v.nullish(v.string()),
  ui_address: v.nullish(v.pipe(v.string(), v.url())),
});

export type AdminbotResponse = v.InferOutput<typeof AdminbotResponse>;

export const adminbotQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["ess", "adminbot", synapseRoot],
    queryFn: async ({ client, signal }) => {
      const adminbotUrl = new URL("/_synapse/ess/adminbot", synapseRoot);
      const token = await accessToken(client, signal);
      const response = await fetch(adminbotUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (response.status === 404) {
        return null;
      }

      ensureResponseOk(response);

      const adminbotData = v.parse(AdminbotResponse, await response.json());

      return adminbotData;
    },
  });
