// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { authMetadataQuery } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { PAGE_SIZE } from "@/constants";
import { accessToken } from "@/stores/auth";
import { fetch } from "@/utils/fetch";

import * as api from "./api";
import { createClient, type Client } from "./api/client";

const masClient = createClient({
  fetch,
});

export const isErrorResponse = (t: unknown): t is api.ErrorResponse =>
  typeof t === "object" && t !== null && Object.hasOwn(t, "errors");

function ensureNoError<
  R extends {
    data: unknown;
    error: unknown | undefined;
    response: Response;
    request: Request;
  },
>(
  result: R,
  handleNotFound = false,
): asserts result is R & { data: NonNullable<R["data"]>; error: undefined } {
  if (handleNotFound && result.response.status === 404) {
    console.warn(
      `MAS replied with a 404 on ${result.request.method} request to ${result.request.url}, throwing a 'not found' error`,
    );
    throw notFound({
      data: result.error,
    });
  }
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.data === undefined) {
    throw new TypeError("Missing data");
  }
}

type WithData<R extends { data?: unknown[] | null | undefined }> = R & {
  data: NonNullable<R["data"]>;
};
function ensureHasData<R extends { data?: unknown[] | null | undefined }>(
  response: R,
): asserts response is WithData<R> {
  if (!Array.isArray(response?.data)) {
    throw new TypeError("Unexpected response from MAS");
  }
}

function ensureHasCount<R extends { meta?: { count?: number | null } | null }>(
  response: R,
): asserts response is R & { meta: { count: number } } {
  if (typeof response.meta?.count !== "number") {
    throw new TypeError("Unexpected response from MAS");
  }
}

interface SingleResource {
  readonly id: string;
  readonly meta?: {
    readonly page?: {
      cursor: string;
    };
  };
}

// Extracts the cursor from an item on a page. This works with both MAS 1.4.0
// and earlier versions
const cursorForSingleResource = (
  resource: SingleResource | null | undefined,
): string | null => resource?.meta?.page?.cursor ?? resource?.id ?? null;

