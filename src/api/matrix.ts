import { accessToken } from "@/stores/auth";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { type } from "arktype";

const WellKnownResponse = type({
  "m.homeserver": {
    base_url: "string",
  },
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

      const wkData = WellKnownResponse(await wkResponse.json());
      if (wkData instanceof type.errors) {
        throw new Error(wkData.summary);
      }

      return wkData;
    },
  });

const WhoamiResponse = type({
  user_id: "string",
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

      const whoamiData = WhoamiResponse(await response.json());
      if (whoamiData instanceof type.errors) {
        throw new Error(whoamiData.summary);
      }

      return whoamiData;
    },
  });
