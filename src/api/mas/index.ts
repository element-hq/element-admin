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

  // There is an edge-case where the issuer is not the same as where MAS is deployed.
  // In this case, we rely on the GraphQL endpoint to determine the MAS API
  // root. Ideally MAS would tell us in the metadata the exact base.
  let baseUrl = authMetadata.issuer.replace(/\/$/, "");
  if (
    authMetadata["org.matrix.matrix-authentication-service.graphql_endpoint"]
  ) {
    baseUrl = authMetadata[
      "org.matrix.matrix-authentication-service.graphql_endpoint"
    ].replace(/\/graphql$/, "");
  }

  return {
    client: masClient,
    auth: token,
    baseUrl,
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
  guest?: boolean;
  status?: "active" | "locked" | "deactivated";
  search?: string;
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

// FIXME: pagination direction is temporary until MAS gets proper ordering in the API
type PaginationDirection = "forward" | "backward";

export const siteConfigQuery = (serverName: string) =>
  queryOptions({
    queryKey: ["mas", "site-config", serverName],
    queryFn: async ({ client, signal }): Promise<api.SiteConfig> => {
      try {
        return await api.siteConfig({
          ...(await masBaseOptions(client, serverName, signal)),
        });
      } catch (error) {
        console.warn(
          "Site-config query failed, this is likely because of talking to an older version of MAS, ignoring",
          error,
        );
        // Fallback to a vaguely sensible config where everything is enabled
        return {
          account_deactivation_allowed: true,
          account_recovery_allowed: true,
          captcha_enabled: true,
          displayname_change_allowed: true,
          email_change_allowed: true,
          minimum_password_complexity: 3,
          password_change_allowed: true,
          password_login_enabled: true,
          password_registration_enabled: true,
          registration_token_required: true,
          server_name: serverName,
        };
      }
    },
  });

export const usersInfiniteQuery = (
  serverName: string,
  parameters: UserListFilters = {},
  direction: PaginationDirection = "forward",
) =>
  infiniteQueryOptions({
    queryKey: ["mas", "users", serverName, parameters, direction],
    queryFn: async ({ client, signal, pageParam }) => {
      const query: api.ListUsersData["query"] = {};

      if (direction === "forward") {
        query["page[first]"] = PAGE_SIZE;
        if (pageParam) query["page[after]"] = pageParam;
      } else {
        query["page[last]"] = PAGE_SIZE;
        if (pageParam) query["page[before]"] = pageParam;
      }

      if (parameters.admin !== undefined)
        query["filter[admin]"] = parameters.admin;
      if (parameters.guest !== undefined)
        query["filter[legacy-guest]"] = parameters.guest;
      if (parameters.status) query["filter[status]"] = parameters.status;
      if (parameters.search) query["filter[search]"] = parameters.search;

      return await api.listUsers({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
    },
    initialPageParam: null as api.Ulid | null,
    getNextPageParam: (lastPage): api.Ulid | null =>
      direction === "forward"
        ? ((lastPage.links.next && lastPage.data.at(-1)?.id) ?? null)
        : ((lastPage.links.prev && lastPage.data.at(0)?.id) ?? null),
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

export const registeredUsersCountQuery = (serverName: string) =>
  queryOptions({
    queryKey: ["mas", "registered-users-count", serverName],
    queryFn: async ({ client, signal }) => {
      const data = await api.listUsers({
        ...(await masBaseOptions(client, serverName, signal)),
        query: {
          "page[first]": 1,
        },
      });
      return data.meta.count;
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

export const setUserCanRequestAdmin = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  canRequestAdmin: boolean,
  signal?: AbortSignal,
) => {
  return await api.userSetAdmin({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
    body: {
      admin: canRequestAdmin,
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
      (lastPage.links.next && lastPage.data.at(-1)?.id) ?? null,
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
