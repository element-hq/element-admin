// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { QueryClient } from "@tanstack/react-query";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import * as v from "valibot";

import { MatrixStandardError, UnauthorizedError } from "@/errors";
import { accessToken } from "@/stores/auth";
import { ensureResponseOk } from "@/utils/fetch";

export const MatrixErrorResponse = v.object({
  errcode: v.string(),
  error: v.string(),
});

/**
 * Throws for a failed response from Synapse or a Synapse module, decoding the
 * Matrix error body when there is one.
 */
export const ensureNotError = async (
  response: Response,
  handleNotFound = false,
) => {
  try {
    ensureResponseOk(response);
  } catch (error) {
    // Try to decode the error message from the JSON response
    let matrixError;
    try {
      const data = await response.json();
      matrixError = v.parse(MatrixErrorResponse, data);
    } catch {
      // In case the body wasn't JSON, ignore that error and instead throw the original error
      throw error;
    }

    // Synapse answers M_UNKNOWN_TOKEN for an expired, revoked or unknown
    // access token, and other codes for failures unrelated to the session.
    if (response.status === 401 && matrixError.errcode === "M_UNKNOWN_TOKEN") {
      throw new UnauthorizedError(response, { cause: error });
    }

    // Special case for M_NOT_FOUND errors
    if (
      handleNotFound &&
      response.status === 404 &&
      matrixError.errcode === "M_NOT_FOUND"
    ) {
      console.warn(
        "Received M_NOT_FOUND error from Synapse, throwing a 'notFound' error",
        error,
        matrixError,
      );
      throw notFound();
    }

    throw new MatrixStandardError(matrixError.errcode, matrixError.error, {
      cause: error,
    });
  }
};

const baseOptions = async (
  client: QueryClient,
  signal?: AbortSignal,
): Promise<{ signal?: AbortSignal; headers: HeadersInit }> => ({
  headers: {
    Authorization: `Bearer ${await accessToken(client, signal)}`,
  },
  signal,
});

const WellKnownResponse = v.object({
  "m.homeserver": v.object({
    base_url: v.string(),
  }),
});

export const wellKnownQuery = (serverName: string) =>
  queryOptions({
    queryKey: ["wellKnownDiscovery", serverName],
    queryFn: async ({ signal }) => {
      const wellKnown = new URL(
        "/.well-known/matrix/client",
        `https://${serverName}/`,
      );
      const wkResponse = await fetch(wellKnown, { signal });

      ensureResponseOk(wkResponse);

      const wkData = v.parse(WellKnownResponse, await wkResponse.json());

      return wkData;
    },
  });

const WhoamiResponse = v.object({
  user_id: v.string(),
});

export const whoamiQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["matrix", "whoami", synapseRoot],
    queryFn: async ({ client, signal }) => {
      const whoamiUrl = new URL(
        "/_matrix/client/v3/account/whoami",
        synapseRoot,
      );
      const response = await fetch(
        whoamiUrl,
        await baseOptions(client, signal),
      );

      await ensureNotError(response);

      const whoamiData = v.parse(WhoamiResponse, await response.json());

      return whoamiData;
    },
  });

const ProfileResponse = v.object({
  avatar_url: v.optional(v.string()),
  displayname: v.optional(v.string()),
});

export const profileQuery = (synapseRoot: string, mxid: string) =>
  queryOptions({
    queryKey: ["matrix", "profile", synapseRoot, mxid],
    queryFn: async ({ client, signal }) => {
      const profileUrl = new URL(
        `/_matrix/client/v3/profile/${encodeURIComponent(mxid)}`,
        synapseRoot,
      );
      const response = await fetch(
        profileUrl,
        await baseOptions(client, signal),
      );

      // Special case: if we get a 404, it might be fine, just return an empty profile
      if (response.status === 404) {
        return {};
      }

      await ensureNotError(response);

      const profileData = v.parse(ProfileResponse, await response.json());

      return profileData;
    },
  });

const parseMxcUrl = (mxc: string): [string, string] => {
  const mxcUrl = new URL(mxc);
  if (mxcUrl.protocol !== "mxc:") {
    throw new Error("Not a mxc url");
  }
  const serverName = mxcUrl.hostname;
  const mediaId = mxcUrl.pathname.slice(1);
  return [serverName, mediaId];
};

/** Thumbnail a media file from a Matrix content URI. The thumbnailing is hard-coded to 96x96 with the method set to 'crop' */
export const mediaThumbnailQuery = (
  synapseRoot: string,
  mxc: string | undefined,
) =>
  queryOptions({
    queryKey: ["matrix", "media-thumbnail", synapseRoot, mxc],
    // Never try to re-fetch a media, they are immutable
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: mxc
      ? async ({ client, signal }): Promise<Blob> => {
          const [serverName, mediaId] = parseMxcUrl(mxc);

          const mediaUrl = new URL(
            `/_matrix/client/v1/media/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}?width=96&height=96&method=crop`,
            synapseRoot,
          );
          const response = await fetch(
            mediaUrl,
            await baseOptions(client, signal),
          );

          await ensureNotError(response);

          return response.blob();
        }
      : skipToken,
  });