const masBaseOptions = async (
  client: QueryClient,
  serverName: string,
  signal?: AbortSignal,
): Promise<{
  client: Client;
  auth: string;
  baseUrl: string;
  throwOnError: false;
  signal?: AbortSignal;
}> => {
  const token = await accessToken(client, signal);
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
    throwOnError: false,
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
        const result = await api.siteConfig({
          ...(await masBaseOptions(client, serverName, signal)),
        });
        ensureNoError(result);
        return result.data;
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
          password_registration_email_required: true,
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
    queryFn: async ({
      client,
      signal,
      pageParam,
    }): Promise<WithData<api.PaginatedResponseForUser>> => {
      const query: api.ListUsersData["query"] = {
        count: "false",
      };

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

      const result = await api.listUsers({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
      ensureNoError(result);
      ensureHasData(result.data);
      return result.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage): string | null =>
      (direction === "forward"
        ? lastPage.links.next && cursorForSingleResource(lastPage.data?.at(-1))
        : lastPage.links.prev &&
          cursorForSingleResource(lastPage.data?.at(0))) ?? null,
  });

export const userQuery = (serverName: string, userId: string) =>
  queryOptions({
    queryKey: ["mas", "user", serverName, userId],
    queryFn: async ({ client, signal }): Promise<api.SingleResponseForUser> => {
      const result = await api.getUser({
        ...(await masBaseOptions(client, serverName, signal)),
        path: { id: userId },
      });
      ensureNoError(result, true);
      return result.data;
    },
  });

export const usersCountQuery = (
  serverName: string,
  parameters: UserListFilters = {},
) =>
  queryOptions({
    queryKey: ["mas", "users", serverName, parameters, "count"],
    queryFn: async ({ client, signal }): Promise<number> => {
      const query: api.ListUsersData["query"] = {
        count: "only",
      };

      if (parameters.admin !== undefined)
        query["filter[admin]"] = parameters.admin;
      if (parameters.guest !== undefined)
        query["filter[legacy-guest]"] = parameters.guest;
      if (parameters.status) query["filter[status]"] = parameters.status;
      if (parameters.search) query["filter[search]"] = parameters.search;

      const result = await api.listUsers({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
      ensureNoError(result);
      ensureHasCount(result.data);

      return result.data.meta.count;
    },
  });

export const createUser = async (
  queryClient: QueryClient,
  serverName: string,
  username: string,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUser> => {
  const result = await api.createUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    body: {
      username,
    },
  });
  ensureNoError(result);
  return result.data;
};

export const lockUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUser> => {
  const result = await api.lockUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
  ensureNoError(result);
  return result.data;
};

export const deactivateUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUser> => {
  const result = await api.deactivateUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
  ensureNoError(result);
  return result.data;
};

export const reactivateUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUser> => {
  const result = await api.reactivateUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
  ensureNoError(result);
  return result.data;
};

export const setUserPassword = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  password: string,
  skipPasswordCheck = false,
  signal?: AbortSignal,
): Promise<void> => {
  const result = await api.setUserPassword({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
    body: {
      password,
      skip_password_check: skipPasswordCheck,
    },
  });
  ensureNoError(result);
};

export const setUserCanRequestAdmin = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  canRequestAdmin: boolean,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUser> => {
  const result = await api.userSetAdmin({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
    body: {
      admin: canRequestAdmin,
    },
  });
  ensureNoError(result);
  return result.data;
};

export const userEmailsQuery = (serverName: string, userId: string) =>
  queryOptions({
    queryKey: ["mas", "user-emails", serverName, userId],
    queryFn: async ({ client, signal }) => {
      const result = await api.listUserEmails({
        ...(await masBaseOptions(client, serverName, signal)),
        query: {
          "filter[user]": userId,
          "page[first]": 10,
          count: "false",
        },
      });
      ensureNoError(result);
      ensureHasData(result.data);
      return result.data;
    },
  });

export const deleteUserEmail = async (
  queryClient: QueryClient,
  serverName: string,
  emailId: api.Ulid,
  signal?: AbortSignal,
): Promise<void> => {
  const result = await api.deleteUserEmail({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: emailId },
  });
  ensureNoError(result);
};

export const addUserEmail = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  email: string,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUserEmail> => {
  const result = await api.addUserEmail({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    body: {
      email,
      user_id: userId,
    },
  });
  ensureNoError(result);
  return result.data;
};

export const userUpstreamLinksQuery = (serverName: string, userId: string) =>
  queryOptions({
    queryKey: ["mas", "user-upstream-links", serverName, userId],
    queryFn: async ({ client, signal }) => {
      const result = await api.listUpstreamOAuthLinks({
        ...(await masBaseOptions(client, serverName, signal)),
        query: {
          "filter[user]": userId,
          "page[first]": 10,
          count: "false",
        },
      });
      ensureNoError(result);
      ensureHasData(result.data);
      return result.data;
    },
  });

export const upstreamProvidersQuery = (serverName: string) =>
  queryOptions({
    queryKey: ["mas", "upstream-providers", serverName],
    queryFn: async ({
      client,
      signal,
    }): Promise<api.SingleResourceForUpstreamOAuthProvider[]> => {
      const result = await api.listUpstreamOAuthProviders({
        ...(await masBaseOptions(client, serverName, signal)),
        query: {
          // Let's assume we're not going to have more than 1000 providers
          "page[first]": 1000,
          count: "false",
        },
      });
      ensureNoError(result);
      ensureHasData(result.data);
      return result.data.data;
    },
  });

export const deleteUpstreamOAuthLink = async (
  queryClient: QueryClient,
  serverName: string,
  linkId: api.Ulid,
  signal?: AbortSignal,
): Promise<void> => {
  const result = await api.deleteUpstreamOAuthLink({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: linkId },
  });
  ensureNoError(result);
};

export const addUpstreamOAuthLink = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  providerId: api.Ulid,
  subject: string,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUpstreamOAuthLink> => {
  const result = await api.addUpstreamOAuthLink({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    body: {
      user_id: userId,
      provider_id: providerId,
      subject,
    },
  });
  ensureNoError(result);
  return result.data;
};

