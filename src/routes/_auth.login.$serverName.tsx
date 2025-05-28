import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@vector-im/compound-web";

import { authMetadataQuery, clientRegistration } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { CLIENT_METADATA, REDIRECT_URI } from "@/constants";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/_auth/login/$serverName")({
  loader: async ({ params: { serverName }, context }) => {
    const wellKnown = await context.queryClient.ensureQueryData(
      wellKnownQuery(serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    const authMetadata = await context.queryClient.ensureQueryData(
      authMetadataQuery(synapseRoot),
    );

    const clientMetadata = await clientRegistration(
      authMetadata.registration_endpoint,
      CLIENT_METADATA,
    );

    await useAuthStore
      .getState()
      .startAuthorizationSession(serverName, clientMetadata.client_id);
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { serverName } = Route.useParams();
  const { data: wellKnown } = useSuspenseQuery(wellKnownQuery(serverName));
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const authorizationSession = useAuthStore(
    (state) => state.authorizationSession,
  );

  const { data: authMetadata } = useSuspenseQuery(
    authMetadataQuery(synapseRoot),
  );

  if (!authorizationSession) {
    throw new Error("No authorization session");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: authorizationSession.clientId,
    redirect_uri: REDIRECT_URI,
    scope: "urn:mas:admin urn:synapse:admin:*",
    state: authorizationSession.state,
    code_challenge: authorizationSession.codeChallenge,
    code_challenge_method: "S256",
  });

  const authorizeUrl = new URL(authMetadata.authorization_endpoint);
  authorizeUrl.search = params.toString();

  return (
    <div>
      <Button as="a" href={authorizeUrl.toString()}>
        Authorize
      </Button>
    </div>
  );
}
