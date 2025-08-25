/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  DownloadIcon,
  UserAddIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, Text } from "@vector-im/compound-web";
import { Fragment, useCallback, useEffect, useMemo } from "react";
import { FormattedMessage } from "react-intl";
import * as v from "valibot";

import { usersInfiniteQuery } from "@/api/mas";
import type { UserListFilters } from "@/api/mas";
import type { SingleResourceForUser } from "@/api/mas/api/types.gen";
import { ChatFilterLink } from "@/components/link";
import * as Page from "@/components/page";
import * as Table from "@/components/table";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

const UserSearchParameters = v.object({
  admin: v.optional(v.boolean()),
  status: v.optional(v.picklist(["active", "locked", "deactivated"])),
});

export const Route = createFileRoute("/_console/users/")({
  validateSearch: UserSearchParameters,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials, intl },
    deps: { search },
  }) => {
    const parameters: UserListFilters = {
      ...(search.admin !== undefined && { admin: search.admin }),
      ...(search.status && { status: search.status }),
    };

    await queryClient.ensureInfiniteQueryData(
      usersInfiniteQuery(credentials.serverName, parameters),
    );

    return {
      title: intl.formatMessage({
        id: "pages.users.title",
        defaultMessage: "Users",
        description: "The title of the users list page",
      }),
    };
  },

  head: ({ loaderData }) => ({
    meta: [loaderData ? { title: loaderData.title } : {}],
  }),

  component: RouteComponent,
});

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  object: T,
  keys: K[],
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(object).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();

  const parameters: UserListFilters = {
    ...(search.admin !== undefined && { admin: search.admin }),
    ...(search.status && { status: search.status }),
  };

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      usersInfiniteQuery(credentials.serverName, parameters),
    );

  // Flatten the array of arrays from the useInfiniteQuery hook
  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.data) ?? [],
    [data],
  );

  const totalCount = data.pages[0]?.meta.count ?? 0;
  const totalFetched = flatData.length;

  // Column definitions
  const columns = useMemo<ColumnDef<SingleResourceForUser>[]>(
    () => [
      {
        id: "matrixId",
        header: "Matrix ID",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-3 max-w-full w-full min-w-0">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <Link
                  to="/users/$userId"
                  params={{ userId: user.id }}
                  className="text-text-link-external hover:underline"
                >
                  <Text weight="semibold" size="md">
                    {user.attributes.username}
                  </Text>
                </Link>
                <Text size="sm" className="text-text-secondary">
                  Display name
                </Text>
              </div>
            </div>
          );
        },
      },
      {
        id: "accountType",
        header: "Account Type",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Badge kind={user.attributes.admin ? "green" : "grey"}>
              {user.attributes.admin ? "Admin" : "Local"}
            </Badge>
          );
        },
      },
      {
        id: "createdAt",
        header: "Created at",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {computeHumanReadableDateTimeStringFromUtc(
                user.attributes.created_at,
              )}
            </Text>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: flatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    debugTable: false,
  });

  const { rows } = table.getRowModel();

  // Called on scroll to fetch more data as the user scrolls
  const fetchMoreOnBottomReached = useCallback(() => {
    if (globalThis.window !== undefined) {
      const { scrollY, innerHeight } = globalThis.window;
      const { scrollHeight } = document.documentElement;

      // Once the user has scrolled within 1000px of the bottom, fetch more data
      if (
        scrollHeight - scrollY - innerHeight < 1000 &&
        !isFetching &&
        hasNextPage &&
        totalFetched < totalCount
      ) {
        fetchNextPage();
      }
    }
  }, [fetchNextPage, isFetching, hasNextPage, totalFetched, totalCount]);

  // Set up scroll listener
  useEffect(() => {
    const handleScroll = () => {
      fetchMoreOnBottomReached();
    };

    window.addEventListener("scroll", handleScroll);
    // Check on mount if we need to fetch more
    fetchMoreOnBottomReached();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [fetchMoreOnBottomReached]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 56, // 56px + 1px border
    overscan: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <Page.Header>
        <Page.Title>
          <FormattedMessage
            id="pages.users.title"
            defaultMessage="Users"
            description="The title of the users list page"
          />
        </Page.Title>
        <Page.Search placeholder="Non-functional search" />
        <Page.Controls>
          <Page.LinkButton to="/" variant="secondary" Icon={DownloadIcon}>
            <FormattedMessage
              id="action.export"
              defaultMessage="Export"
              description="The label for the export action/button"
            />
          </Page.LinkButton>
          <Page.LinkButton to="/" variant="primary" Icon={UserAddIcon}>
            <FormattedMessage
              id="action.add"
              defaultMessage="Add"
              description="The label for the add action/button"
            />
          </Page.LinkButton>
        </Page.Controls>
      </Page.Header>

      {/* Filters */}
      <div className="flex gap-4">
        <ChatFilterLink
          selected={search.admin === true}
          to={Route.fullPath}
          search={
            search.admin === true
              ? omit(search, ["admin"])
              : {
                  ...search,
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
              ? omit(search, ["status"])
              : {
                  ...search,
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
              ? omit(search, ["status"])
              : {
                  ...search,
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
              ? omit(search, ["status"])
              : {
                  ...search,
                  status: "deactivated",
                }
          }
        >
          Deactivated Only
        </ChatFilterLink>
      </div>

      <Table.Root>
        <Table.Header>
          <Table.Title>
            <FormattedMessage
              id="pages.users.user_count"
              defaultMessage="{COUNT, plural, zero {No users} one {# user} other {# users}}"
              description="On the user list page, this heading shows the total number of users"
              values={{ COUNT: totalCount }}
            />
          </Table.Title>
        </Table.Header>

        <Table.List
          style={{
            // 40px is the height of the table header
            height: `${rowVirtualizer.getTotalSize() + 40}px`,
          }}
        >
          <Table.ListHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.ListHeaderCell key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </Table.ListHeaderCell>
                ))}
              </Fragment>
            ))}
          </Table.ListHeader>

          <Table.ListBody>
            {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
              const row = rows[virtualRow.index];
              if (!row)
                throw new Error("got a virtual row for a non-existing row");

              return (
                <Table.ListRow
                  key={row.id}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${
                      virtualRow.start - index * virtualRow.size
                    }px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Table.ListCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.ListCell>
                  ))}
                </Table.ListRow>
              );
            })}
          </Table.ListBody>
        </Table.List>

        {/* Loading indicator */}
        {isFetching && (
          <div className="flex justify-center py-4">
            <Text size="sm" className="text-text-secondary">
              Loading more users...
            </Text>
          </div>
        )}
      </Table.Root>
    </div>
  );
}
