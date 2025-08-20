import { createFileRoute, redirect } from "@tanstack/react-router";
import * as v from "valibot";

import { authMetadataQuery, tokenRequest } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { REDIRECT_URI } from "@/constants";
import { useAuthStore } from "@/stores/auth";

const SearchParams = v.intersect([
  v.object({
    state: v.string(),
  }),
  v.union([
    v.object({
      code: v.string(),
    }),
    v.object({
      error: v.string(),
      error_description: v.optional(v.string()),
    }),
  ]),
]);

export const Route = createFileRoute("/callback")({
  validateSearch: SearchParams,
  loaderDeps: ({ search }) => ({ search }),

  loader: async ({ deps: { search }, context }) => {
    const state = useAuthStore.getState();
    const session = state.authorizationSession;
    const saveCredentials = state.saveCredentials;
    if (!session) {
      throw new Error("No session");
    }

    if ("error" in search) {
      throw new Error(search.error_description || search.error);
    }

    if (search.state !== session.state) {
      throw new Error(
        `Invalid state. Expected ${session.state}, got ${search.state}.`,
      );
    }

    const code = search.code;

    const wellKnown = await context.queryClient.ensureQueryData(
      wellKnownQuery(session.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    const authMetadata = await context.queryClient.ensureQueryData(
      authMetadataQuery(synapseRoot),
    );

    const tokenResponse = await tokenRequest(authMetadata.token_endpoint, {
      grant_type: "authorization_code",
      code,
      code_verifier: session.codeVerifier,
      client_id: session.clientId,
      redirect_uri: REDIRECT_URI,
    });

    // TODO: looks like we have to do it on the next tick, else it invalidates
    // the route match?
    setTimeout(
      () =>
        saveCredentials(
          session.serverName,
          session.clientId,
          tokenResponse.access_token,
          tokenResponse.refresh_token,
          tokenResponse.expires_in,
        ),
      0,
    );

    throw redirect({ to: "/" });
  },
});
