import { type QueryClient, queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

import { authMetadataQuery } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { accessToken } from "@/stores/auth";

const User = v.object({
  username: v.string(),
  created_at: v.string(),
  locked_at: v.nullable(v.string()),
  deactivated_at: v.nullable(v.string()),
  admin: v.boolean(),
});

const SingleResourceForUser = v.object({
  type: v.string(),
  id: v.string(),
  attributes: User,
  links: v.object({
    self: v.string(),
  }),
});

const PaginationMeta = v.object({
  count: v.number(),
});

const PaginationLinks = v.object({
  self: v.string(),
  first: v.string(),
  last: v.string(),
  next: v.optional(v.string()),
  prev: v.optional(v.string()),
});

const PaginatedResponseForUser = v.pipe(
  v.object({
    meta: PaginationMeta,
    data: v.array(v.unknown()),
    links: PaginationLinks,
  }),
  v.transform((value) => {
    const validatedData = value.data.map((item) => {
      return v.parse(SingleResourceForUser, item);
    });

    return {
      ...value,
      data: validatedData,
    };
  }),
);

const SingleResponseForUser = v.object({
  data: SingleResourceForUser,
  links: v.object({
    self: v.string(),
  }),
});

const UserEmail = v.object({
  created_at: v.string(),
  user_id: v.string(),
  email: v.string(),
});

const SingleResourceForUserEmail = v.object({
  type: v.string(),
  id: v.string(),
  attributes: UserEmail,
  links: v.object({
    self: v.string(),
  }),
});

const PaginatedResponseForUserEmail = v.pipe(
  v.object({
    meta: PaginationMeta,
    data: v.array(v.unknown()),
    links: PaginationLinks,
  }),
  v.transform((value) => {
    const validatedData = value.data.map((item) => {
      return v.parse(SingleResourceForUserEmail, item);
    });

    return {
      ...value,
      data: validatedData,
    };
  }),
);

const RegistrationToken = v.object({
  token: v.string(),
  valid: v.boolean(),
  usage_limit: v.nullable(v.number()),
  times_used: v.number(),
  created_at: v.string(),
  last_used_at: v.nullable(v.string()),
  expires_at: v.nullable(v.string()),
  revoked_at: v.nullable(v.string()),
});

const SingleResourceForRegistrationToken = v.object({
  type: v.string(),
  id: v.string(),
  attributes: RegistrationToken,
  links: v.object({
    self: v.string(),
  }),
});

const PaginatedResponseForRegistrationToken = v.pipe(
  v.object({
    meta: PaginationMeta,
    data: v.array(v.unknown()),
    links: PaginationLinks,
  }),
  v.transform((value) => {
    const validatedData = value.data.map((item) => {
      return v.parse(SingleResourceForRegistrationToken, item);
    });

    return {
      ...value,
      data: validatedData,
    };
  }),
);

const SingleResponseForRegistrationToken = v.object({
  data: SingleResourceForRegistrationToken,
  links: v.object({
    self: v.string(),
  }),
});

export type User = v.InferOutput<typeof User>;
export type UserEmail = v.InferOutput<typeof UserEmail>;
export type PaginatedUsers = v.InferOutput<typeof PaginatedResponseForUser>;
export type SingleUserResponse = v.InferOutput<typeof SingleResponseForUser>;
export type PaginatedUserEmails = v.InferOutput<
  typeof PaginatedResponseForUserEmail
>;
export type RegistrationToken = v.InferOutput<typeof RegistrationToken>;
export type PaginatedRegistrationTokens = v.InferOutput<typeof PaginatedResponseForRegistrationToken>;
export type SingleRegistrationTokenResponse = v.InferOutput<typeof SingleResponseForRegistrationToken>;

export type UserListParams = {
  before?: string;
  after?: string;
  first?: number;
  last?: number;
  admin?: boolean;
  status?: "active" | "locked" | "deactivated";
};

export type TokenListParams = {
  before?: string;
  after?: string;
  first?: number;
  last?: number;
  used?: boolean;
  revoked?: boolean;
  expired?: boolean;
  valid?: boolean;
};

export type CreateTokenParams = {
  token?: string; // Custom token string (optional)
  usage_limit?: number;
  expires_at?: string; // ISO date string
};

export type EditTokenParams = {
  usage_limit?: number | null;
  expires_at?: string | null; // ISO date string
};

export const usersQuery = (
  queryClient: QueryClient,
  serverName: string,
  params: UserListParams = {},
) =>
  queryOptions({
    queryKey: ["mas", "users", serverName, params],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const wellKnown = await queryClient.ensureQueryData(
        wellKnownQuery(serverName),
      );

      const authMetadata = await queryClient.ensureQueryData(
        authMetadataQuery(wellKnown["m.homeserver"].base_url),
      );

      const masApiRoot = authMetadata.issuer;
      const url = new URL("/api/admin/v1/users", masApiRoot);

      // Add pagination parameters
      if (params.before) url.searchParams.set("page[before]", params.before);
      if (params.after) url.searchParams.set("page[after]", params.after);
      if (params.first)
        url.searchParams.set("page[first]", String(params.first));
      if (params.last) url.searchParams.set("page[last]", String(params.last));

      // Add filter parameters
      if (params.admin !== undefined)
        url.searchParams.set("filter[admin]", String(params.admin));
      if (params.status) url.searchParams.set("filter[status]", params.status);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const users = v.parse(PaginatedResponseForUser, await response.json());

      return users;
    },
  });

