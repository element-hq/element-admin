import { queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

const AuthMetadataResponse = v.object({
  issuer: v.string(),
  authorization_endpoint: v.string(),
  token_endpoint: v.string(),
  registration_endpoint: v.string(),
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

      const authMetadata = v.parse(AuthMetadataResponse, await response.json());

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

const ClientRegistrationResponse = v.object({
  client_id: v.string(),
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

  const clientRegistrationData = v.parse(
    ClientRegistrationResponse,
    await response.json(),
  );

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

const TokenResponse = v.object({
  access_token: v.string(),
  refresh_token: v.string(),
  expires_in: v.number(),
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

  const tokenData = v.parse(TokenResponse, await response.json());

  return tokenData;
};
