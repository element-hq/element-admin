import { accessToken } from "@/stores/auth";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

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