export const unlockUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: api.Ulid,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUser> => {
  const result = await api.unlockUser({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: userId },
  });
  ensureNoError(result);
  return result.data;
};

export const registrationTokensInfiniteQuery = (
  serverName: string,
  parameters: TokenListParameters = {},
) =>
  infiniteQueryOptions({
    queryKey: ["mas", "registration-tokens", serverName, parameters],
    queryFn: async ({
      client,
      signal,
      pageParam,
    }): Promise<WithData<api.PaginatedResponseForUserRegistrationToken>> => {
      const query: api.ListUserRegistrationTokensData["query"] = {
        "page[first]": PAGE_SIZE,
        count: "false",
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

      const result = await api.listUserRegistrationTokens({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
      ensureNoError(result);
      ensureHasData(result.data);
      return result.data;
    },
    initialPageParam: null as api.Ulid | null,
    getNextPageParam: (lastPage): api.Ulid | null =>
      (lastPage.links.next && cursorForSingleResource(lastPage.data?.at(-1))) ??
      null,
  });

export const registrationTokensCountQuery = (
  serverName: string,
  parameters: TokenListParameters = {},
) =>
  queryOptions({
    queryKey: ["mas", "registration-tokens", serverName, parameters, "count"],
    queryFn: async ({ client, signal }): Promise<number> => {
      const query: api.ListUserRegistrationTokensData["query"] = {
        count: "only",
      };

      if (parameters.used !== undefined)
        query["filter[used]"] = parameters.used;
      if (parameters.revoked !== undefined)
        query["filter[revoked]"] = parameters.revoked;
      if (parameters.expired !== undefined)
        query["filter[expired]"] = parameters.expired;
      if (parameters.valid !== undefined)
        query["filter[valid]"] = parameters.valid;
      const result = await api.listUserRegistrationTokens({
        ...(await masBaseOptions(client, serverName, signal)),
        query,
      });
      ensureNoError(result);
      ensureHasCount(result.data);
      return result.data.meta.count;
    },
  });

export const registrationTokenQuery = (serverName: string, tokenId: string) =>
  queryOptions({
    queryKey: ["mas", "registration-token", serverName, tokenId],
    queryFn: async ({
      client,
      signal,
    }): Promise<api.SingleResponseForUserRegistrationToken> => {
      const result = await api.getUserRegistrationToken({
        ...(await masBaseOptions(client, serverName, signal)),
        path: { id: tokenId },
      });
      ensureNoError(result, true);
      return result.data;
    },
  });

export const createRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  parameters: CreateTokenParameters = {},
  signal?: AbortSignal,
): Promise<api.SingleResponseForUserRegistrationToken> => {
  const body: api.AddUserRegistrationTokenData["body"] = {};

  if (parameters.expires_at) body.expires_at = parameters.expires_at;
  if (parameters.usage_limit !== undefined)
    body.usage_limit = parameters.usage_limit;
  if (parameters.token) body.token = parameters.token;

  const result = await api.addUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    body,
  });
  ensureNoError(result);
  return result.data;
};

export const revokeRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: api.Ulid,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUserRegistrationToken> => {
  const result = await api.revokeUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: tokenId },
  });
  ensureNoError(result);
  return result.data;
};

export const unrevokeRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: api.Ulid,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUserRegistrationToken> => {
  const result = await api.unrevokeUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: tokenId },
  });
  ensureNoError(result);
  return result.data;
};

export const editRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: api.Ulid,
  parameters: EditTokenParameters,
  signal?: AbortSignal,
): Promise<api.SingleResponseForUserRegistrationToken> => {
  const body: api.UpdateUserRegistrationTokenData["body"] = {};

  if (parameters.expires_at !== undefined)
    body.expires_at = parameters.expires_at;
  if (parameters.usage_limit !== undefined)
    body.usage_limit = parameters.usage_limit;

  const result = await api.updateUserRegistrationToken({
    ...(await masBaseOptions(queryClient, serverName, signal)),
    path: { id: tokenId },
    body,
  });
  ensureNoError(result);
  return result.data;
};
