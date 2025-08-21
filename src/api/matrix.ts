import { type QueryClient, queryOptions } from "@tanstack/react-query";
import * as v from "valibot";
import { accessToken } from "@/stores/auth";

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

      if (!wkResponse.ok) {
        throw new Error("Failed to discover");
      }

      const wkData = v.parse(WellKnownResponse, await wkResponse.json());

      return wkData;
    },
  });

const WhoamiResponse = v.object({
  user_id: v.string(),
});

export const whoamiQuery = (queryClient: QueryClient, synapseRoot: string) =>
  queryOptions({
    queryKey: ["matrix", "whoami", synapseRoot],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const whoamiUrl = new URL(
        "/_matrix/client/v3/account/whoami",
        synapseRoot,
      );
      const response = await fetch(whoamiUrl, {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to call whoami");
      }

      const whoamiData = v.parse(WhoamiResponse, await response.json());

      return whoamiData;
    },
  });

const ProfileResponse = v.object({
  avatar_url: v.string(),
  displayname: v.string(),
});

export const profileQuery = (
  queryClient: QueryClient,
  synapseRoot: string,
  mxid: string,
) =>
  queryOptions({
    queryKey: ["matrix", "profile", synapseRoot, mxid],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const profileUrl = new URL(
        `/_matrix/client/v3/profile/${encodeURIComponent(mxid)}`,
        synapseRoot,
      );
      const response = await fetch(profileUrl, {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile for ${mxid}`);
      }

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
  queryClient: QueryClient,
  synapseRoot: string,
  mxc: string | null,
) =>
  queryOptions({
    enabled: !!mxc,
    queryKey: ["matrix", "media-thumbnail", synapseRoot, mxc],
    queryFn: async ({ signal }): Promise<Blob> => {
      if (!mxc) {
        throw new Error("No mxc set");
      }

      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const [serverName, mediaId] = parseMxcUrl(mxc);

      const mediaUrl = new URL(
        `/_matrix/media/v3/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}?width=96&height=96&method=crop`,
        synapseRoot,
      );
      const response = await fetch(mediaUrl, {
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch media thumbnail for ${mxc}`);
      }

      const mediaData = await response.blob();

      return mediaData;
    },
  });
