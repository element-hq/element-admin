import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { type } from "arktype";

import { authMetadataQuery } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { accessToken } from "@/stores/auth";

const User = type({
  username: "string",
  created_at: "string",
  locked_at: "string | null",
  deactivated_at: "string | null",
  admin: "boolean",
});

const SingleResourceForUser = type({
  type: "string",
  id: "string",
  attributes: User,
  links: {
    self: "string",
  },
});

const PaginationMeta = type({
  count: "number",
});

const PaginationLinks = type({
  self: "string",
  first: "string",
  last: "string",
  "next?": "string",
  "prev?": "string",
});

const PaginatedResponseForUser = type({
  meta: PaginationMeta,
  data: "unknown[]",
  links: PaginationLinks,
}).pipe((value) => {
  const validatedData = (value.data as unknown[]).map((item) => {
    const result = SingleResourceForUser(item);
    if (result instanceof type.errors) {
      throw new Error(result.summary);
    }
    return result;
  });

  return {
    ...value,
    data: validatedData,
  };
});

const SingleResponseForUser = type({
  data: SingleResourceForUser,
  links: {
    self: "string",
  },
});

const UserEmail = type({
  created_at: "string",
  user_id: "string",
  email: "string",
});

const SingleResourceForUserEmail = type({
  type: "string",
  id: "string",
  attributes: UserEmail,
  links: {
    self: "string",
  },
});

const PaginatedResponseForUserEmail = type({
  meta: PaginationMeta,
  data: "unknown[]",
  links: PaginationLinks,
}).pipe((value) => {
  const validatedData = (value.data as unknown[]).map((item) => {
    const result = SingleResourceForUserEmail(item);
    if (result instanceof type.errors) {
      throw new Error(result.summary);
    }
    return result;
  });

  return {
    ...value,
    data: validatedData,
  };
});

export type User = typeof User.infer;
export type UserEmail = typeof UserEmail.infer;
export type PaginatedUsers = typeof PaginatedResponseForUser.infer;
export type SingleUserResponse = typeof SingleResponseForUser.infer;
export type PaginatedUserEmails = typeof PaginatedResponseForUserEmail.infer;

export type UserListParams = {
  before?: string;
  after?: string;
  first?: number;
  last?: number;
  admin?: boolean;
  status?: "active" | "locked" | "deactivated";
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

      const users = PaginatedResponseForUser(await response.json());
      if (users instanceof type.errors) {
        throw new Error(users.summary);
      }

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

      const user = SingleResponseForUser(await response.json());
      if (user instanceof type.errors) {
        throw new Error(user.summary);
      }

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

  const user = SingleResponseForUser(await response.json());
  if (user instanceof type.errors) {
    throw new Error(user.summary);
  }

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

  const user = SingleResponseForUser(await response.json());
  if (user instanceof type.errors) {
    throw new Error(user.summary);
  }

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

      const userEmails = PaginatedResponseForUserEmail(await response.json());
      if (userEmails instanceof type.errors) {
        throw new Error(userEmails.summary);
      }

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

  const user = SingleResponseForUser(await response.json());
  if (user instanceof type.errors) {
    throw new Error(user.summary);
  }

  return user;
};
