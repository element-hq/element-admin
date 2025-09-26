// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  retainSearchParams,
} from "@tanstack/react-router";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, CheckboxMenuItem, Text } from "@vector-im/compound-web";
import { useCallback, useMemo, useRef } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import { wellKnownQuery } from "@/api/matrix";
import {
  type RoomListFilters,
  roomsInfiniteQuery,
  type Room,
} from "@/api/synapse";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import { RoomAvatar, RoomDisplayName } from "@/components/room-info";
import * as Table from "@/components/table";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import AppNavigation from "@/ui/navigation";
import { useFilters } from "@/utils/filters";

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
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: RoomSearchParameters,
  search: {
    middlewares: [retainSearchParams(true)],
  },

  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials },
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
  },

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

const filtersDefinition = [
  {
    key: "public_rooms",
    value: false,
    message: defineMessage({
      id: "pages.rooms.filters.private_rooms",
      defaultMessage: "Private rooms",
      description: "Filter option for private rooms",
    }),
  },
  {
    key: "public_rooms",
    value: true,
    message: defineMessage({
      id: "pages.rooms.filters.public_rooms",
      defaultMessage: "Public rooms",
      description: "Filter option for public rooms",
    }),
  },
  {
    key: "empty_rooms",
    value: false,
    message: defineMessage({
      id: "pages.rooms.filters.non_empty_rooms",
      defaultMessage: "Non-empty rooms",
      description: "Filter option for non-empty rooms",
    }),
  },
  {
    key: "empty_rooms",
    value: true,
    message: defineMessage({
      id: "pages.rooms.filters.empty_rooms",
      defaultMessage: "Empty rooms",
      description: "Filter option for empty rooms",
    }),
  },
] as const;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const intl = useIntl();

  const debouncedSearch = useAsyncDebouncedCallback(
    async (term: string) => {
      await navigate({
        replace: true,
        search: (previous) => {
          if (!term.trim()) {
            const { search_term: _, ...rest } = previous;
            return rest;
          }

          return { ...previous, search_term: term.trim() };
        },
      });
    },
    {
      wait: 400,
    },
  );

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

  const filters = useFilters(search, filtersDefinition);

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
              resetScroll={false}
              className="flex items-center gap-3"
            >
              <RoomAvatar
                roomId={room.room_id}
                roomName={room.name}
                roomCanonicalAlias={room.canonical_alias}
                roomType={room.room_type}
                members={room.joined_members}
                synapseRoot={synapseRoot}
                size="32px"
              />
              <Text size="md" weight="semibold" className="text-text-primary">
                <RoomDisplayName
                  roomId={room.room_id}
                  roomName={room.name}
                  roomCanonicalAlias={room.canonical_alias}
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
      debouncedSearch(event.currentTarget.value);
    },
    [debouncedSearch],
  );

  const table = useReactTable({
    data: flatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  // This prevents the compiler from optimizing the table
  // See https://github.com/TanStack/table/issues/5567
  const tableRef = useRef(table);

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
              defaultValue={search.search_term}
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

              <Table.FilterMenu>
                {filters.all.map((filter) => (
                  <CheckboxMenuItem
                    key={filter.key}
                    onSelect={(event) => {
                      event.preventDefault();
                      navigate({ search: filter.toggledState });
                    }}
                    label={intl.formatMessage(filter.message)}
                    checked={filter.enabled}
                  />
                ))}
              </Table.FilterMenu>

              {filters.active.length > 0 && (
                <Table.ActiveFilterList>
                  {filters.active.map((filter) => (
                    <Table.ActiveFilter key={filter.key}>
                      <FormattedMessage {...filter.message} />
                      <Table.RemoveFilterLink
                        from={Route.fullPath}
                        replace={true}
                        search={filter.toggledState}
                      />
                    </Table.ActiveFilter>
                  ))}

                  <TextLink
                    from={Route.fullPath}
                    replace={true}
                    search={filters.clearedState}
                    size="small"
                  >
                    <FormattedMessage {...messages.actionClear} />
                  </TextLink>
                </Table.ActiveFilterList>
              )}
            </Table.Header>

            <Table.VirtualizedList
              table={tableRef.current}
              canFetchNextPage={hasNextPage && !isFetching}
              fetchNextPage={fetchNextPage}
            />

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
