import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { type } from "arktype";

import { accessToken } from "@/stores/auth";

const ServerVersionResponse = type({
  server_version: "string",
});

export const serverVersionQuery = (
  queryClient: QueryClient,
  synapseRoot: string,
) =>
  queryOptions({
    queryKey: ["serverVersion", synapseRoot],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const url = new URL("/_synapse/admin/v1/server_version", synapseRoot);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get server version");
      }

      const serverVersion = ServerVersionResponse(await response.json());
      if (serverVersion instanceof type.errors) {
        throw new Error(serverVersion.summary);
      }

      return serverVersion;
    },
  });
