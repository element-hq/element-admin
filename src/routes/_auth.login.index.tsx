import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Form, InlineSpinner } from "@vector-im/compound-web";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";

import { authMetadataQuery, clientRegistration } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { CLIENT_METADATA, REDIRECT_URI } from "@/constants";
import { useAuthStore } from "@/stores/auth";

const DEFAULT_SERVER_NAME = "matrix.org";

export const Route = createFileRoute("/_auth/login/")({
  loader: ({ context: { intl } }) => ({
    title: intl.formatMessage({
      id: "pages.login.title",
      description: "Title for the login page",
      defaultMessage: "Login",
    }),
  }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const [serverName, setServerName] = useState(DEFAULT_SERVER_NAME);
  const [debouncedServerName, setDebouncedServerName] =
    useState(DEFAULT_SERVER_NAME);

  const authorizationSession = useAuthStore(
    (state) => state.authorizationSession,
  );

  // Debounced effect to update the server name used for the query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedServerName(serverName);
    }, 250);

    return () => clearTimeout(timeout);
  }, [serverName]);

  const {
    data: discovery,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["serverDiscovery", debouncedServerName],
    queryFn: async ({ client }) => {
      // Step 1: Well-known discovery
      const wellKnown = await client.ensureQueryData(
        wellKnownQuery(debouncedServerName),
      );
      const synapseRoot = wellKnown["m.homeserver"].base_url;

      // Step 2: Auth metadata discovery
      const authMetadata = await client.ensureQueryData(
        authMetadataQuery(synapseRoot),
      );

      // Step 3: Client registration
      const clientMetadata = await clientRegistration(
        authMetadata.registration_endpoint,
        CLIENT_METADATA,
      );

      // Step 4: Start authorization session
      await useAuthStore
        .getState()
        .startAuthorizationSession(
          debouncedServerName,
          clientMetadata.client_id,
        );

      return {
        serverName: debouncedServerName,
        synapseRoot,
        authMetadata,
        clientId: clientMetadata.client_id,
      };
    },
    retry: false,
    enabled: !!debouncedServerName.trim(),
  });

  const handleServerNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      event.preventDefault();
      setServerName(event.target.value.toLowerCase().trim());
    },
    [],
  );

  // Create authorize URL if we have all the data
  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!discovery?.authMetadata || !authorizationSession) {
        return;
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

      const url = new URL(discovery.authMetadata.authorization_endpoint);
      url.search = parameters.toString();
      globalThis.window.location.href = url.toString();
    },
    [discovery, authorizationSession],
  );

  const isLoading =
    (debouncedServerName !== serverName || isFetching) && serverName !== "";
  const isReady = !isLoading && !isError && serverName !== "";

  return (
    <Form.Root onSubmit={onSubmit}>
      <Form.Field name="serverName" serverInvalid={isError}>
        <Form.Label>
          <FormattedMessage
            id="pages.login.server_name"
            description="Label for the server name field"
            defaultMessage="Server name"
          />
        </Form.Label>
        <Form.TextControl
          value={serverName}
          onChange={handleServerNameChange}
          autoCapitalize="none"
          type="text"
        />
        {isError && (
          <Form.ErrorMessage>
            <FormattedMessage
              id="pages.login.failed_to_reach"
              defaultMessage="Failed to reach server"
              description="Error message when the server name is invalid"
            />
          </Form.ErrorMessage>
        )}
      </Form.Field>

      <Form.Submit disabled={!isReady}>
        {isLoading && <InlineSpinner />}
        <FormattedMessage
          id="pages.login.get_started"
          defaultMessage="Get started"
          description="On the login page, this starts the authorization process"
        />
      </Form.Submit>
    </Form.Root>
  );
}
