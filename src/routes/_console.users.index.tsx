import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, MatchRoute, createFileRoute } from "@tanstack/react-router";
import { Badge, Button, Text } from "@vector-im/compound-web";
import * as v from "valibot";

import { type UserListParams, usersQuery } from "@/api/mas";
import { ButtonLink, ChatFilterLink } from "@/components/link";
import { PAGE_SIZE } from "@/constants";

const UserSearchParams = v.object({
  before: v.optional(v.string()),
  after: v.optional(v.string()),
  first: v.optional(v.number()),
  last: v.optional(v.number()),
  admin: v.optional(v.boolean()),
  status: v.optional(v.picklist(["active", "locked", "deactivated"])),
});

export const Route = createFileRoute("/_console/users/")({
  validateSearch: UserSearchParams,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials },
    deps: { search },
  }) => {
    const params: UserListParams = {
      ...(search.before && { before: search.before }),
      ...(search.after && { after: search.after }),
      ...(search.first && { first: search.first }),
      ...(search.last && { last: search.last }),
      ...(search.admin !== undefined && { admin: search.admin }),
      ...(search.status && { status: search.status }),
    };

    await queryClient.ensureQueryData(
      usersQuery(queryClient, credentials.serverName, params),
    );
  },
  component: RouteComponent,
});

const resetPagination = ({
  before,
  after,
  first,
  last,
  ...search
}: v.InferOutput<typeof UserSearchParams>): v.InferOutput<
  typeof UserSearchParams
> => search;

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(obj).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const params: UserListParams = {
    ...(search.before && { before: search.before }),
    ...(search.after && { after: search.after }),
    ...(search.first && { first: search.first }),
    ...(search.last && { last: search.last }),
    ...(search.admin !== undefined && { admin: search.admin }),
    ...(search.status && { status: search.status }),
  };

  const { data } = useSuspenseQuery(
    usersQuery(queryClient, credentials.serverName, params),
  );

  const hasNext = !!data.links.next || search.before;
  const hasPrev = !!data.links.prev || search.after;
  const lastId = data.data[data.data.length - 1]?.id;
  const firstId = data.data[0]?.id;

  const nextPageParams = hasNext && {
    ...resetPagination(search),
    after: lastId || "",
    first: search.first || PAGE_SIZE,
  };

  const prevPageParams = hasPrev && {
    ...resetPagination(search),
    before: firstId || "",
    last: search.last || PAGE_SIZE,
  };

  const firstPageParams = hasPrev && {
    ...resetPagination(search),
    first: search.first || PAGE_SIZE,
  };

  const lastPageParams = hasNext && {
    ...resetPagination(search),
    last: search.last || PAGE_SIZE,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Text as="h1" size="lg" weight="semibold">
          Users
        </Text>
        <Text size="sm" className="text-text-secondary">
          Total: {data.meta.count}
        </Text>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <ChatFilterLink
          selected={search.admin === true}
          to={Route.fullPath}
          search={
            search.admin === true
              ? omit(resetPagination(search), ["admin"])
              : {
                  ...resetPagination(search),
                  admin: true,
                }
          }
        >
          Admin Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.status === "active"}
          to={Route.fullPath}
          search={
            search.status === "active"
              ? omit(resetPagination(search), ["status"])
              : {
                  ...resetPagination(search),
                  status: "active",
                }
          }
        >
          Active Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.status === "locked"}
          to={Route.fullPath}
          search={
            search.status === "locked"
              ? omit(resetPagination(search), ["status"])
              : {
                  ...resetPagination(search),
                  status: "locked",
                }
          }
        >
          Locked Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.status === "deactivated"}
          to={Route.fullPath}
          search={
            search.status === "deactivated"
              ? omit(resetPagination(search), ["status"])
              : {
                  ...resetPagination(search),
                  status: "deactivated",
                }
          }
        >
          Deactivated Only
        </ChatFilterLink>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-interactive-secondary">
          <thead className="bg-bg-canvas-disabled">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Created At
              </th>
            </tr>
          </thead>
          <tbody className="bg-bg-canvas-default divide-y divide-border-interactive-secondary">
            {data.data.map((user: (typeof data.data)[0]) => (
              <tr
                key={user.id}
                className="hover:bg-bg-action-secondary-hovered"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    to="/users/$userId"
                    params={{ userId: user.id }}
                    className="text-text-link-external hover:underline"
                  >
                    <Text weight="medium">{user.attributes.username}</Text>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge
                    kind={
                      user.attributes.deactivated_at
                        ? "red"
                        : user.attributes.locked_at
                          ? "grey"
                          : "blue"
                    }
                  >
                    {user.attributes.deactivated_at
                      ? "Deactivated"
                      : user.attributes.locked_at
                        ? "Locked"
                        : "Active"}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge kind={user.attributes.admin ? "green" : "grey"}>
                    {user.attributes.admin ? "Admin" : "User"}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                  {new Date(user.attributes.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <MatchRoute to={Route.path} pending>
          {(match) => (
            <>
              <div className="flex gap-2">
                {firstPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={firstPageParams}
                  >
                    First
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    First
                  </Button>
                )}

                {prevPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={prevPageParams}
                  >
                    Previous
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Previous
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {nextPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={nextPageParams}
                  >
                    Next
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Next
                  </Button>
                )}

                {lastPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={lastPageParams}
                  >
                    Last
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Last
                  </Button>
                )}
              </div>
            </>
          )}
        </MatchRoute>
      </div>
    </div>
  );
}
