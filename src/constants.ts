import type { ClientMetadata } from "@/api/auth";

export const PAGE_SIZE = 50;

export const REDIRECT_URI = new URL(
  "/callback",
  globalThis.location.origin,
).toString();

export const CLIENT_METADATA: ClientMetadata = {
  application_type: "web",
  client_name: "Element Admin",
  client_uri: new URL("/", globalThis.location.origin).toString(),
  redirect_uris: [REDIRECT_URI],
  token_endpoint_auth_method: "none",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
};
