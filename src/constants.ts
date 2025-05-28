import type { ClientMetadata } from "@/api/auth";

export const PAGE_SIZE = 10;

export const REDIRECT_URI = "http://localhost:3000/callback";

export const CLIENT_METADATA: ClientMetadata = {
  application_type: "web",
  client_name: "Element Admin",
  client_uri: "http://localhost:3000/",
  redirect_uris: [REDIRECT_URI],
  token_endpoint_auth_method: "none",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
};
