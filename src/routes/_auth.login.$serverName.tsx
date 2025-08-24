/* eslint-disable formatjs/no-literal-string-in-jsx -- Temporary screen */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form } from "@vector-im/compound-web";

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

  const parameters = new URLSearchParams({
    response_type: "code",
    client_id: authorizationSession.clientId,
    redirect_uri: REDIRECT_URI,
    scope:
      "urn:matrix:org.matrix.msc2967.client:api:* urn:mas:admin urn:synapse:admin:*",
    state: authorizationSession.state,
    code_challenge: authorizationSession.codeChallenge,
    code_challenge_method: "S256",
  });

  const authorizeUrl = new URL(authMetadata.authorization_endpoint);
  authorizeUrl.search = parameters.toString();

  return (
    <Form.Root>
      <Form.Field name="serverName">
        <Form.Label>Server Name</Form.Label>
        <Form.TextControl value={serverName} readOnly />
      </Form.Field>

      <Form.Field name="synapseRoot">
        <Form.Label>Matrix C-S API root</Form.Label>
        <Form.TextControl value={synapseRoot} readOnly />
      </Form.Field>

      <Form.Field name="masApiRoot">
        <Form.Label>MAS API root</Form.Label>
        <Form.TextControl value={authMetadata.issuer} readOnly />
      </Form.Field>

      <Form.Field name="clientId">
        <Form.Label>Client ID</Form.Label>
        <Form.TextControl value={authorizationSession.clientId} readOnly />
      </Form.Field>

      <Button
        as="a"
        style={{ inlineSize: "initial" }}
        href={authorizeUrl.toString()}
      >
        Authorize
      </Button>
    </Form.Root>
  );
}
