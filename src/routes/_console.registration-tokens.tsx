/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { PlusIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, CheckboxMenuItem, Text } from "@vector-im/compound-web";
import { Fragment, useCallback, useEffect, useMemo } from "react";
import { defineMessage, FormattedMessage } from "react-intl";
import * as v from "valibot";

import { registrationTokensInfiniteQuery } from "@/api/mas";
import type { TokenListParameters } from "@/api/mas";
import type { SingleResourceForUserRegistrationToken } from "@/api/mas/api/types.gen";
import { CopyToClipboard } from "@/components/copy";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as Table from "@/components/table";
import AppFooter from "@/ui/footer";
import AppNavigation from "@/ui/navigation";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

const TokenSearchParameters = v.object({
  used: v.optional(v.boolean()),
  revoked: v.optional(v.boolean()),
  expired: v.optional(v.boolean()),
  valid: v.optional(v.boolean()),
});

const titleMessage = defineMessage({
  id: "pages.registration_tokens.title",
  defaultMessage: "Registration tokens",
  description: "The title of the registration tokens list page",
});

export const Route = createFileRoute("/_console/registration-tokens")({
  validateSearch: TokenSearchParameters,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials, intl },
    deps: { search },
  }) => {
    const parameters: Omit<
      TokenListParameters,
      "after" | "before" | "first" | "last"
    > = {
      ...(search.used !== undefined && { used: search.used }),
      ...(search.revoked !== undefined && { revoked: search.revoked }),
      ...(search.expired !== undefined && { expired: search.expired }),
      ...(search.valid !== undefined && { valid: search.valid }),
    };

    await queryClient.ensureInfiniteQueryData(
      registrationTokensInfiniteQuery(credentials.serverName, parameters),
    );

    return {
      title: intl.formatMessage(titleMessage),
    };
  },
  head: ({ loaderData }) => ({
    meta: [loaderData ? { title: loaderData.title } : {}],
  }),

  pendingComponent: () => (
    <Navigation.Root>
      <AppNavigation />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
            <Page.Controls>
              <Page.LinkButton
                to="/registration-tokens/add"
                variant="secondary"
                Icon={PlusIcon}
              >
                <FormattedMessage
                  id="action.add"
                  defaultMessage="Add"
                  description="The label for the add action/button"
                />
              </Page.LinkButton>
            </Page.Controls>
          </Page.Header>

          <Placeholder.LoadingTable />
        </Navigation.Main>
        <AppFooter />
      </Navigation.Content>

      <Outlet />
    </Navigation.Root>
  ),

  component: RouteComponent,
});

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  object: T,
  keys: K[],
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(object).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;

function getTokenStatus(token: {
  valid: boolean;
  expires_at?: string | null;
  usage_limit?: number | null;
  times_used: number;
  revoked_at?: string | null;
}) {
  if (!token.valid) {
    if (token.revoked_at) {
      return "Revoked";
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return "Expired";
    }
    if (
      token.usage_limit !== null &&
      token.usage_limit !== undefined &&
      token.times_used >= token.usage_limit
    ) {
      return "Used Up";
    }
    return "Invalid";
  }
  return "Active";
}

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const parameters: Omit<
    TokenListParameters,
    "after" | "before" | "first" | "last"
  > = {
    ...(search.used !== undefined && { used: search.used }),
    ...(search.revoked !== undefined && { revoked: search.revoked }),
    ...(search.expired !== undefined && { expired: search.expired }),
    ...(search.valid !== undefined && { valid: search.valid }),
  };

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      registrationTokensInfiniteQuery(credentials.serverName, parameters),
    );

  // Flatten the array of arrays from the useInfiniteQuery hook
  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.data) ?? [],
    [data],
  );

  const totalCount = data.pages[0]?.meta.count ?? 0;
  const totalFetched = flatData.length;

  // Column definitions
  const columns = useMemo<ColumnDef<SingleResourceForUserRegistrationToken>[]>(
    () => [
      {
        id: "token",
        header: "Token",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <div className="flex items-center gap-2">
              <Link
                to="/registration-tokens/$tokenId"
                params={{ tokenId: token.id }}
                className="text-text-link-external hover:underline"
              >
                <Text weight="medium">{token.attributes.token}</Text>
              </Link>
              <CopyToClipboard value={token.attributes.token} />
            </div>
          );
        },
      },
      {
        id: "createdAt",
        header: "Created At",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {computeHumanReadableDateTimeStringFromUtc(
                token.attributes.created_at,
              )}
            </Text>
          );
        },
      },
      {
        id: "validUntil",
        header: "Valid Until",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.expires_at
                ? computeHumanReadableDateTimeStringFromUtc(
                    token.attributes.expires_at,
                  )
                : "Never expires"}
            </Text>
          );
        },
      },
      {
        id: "uses",
        header: "Uses",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.times_used} /{" "}
              {token.attributes.usage_limit || "∞"}
            </Text>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Badge kind={token.attributes.valid ? "green" : "red"}>
              {getTokenStatus(token.attributes)}
            </Badge>
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
    estimateSize: () => 56,
    overscan: 20,
  });

  return (
    <Navigation.Root>
      <AppNavigation />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
            <Page.Controls>
              <Page.LinkButton
                to="/registration-tokens/add"
                variant="secondary"
                Icon={PlusIcon}
              >
                <FormattedMessage
                  id="action.add"
                  defaultMessage="Add"
                  description="The label for the add action/button"
                />
              </Page.LinkButton>
            </Page.Controls>
          </Page.Header>

          <Table.Root>
            <Table.Header>
              <Table.Title>
                <FormattedMessage
                  id="pages.registration_tokens.token_count"
                  defaultMessage="{COUNT, plural, zero {No tokens} one {# token} other {# tokens}}"
                  description="On the registration tokens list page, this heading shows the total number of tokens"
                  values={{ COUNT: totalCount }}
                />
              </Table.Title>

              <Table.Filter>
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.valid === true
                          ? omit(search, ["valid"])
                          : {
                              ...search,
                              valid: true,
                            },
                    });
                  }}
                  label="Active Only"
                  checked={search.valid === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.used === true
                          ? omit(search, ["used"])
                          : {
                              ...search,
                              used: true,
                            },
                    });
                  }}
                  label="Used Only"
                  checked={search.used === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.revoked === true
                          ? omit(search, ["revoked"])
                          : {
                              ...search,
                              revoked: true,
                            },
                    });
                  }}
                  label="Revoked Only"
                  checked={search.revoked === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.expired === true
                          ? omit(search, ["expired"])
                          : {
                              ...search,
                              expired: true,
                            },
                    });
                  }}
                  label="Expired Only"
                  checked={search.expired === true}
                />
              </Table.Filter>
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
                  Loading more tokens...
                </Text>
              </div>
            )}
          </Table.Root>
        </Navigation.Main>
        <AppFooter />
      </Navigation.Content>

      <Outlet />
    </Navigation.Root>
  );
}
