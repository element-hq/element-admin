/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Badge, CheckboxMenuItem, Text } from "@vector-im/compound-web";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { defineMessage, FormattedMessage } from "react-intl";
import * as v from "valibot";

import { wellKnownQuery } from "@/api/matrix";
import {
  type RoomListFilters,
  roomsInfiniteQuery,
  type Room,
} from "@/api/synapse";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import { RoomAvatar, RoomDisplayName } from "@/components/room-info";
import * as Table from "@/components/table";
import AppFooter from "@/ui/footer";
import AppNavigation from "@/ui/navigation";

const RoomSearchParameters = v.object({
  search_term: v.optional(v.string()),
  public_rooms: v.optional(v.boolean()),
  empty_rooms: v.optional(v.boolean()),
});

const titleMessage = defineMessage({
  id: "pages.rooms.title",
  defaultMessage: "Rooms",
  description: "The title of the rooms list page",
});

export const Route = createFileRoute("/_console/rooms")({
  validateSearch: RoomSearchParameters,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials, intl },
    deps: { search },
  }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;
    const parameters: RoomListFilters = {
      ...(search.search_term && { search_term: search.search_term }),
      ...(search.public_rooms !== undefined && {
        public_rooms: search.public_rooms,
      }),
      ...(search.empty_rooms !== undefined && {
        empty_rooms: search.empty_rooms,
      }),
    };

    await queryClient.ensureInfiniteQueryData(
      roomsInfiniteQuery(synapseRoot, parameters),
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

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Local state for search input
  const [localSearchTerm, setLocalSearchTerm] = useState(
    search.search_term || "",
  );

  // Debounced effect to sync local state to URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate({
        replace: true,
        search: (previous) => {
          if (!localSearchTerm.trim()) {
            const { search_term: _, ...rest } = previous;
            return rest;
          }

          return { ...previous, search_term: localSearchTerm.trim() };
        },
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [localSearchTerm, navigate]);

  const parameters: RoomListFilters = {
    ...(search.search_term && { search_term: search.search_term }),
    ...(search.public_rooms !== undefined && {
      public_rooms: search.public_rooms,
    }),
    ...(search.empty_rooms !== undefined && {
      empty_rooms: search.empty_rooms,
    }),
  };

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(roomsInfiniteQuery(synapseRoot, parameters));

  // Flatten the array of arrays from the useInfiniteQuery hook
  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.rooms) ?? [],
    [data],
  );

  const totalCount = data.pages[0]?.total_rooms ?? 0;
  const totalFetched = flatData.length;

  // Column definitions
  const columns = useMemo<ColumnDef<Room>[]>(
    () => [
      {
        id: "roomName",
        header: "Room",
        cell: ({ row }) => {
          const room = row.original;
          return (
            <Link
              to="/rooms/$roomId"
              params={{ roomId: room.room_id }}
              className="flex items-center gap-3"
            >
              <RoomAvatar
                roomId={room.room_id}
                roomName={room.name}
                roomType={room.room_type}
                members={room.joined_members}
                synapseRoot={synapseRoot}
                size="32px"
              />
              <Text size="md" weight="semibold" className="text-text-primary">
                <RoomDisplayName
                  roomId={room.room_id}
                  roomName={room.name}
                  roomType={room.room_type}
                  members={room.joined_members}
                  synapseRoot={synapseRoot}
                />
              </Text>
            </Link>
          );
        },
      },
      {
        id: "alias",
        header: "Alias",
        cell: ({ row }) => {
          const room = row.original;
          const displayAlias = room.canonical_alias || room.room_id;
          return (
            <Text size="sm" className="text-text-secondary">
              {displayAlias}
            </Text>
          );
        },
      },
      {
        id: "members",
        header: "Members",
        cell: ({ row }) => {
          const room = row.original;
          return <Text size="sm">{room.joined_members}</Text>;
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => {
          const room = row.original;
          let type = "Private";
          let kind: "grey" | "green" | "blue" = "grey";

          if (room.public) {
            type = "Public";
            kind = "green";
          } else if (room.join_rules === "restricted") {
            type = "Restricted";
            kind = "blue";
          } else if (room.join_rules === "invite") {
            type = "Private";
            kind = "grey";
          }

          return <Badge kind={kind}>{type}</Badge>;
        },
      },
    ],
    [synapseRoot],
  );

  const onSearchInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      setLocalSearchTerm(event.currentTarget.value);
    },
    [setLocalSearchTerm],
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
    <Navigation.Root>
      <AppNavigation />

      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
            <Page.Search
              placeholder="Search…"
              value={localSearchTerm}
              onInput={onSearchInput}
            />
          </Page.Header>

          <Table.Root>
            <Table.Header>
              <Table.Title>
                <FormattedMessage
                  id="pages.rooms.room_count"
                  defaultMessage="{COUNT, plural, zero {No rooms} one {# room} other {# rooms}}"
                  description="On the room list page, this heading shows the total number of rooms"
                  values={{ COUNT: totalCount }}
                />
              </Table.Title>

              <Table.Filter>
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.public_rooms === false
                          ? omit(search, ["public_rooms"])
                          : {
                              ...search,
                              public_rooms: false,
                            },
                    });
                  }}
                  label="Private rooms"
                  checked={search.public_rooms === false}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.public_rooms === true
                          ? omit(search, ["public_rooms"])
                          : {
                              ...search,
                              public_rooms: true,
                            },
                    });
                  }}
                  label="Public rooms"
                  checked={search.public_rooms === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.empty_rooms === false
                          ? omit(search, ["empty_rooms"])
                          : {
                              ...search,
                              empty_rooms: false,
                            },
                    });
                  }}
                  label="Non-empty rooms"
                  checked={search.empty_rooms === false}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.empty_rooms === true
                          ? omit(search, ["empty_rooms"])
                          : {
                              ...search,
                              empty_rooms: true,
                            },
                    });
                  }}
                  label="Empty rooms"
                  checked={search.empty_rooms === true}
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
                  Loading more rooms...
                </Text>
              </div>
            )}
          </Table.Root>
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>
    </Navigation.Root>
  );
}
