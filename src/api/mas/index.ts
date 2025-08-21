import { type QueryClient, queryOptions } from "@tanstack/react-query";

import * as api from "./api";
import { createClient, type Client } from "./api/client";
import { authMetadataQuery } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { accessToken } from "@/stores/auth";

const masClient = createClient();

const masBaseOptions = async (
  client: QueryClient,
  serverName: string,
  signal?: AbortSignal,
): Promise<{
  client: Client;
  auth: string;
  baseUrl: string;
  signal?: AbortSignal;
}> => {
  const token = await accessToken(client, signal);
  if (!token) {
    throw new Error("No access token");
  }

  const wellKnown = await client.ensureQueryData(wellKnownQuery(serverName));

  const authMetadata = await client.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  return {
    client: masClient,
    auth: token,
    baseUrl: authMetadata.issuer.replace(/\/$/, ""),
    ...(signal && { signal }),
  };
};

export interface UserListParameters {
  before?: string;
  after?: string;
  first?: number;
  last?: number;
  admin?: boolean;
  status?: "active" | "locked" | "deactivated";
}

export interface TokenListParameters {
  before?: string;
  after?: string;
  first?: number;
  last?: number;
  used?: boolean;
  revoked?: boolean;
  expired?: boolean;
  valid?: boolean;
}

export interface CreateTokenParameters {
  token?: string; // Custom token string (optional)
  usage_limit?: number;
  expires_at?: string; // ISO date string
}

export interface EditTokenParameters {
  usage_limit?: number | null;
  expires_at?: string | null; // ISO date string
}

export const usersQuery = (
  serverName: string,
  parameters: UserListParameters = {},
) =>
  queryOptions({
    queryKey: ["mas", "users", serverName, parameters],
    queryFn: async ({ client, signal }) => {
      const query: api.ListUsersData["query"] = {};

      if (parameters.before) query["page[before]"] = parameters.before;
      if (parameters.after) query["page[after]"] = parameters.after;
      if (parameters.first) query["page[first]"] = parameters.first;
      if (parameters.last) query["page[last]"] = parameters.last;
      if (parameters.admin !== undefined)
        query["filter[admin]"] = parameters.admin;
      if (parameters.status) query["filter[status]"] = parameters.status;

      return await api.listUsers({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
    },
  });

export const userQuery = (serverName: string, userId: string) =>
  queryOptions({
    queryKey: ["mas", "user", serverName, userId],
    queryFn: async ({ client, signal }) => {
      return await api.getUser({
        ...(await masBaseOptions(client, serverName, signal)),
        path: { id: userId },
      });
    },
  });

export const lockUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
) => {
  return await api.lockUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
};

export const deactivateUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
) => {
  return await api.deactivateUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
};

export const userEmailsQuery = (serverName: string, userId: string) =>
  queryOptions({
    queryKey: ["mas", "user-emails", serverName, userId],
    queryFn: async ({ client, signal }) => {
      return await api.listUserEmails({
        ...(await masBaseOptions(client, serverName, signal)),
        query: {
          "filter[user]": userId,
          "page[first]": 10,
        },
      });
    },
  });

export const unlockUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
) => {
  return await api.unlockUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
};

export const registrationTokensQuery = (
  serverName: string,
  parameters: TokenListParameters = {},
) =>
  queryOptions({
    queryKey: ["mas", "registration-tokens", serverName, parameters],
    queryFn: async ({ client, signal }) => {
      const query: api.ListUserRegistrationTokensData["query"] = {};

      if (parameters.before) query["page[before]"] = parameters.before;
      if (parameters.after) query["page[after]"] = parameters.after;
      if (parameters.first) query["page[first]"] = parameters.first;
      if (parameters.last) query["page[last]"] = parameters.last;
      if (parameters.used !== undefined)
        query["filter[used]"] = parameters.used;
      if (parameters.revoked !== undefined)
        query["filter[revoked]"] = parameters.revoked;
      if (parameters.expired !== undefined)
        query["filter[expired]"] = parameters.expired;
      if (parameters.valid !== undefined)
        query["filter[valid]"] = parameters.valid;

      return await api.listUserRegistrationTokens({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
    },
  });

export const registrationTokenQuery = (serverName: string, tokenId: string) =>
  queryOptions({
    queryKey: ["mas", "registration-token", serverName, tokenId],
    queryFn: async ({ client, signal }) => {
      return await api.getUserRegistrationToken({
        ...(await masBaseOptions(client, serverName, signal)),
        path: { id: tokenId },
      });
    },
  });

export const createRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  parameters: CreateTokenParameters = {},
  signal?: AbortSignal,
) => {
  const body: api.AddUserRegistrationTokenData["body"] = {};

  if (parameters.expires_at) body.expires_at = parameters.expires_at;
  if (parameters.usage_limit !== undefined)
    body.usage_limit = parameters.usage_limit;
  if (parameters.token) body.token = parameters.token;

  return await api.addUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    body,
  });
};

export const revokeRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: api.Ulid,
  signal?: AbortSignal,
) => {
  return await api.revokeUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: tokenId },
  });
};

export const unrevokeRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: api.Ulid,
  signal?: AbortSignal,
) => {
  return await api.unrevokeUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: tokenId },
  });
};

export const editRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: api.Ulid,
  parameters: EditTokenParameters,
  signal?: AbortSignal,
) => {
  const body: api.UpdateUserRegistrationTokenData["body"] = {};

  if (parameters.expires_at !== undefined)
    body.expires_at = parameters.expires_at;
  if (parameters.usage_limit !== undefined)
    body.usage_limit = parameters.usage_limit;

  return await api.updateUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: tokenId },
    body,
  });
};
