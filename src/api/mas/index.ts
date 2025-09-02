import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";

import { authMetadataQuery } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { PAGE_SIZE } from "@/constants";
import { accessToken } from "@/stores/auth";

import * as api from "./api";
import { createClient, type Client } from "./api/client";

const masClient = createClient();

export const isErrorResponse = (t: unknown): t is api.ErrorResponse =>
  typeof t === "object" && t !== null && Object.hasOwn(t, "errors");

const masBaseOptions = async (
  client: QueryClient,
  serverName: string,
  signal?: AbortSignal,
): Promise<{
  client: Client;
  auth: string;
  baseUrl: string;
  throwOnError: true;
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
    throwOnError: true,
    ...(signal && { signal }),
  };
};

interface PageParameters {
  before?: string;
  after?: string;
  first?: number;
  last?: number;
}

export interface UserListFilters {
  admin?: boolean;
  status?: "active" | "locked" | "deactivated";
}

export interface TokenListParameters extends PageParameters {
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

export const usersInfiniteQuery = (
  serverName: string,
  parameters: UserListFilters = {},
) =>
  infiniteQueryOptions({
    queryKey: ["mas", "users", serverName, parameters],
    queryFn: async ({ client, signal, pageParam }) => {
      const query: api.ListUsersData["query"] = {
        "page[first]": PAGE_SIZE,
      };

      if (pageParam) query["page[after]"] = pageParam;

      if (parameters.admin !== undefined)
        query["filter[admin]"] = parameters.admin;
      if (parameters.status) query["filter[status]"] = parameters.status;

      return await api.listUsers({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
    },
    initialPageParam: null as api.Ulid | null,
    getNextPageParam: (lastPage): api.Ulid | null =>
      lastPage.data.at(-1)?.id ?? null,
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

export const createUser = async (
  queryClient: QueryClient,
  serverName: string,
  username: string,
  signal?: AbortSignal,
) => {
  return api.createUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    body: {
      username,
    },
  });
};

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

export const reactivateUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
) => {
  return await api.reactivateUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
};

export const setUserPassword = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  password: string,
  skipPasswordCheck = false,
  signal?: AbortSignal,
) => {
  return await api.setUserPassword({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
    body: {
      password,
      skip_password_check: skipPasswordCheck,
    },
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

export const registrationTokensInfiniteQuery = (
  serverName: string,
  parameters: Omit<
    TokenListParameters,
    "after" | "before" | "first" | "last"
  > = {},
) =>
  infiniteQueryOptions({
    queryKey: ["mas", "registration-tokens-infinite", serverName, parameters],
    queryFn: async ({ client, signal, pageParam }) => {
      const query: api.ListUserRegistrationTokensData["query"] = {
        "page[first]": PAGE_SIZE,
      };

      if (pageParam) query["page[after]"] = pageParam;

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
    initialPageParam: null as api.Ulid | null,
    getNextPageParam: (lastPage): api.Ulid | null =>
      lastPage.data.at(-1)?.id ?? null,
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
