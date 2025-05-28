import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, ChatFilter, Text } from "@vector-im/compound-web";
import { type } from "arktype";

import { type UserListParams, usersQuery } from "@/api/mas";
import { ButtonLink } from "@/components/link";
import { PAGE_SIZE } from "@/constants";

const UserSearchParams = type({
  "before?": "string",
  "after?": "string",
  "first?": "number",
  "last?": "number",
  "admin?": "boolean",
  "status?": "'active' | 'locked'",
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
}: typeof UserSearchParams.infer): typeof UserSearchParams.infer => search;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
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
        <Text size="sm" className="text-gray-600">
          Total: {data.meta.count}
        </Text>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <ChatFilter
          selected={search.admin === true}
          onClick={() => {
            navigate({
              search: (prev) => {
                const { admin, ...newParams } = resetPagination(prev);
                if (search.admin) return newParams;
                return { ...newParams, admin: true };
              },
            });
          }}
        >
          Admin Only
        </ChatFilter>
        <ChatFilter
          selected={search.status === "active"}
          onClick={() => {
            navigate({
              search: (prev) => {
                const { status, ...newParams } = resetPagination(prev);
                if (search.status === "active") return newParams;
                return { ...newParams, status: "active" };
              },
            });
          }}
        >
          Active Only
        </ChatFilter>
        <ChatFilter
          selected={search.status === "locked"}
          onClick={() => {
            navigate({
              search: (prev) => {
                const { status, ...newParams } = resetPagination(prev);
                if (search.status === "locked") return newParams;
                return { ...newParams, status: "locked" };
              },
            });
          }}
        >
          Locked Only
        </ChatFilter>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.data.map((user: (typeof data.data)[0]) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link 
                    to="/users/$userId" 
                    params={{ userId: user.id }}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Text weight="medium">{user.attributes.username}</Text>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.attributes.locked_at
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {user.attributes.locked_at ? "Locked" : "Active"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.attributes.admin
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {user.attributes.admin ? "Admin" : "User"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.attributes.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {firstPageParams ? (
            <ButtonLink
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
      </div>
    </div>
  );
}