export const userQuery = (
  queryClient: QueryClient,
  serverName: string,
  userId: string,
) =>
  queryOptions({
    queryKey: ["mas", "user", serverName, userId],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const wellKnown = await queryClient.ensureQueryData(
        wellKnownQuery(serverName),
      );

      const authMetadata = await queryClient.ensureQueryData(
        authMetadataQuery(wellKnown["m.homeserver"].base_url),
      );

      const masApiRoot = authMetadata.issuer;
      const url = new URL(`/api/admin/v1/users/${userId}`, masApiRoot);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }

      const user = v.parse(SingleResponseForUser, await response.json());

      return user;
    },
  });

export const lockUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: string,
  signal?: AbortSignal,
) => {
  const token = await accessToken(queryClient, signal);
  if (!token) {
    throw new Error("No access token");
  }

  const wellKnown = await queryClient.ensureQueryData(
    wellKnownQuery(serverName),
  );

  const authMetadata = await queryClient.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  const masApiRoot = authMetadata.issuer;
  const url = new URL(`/api/admin/v1/users/${userId}/lock`, masApiRoot);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    ...(signal && { signal }),
  });

  if (!response.ok) {
    throw new Error("Failed to lock user");
  }

  const user = v.parse(SingleResponseForUser, await response.json());

  return user;
};

export const deactivateUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: string,
  signal?: AbortSignal,
) => {
  const token = await accessToken(queryClient, signal);
  if (!token) {
    throw new Error("No access token");
  }

  const wellKnown = await queryClient.ensureQueryData(
    wellKnownQuery(serverName),
  );

  const authMetadata = await queryClient.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  const masApiRoot = authMetadata.issuer;
  const url = new URL(`/api/admin/v1/users/${userId}/deactivate`, masApiRoot);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    ...(signal && { signal }),
  });

  if (!response.ok) {
    throw new Error("Failed to deactivate user");
  }

  const user = v.parse(SingleResponseForUser, await response.json());

  return user;
};

export const userEmailsQuery = (
  queryClient: QueryClient,
  serverName: string,
  userId: string,
) =>
  queryOptions({
    queryKey: ["mas", "user-emails", serverName, userId],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const wellKnown = await queryClient.ensureQueryData(
        wellKnownQuery(serverName),
      );

      const authMetadata = await queryClient.ensureQueryData(
        authMetadataQuery(wellKnown["m.homeserver"].base_url),
      );

      const masApiRoot = authMetadata.issuer;
      const url = new URL("/api/admin/v1/user-emails", masApiRoot);

      // Filter by user and limit to first 10
      url.searchParams.set("filter[user]", userId);
      url.searchParams.set("page[first]", "10");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user emails");
      }

      const userEmails = v.parse(
        PaginatedResponseForUserEmail,
        await response.json(),
      );

      return userEmails;
    },
  });

export const unlockUser = async (
  queryClient: QueryClient,
  serverName: string,
  userId: string,
  signal?: AbortSignal,
) => {
  const token = await accessToken(queryClient, signal);
  if (!token) {
    throw new Error("No access token");
  }

  const wellKnown = await queryClient.ensureQueryData(
    wellKnownQuery(serverName),
  );

  const authMetadata = await queryClient.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  const masApiRoot = authMetadata.issuer;
  const url = new URL(`/api/admin/v1/users/${userId}/unlock`, masApiRoot);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    ...(signal && { signal }),
  });

  if (!response.ok) {
    throw new Error("Failed to unlock user");
  }

  const user = v.parse(SingleResponseForUser, await response.json());

  return user;
};

export const registrationTokensQuery = (
  queryClient: QueryClient,
  serverName: string,
  params: TokenListParams = {},
) =>
  queryOptions({
    queryKey: ["mas", "registration-tokens", serverName, params],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const wellKnown = await queryClient.ensureQueryData(
        wellKnownQuery(serverName),
      );

      const authMetadata = await queryClient.ensureQueryData(
        authMetadataQuery(wellKnown["m.homeserver"].base_url),
      );

      const masApiRoot = authMetadata.issuer;
      const url = new URL("/api/admin/v1/user-registration-tokens", masApiRoot);

      // Add pagination parameters
      if (params.before) url.searchParams.set("page[before]", params.before);
      if (params.after) url.searchParams.set("page[after]", params.after);
      if (params.first)
        url.searchParams.set("page[first]", String(params.first));
      if (params.last) url.searchParams.set("page[last]", String(params.last));
      
      // Add filter parameters
      if (params.used !== undefined)
        url.searchParams.set("filter[used]", String(params.used));
      if (params.revoked !== undefined)
        url.searchParams.set("filter[revoked]", String(params.revoked));
      if (params.expired !== undefined)
        url.searchParams.set("filter[expired]", String(params.expired));
      if (params.valid !== undefined)
        url.searchParams.set("filter[valid]", String(params.valid));

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch registration tokens");
      }

      const tokens = v.parse(
        PaginatedResponseForRegistrationToken,
        await response.json(),
      );

      return tokens;
    },
  });

