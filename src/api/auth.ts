import { queryOptions } from "@tanstack/react-query";
import { type } from "arktype";

const AuthMetadataResponse = type({
  issuer: "string",
  authorization_endpoint: "string",
  token_endpoint: "string",
  registration_endpoint: "string",
});

export const authMetadataQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["authMetadataDiscovery", synapseRoot],
    queryFn: async ({ signal }) => {
      const authMetadataUrl = new URL(
        "/_matrix/client/unstable/org.matrix.msc2965/auth_metadata",
        synapseRoot,
      );
      const response = await fetch(authMetadataUrl, { signal });

      if (!response.ok) {
        throw new Error("Failed to discover");
      }

      const authMetadata = AuthMetadataResponse(await response.json());
      if (authMetadata instanceof type.errors) {
        throw new Error(authMetadata.summary);
      }

      return authMetadata;
    },
  });

export type ClientMetadata = {
  application_type: string;
  client_name: string;
  client_uri: string;
  token_endpoint_auth_method: string;
  grant_types: string[];
  redirect_uris: string[];
  response_types: string[];
};

const ClientRegistrationResponse = type({
  client_id: "string",
});

export const clientRegistration = async (
  registrationEndpoint: string,
  clientMetadata: ClientMetadata,
  signal: AbortSignal | null = null,
) => {
  const response = await fetch(registrationEndpoint, {
    method: "POST",
    body: JSON.stringify(clientMetadata),
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to register client");
  }

  const clientRegistrationData = ClientRegistrationResponse(
    await response.json(),
  );

  if (clientRegistrationData instanceof type.errors) {
    throw new Error(clientRegistrationData.summary);
  }

  return clientRegistrationData;
};

type TokenRequestParams =
  | {
      grant_type: "authorization_code";
      code: string;
      code_verifier: string;
      client_id: string;
      redirect_uri: string;
    }
  | {
      grant_type: "refresh_token";
      refresh_token: string;
      client_id: string;
    };

const TokenResponse = type({
  access_token: "string",
  refresh_token: "string",
  expires_in: "number",
});

export const tokenRequest = async (
  tokenEndpoint: string,
  params: TokenRequestParams,
  signal: AbortSignal | null = null,
) => {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    body: new URLSearchParams(params),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to get token");
  }

  const tokenData = TokenResponse(await response.json());
  if (tokenData instanceof type.errors) {
    throw new Error(tokenData.summary);
  }

  return tokenData;
};
