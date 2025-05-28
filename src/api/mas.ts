import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { type } from "arktype";

import { authMetadataQuery } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { accessToken } from "@/stores/auth";

const User = type({
  username: "string",
  created_at: "string",
  locked_at: "string | null",
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

export type User = typeof User.infer;
export type PaginatedUsers = typeof PaginatedResponseForUser.infer;

export type UserListParams = {
  before?: string;
  after?: string;
  first?: number;
  last?: number;
  admin?: boolean;
  status?: "active" | "locked";
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