export const registrationTokenQuery = (
  queryClient: QueryClient,
  serverName: string,
  tokenId: string,
) =>
  queryOptions({
    queryKey: ["mas", "registration-token", serverName, tokenId],
    queryFn: async ({ signal }) => {
      const accessTokenValue = await accessToken(queryClient, signal);
      if (!accessTokenValue) {
        throw new Error("No access token");
      }

      const wellKnown = await queryClient.ensureQueryData(
        wellKnownQuery(serverName),
      );

      const authMetadata = await queryClient.ensureQueryData(
        authMetadataQuery(wellKnown["m.homeserver"].base_url),
      );

      const masApiRoot = authMetadata.issuer;
      const url = new URL(`/api/admin/v1/user-registration-tokens/${tokenId}`, masApiRoot);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessTokenValue}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch registration token");
      }

      const tokenData = v.parse(
        SingleResponseForRegistrationToken,
        await response.json(),
      );

      return tokenData;
    },
  });

export const createRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  params: CreateTokenParams = {},
  signal?: AbortSignal,
) => {
  const accessTokenValue = await accessToken(queryClient, signal);
  if (!accessTokenValue) {
    throw new Error("No access token");
  }

  const wellKnown = await queryClient.ensureQueryData(
    wellKnownQuery(serverName),
  );

  const authMetadata = await queryClient.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  const masApiRoot = authMetadata.issuer;
  const url = new URL("/api/admin/v1/user-registration-tokens", masApiRoot);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessTokenValue}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(params.expires_at && { expires_at: params.expires_at }),
      ...(params.usage_limit !== undefined && { usage_limit: params.usage_limit }),
      ...(params.token && { token: params.token }),
    }),
    ...(signal && { signal }),
  });

  if (!response.ok) {
    throw new Error("Failed to create registration token");
  }

  const tokenData = v.parse(
    SingleResponseForRegistrationToken,
    await response.json(),
  );

  return tokenData;
};

export const revokeRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: string,
  signal?: AbortSignal,
) => {
  const accessTokenValue = await accessToken(queryClient, signal);
  if (!accessTokenValue) {
    throw new Error("No access token");
  }

  const wellKnown = await queryClient.ensureQueryData(
    wellKnownQuery(serverName),
  );

  const authMetadata = await queryClient.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  const masApiRoot = authMetadata.issuer;
  const url = new URL(`/api/admin/v1/user-registration-tokens/${tokenId}/revoke`, masApiRoot);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessTokenValue}`,
    },
    ...(signal && { signal }),
  });

  if (!response.ok) {
    throw new Error("Failed to revoke registration token");
  }

  const tokenData = v.parse(
    SingleResponseForRegistrationToken,
    await response.json(),
  );

  return tokenData;
};

export const unrevokeRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: string,
  signal?: AbortSignal,
) => {
  const accessTokenValue = await accessToken(queryClient, signal);
  if (!accessTokenValue) {
    throw new Error("No access token");
  }

  const wellKnown = await queryClient.ensureQueryData(
    wellKnownQuery(serverName),
  );

  const authMetadata = await queryClient.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  const masApiRoot = authMetadata.issuer;
  const url = new URL(`/api/admin/v1/user-registration-tokens/${tokenId}/unrevoke`, masApiRoot);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessTokenValue}`,
    },
    ...(signal && { signal }),
  });

  if (!response.ok) {
    throw new Error("Failed to unrevoke registration token");
  }

  const tokenData = v.parse(
    SingleResponseForRegistrationToken,
    await response.json(),
  );

  return tokenData;
};

export const editRegistrationToken = async (
  queryClient: QueryClient,
  serverName: string,
  tokenId: string,
  params: EditTokenParams,
  signal?: AbortSignal,
) => {
  const accessTokenValue = await accessToken(queryClient, signal);
  if (!accessTokenValue) {
    throw new Error("No access token");
  }

  const wellKnown = await queryClient.ensureQueryData(
    wellKnownQuery(serverName),
  );

  const authMetadata = await queryClient.ensureQueryData(
    authMetadataQuery(wellKnown["m.homeserver"].base_url),
  );

  const masApiRoot = authMetadata.issuer;
  const url = new URL(`/api/admin/v1/user-registration-tokens/${tokenId}`, masApiRoot);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessTokenValue}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(params.expires_at !== undefined && { expires_at: params.expires_at }),
      ...(params.usage_limit !== undefined && { usage_limit: params.usage_limit }),
    }),
    ...(signal && { signal }),
  });

  if (!response.ok) {
    throw new Error("Failed to edit registration token");
  }

  const tokenData = v.parse(
    SingleResponseForRegistrationToken,
    await response.json(),
  );

  return tokenData;
};
