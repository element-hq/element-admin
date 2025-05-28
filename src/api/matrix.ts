import { queryOptions } from "@tanstack/react-query";
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
