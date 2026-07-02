// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table-v9";
import { Badge, CheckboxMenuItem, Text } from "@vector-im/compound-web";
import { useCallback, useMemo } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import { wellKnownQuery } from "@/api/matrix";
import {
  type RoomListFilters,
  roomsInfiniteQuery,
  type Room,
} from "@/api/synapse";
import * as DataTable from "@/components/data-table";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import { RoomAvatar, RoomDisplayName } from "@/components/room-info";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import { useFilters } from "@/utils/filters";
import { useCurrentChildRoutePath } from "@/utils/routes";

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Room>();

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

const columnMessages = {
  room: defineMessage({
    id: "pages.rooms.columns.room",
    defaultMessage: "Room",
    description: "Column header for the room name in the rooms list table",
  }),
  alias: defineMessage({
    id: "pages.rooms.columns.alias",
    defaultMessage: "Alias",
    description: "Column header for the room alias in the rooms list table",
  }),
  members: defineMessage({
    id: "pages.rooms.columns.members",
    defaultMessage: "Members",
    description:
      "Column header for the number of members in the rooms list table",
  }),
  type: defineMessage({
    id: "pages.rooms.columns.type",
    defaultMessage: "Type",
    description: "Column header for the room type in the rooms list table",
  }),
};

const roomTypeMessages = {
  private: defineMessage({
    id: "pages.rooms.room_type.private",
    defaultMessage: "Private",
    description: "Badge label for a private room in the rooms list table",
  }),
  public: defineMessage({
    id: "pages.rooms.room_type.public",
    defaultMessage: "Public",
    description: "Badge label for a public room in the rooms list table",
  }),
  restricted: defineMessage({
    id: "pages.rooms.room_type.restricted",
    defaultMessage: "Restricted",
    description: "Badge label for a restricted room in the rooms list table",
  }),
};

export const Route = createFileRoute("/_console/rooms")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: RoomSearchParameters,

  loaderDeps: ({ search }) => ({
    parameters: {
      ...(search.search_term && { search_term: search.search_term }),
      ...(search.public_rooms !== undefined && {
        public_rooms: search.public_rooms,
      }),
      ...(search.empty_rooms !== undefined && {
        empty_rooms: search.empty_rooms,
      }),
    } satisfies RoomListFilters,
  }),
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters },
  }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await queryClient.ensureInfiniteQueryData(
      roomsInfiniteQuery(synapseRoot, parameters),
    );
  },

  pendingComponent: () => (
    <>
      <Outlet />

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
    </>
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
  const { parameters } = Route.useLoaderDeps();
  const from = useCurrentChildRoutePath(Route.id);
  const navigate = useNavigate({ from });
  const intl = useIntl();

  const debouncedSearch = useDebouncedCallback(
    (term: string) => {
      navigate({
        replace: true,
        search: (previous) => {
          if (!term.trim()) {
            return { ...previous, search_term: undefined };
          }

          return { ...previous, search_term: term.trim() };
        },
      });
    },
    {
      key: "room-search",
      wait: 400,
    },
  );

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
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "roomName",
          header: intl.formatMessage(columnMessages.room),
          meta: { width: DataTable.columnWidth.primary },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const room = row.original;
            return (
              <DataTable.RowLink
                to="/rooms/$roomId"
                params={{ roomId: room.room_id }}
                search={search}
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
              </DataTable.RowLink>
            );
          },
        }),
        columnHelper.display({
          id: "alias",
          header: intl.formatMessage(columnMessages.alias),
          meta: { width: { min: 200, fr: 2 } },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const room = row.original;
            const displayAlias = room.canonical_alias || room.room_id;
            return (
              <Text size="sm" className="text-text-secondary">
                {displayAlias}
              </Text>
            );
          },
        }),
        columnHelper.display({
          id: "members",
          header: intl.formatMessage(columnMessages.members),
          meta: { width: { min: 96, fr: 1 } },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const room = row.original;
            return <Text size="sm">{room.joined_members}</Text>;
          },
        }),
        columnHelper.display({
          id: "type",
          header: intl.formatMessage(columnMessages.type),
          meta: { width: DataTable.columnWidth.status },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const room = row.original;
            let label = intl.formatMessage(roomTypeMessages.private);
            let kind: "grey" | "green" | "blue" = "grey";

            if (room.public) {
              label = intl.formatMessage(roomTypeMessages.public);
              kind = "green";
            } else if (room.join_rules === "restricted") {
              label = intl.formatMessage(roomTypeMessages.restricted);
              kind = "blue";
            }

            return <Badge kind={kind}>{label}</Badge>;
          },
        }),
      ]),
    [search, synapseRoot, intl],
  );

  const onSearchInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      debouncedSearch(event.currentTarget.value);
    },
    [debouncedSearch],
  );

  const table = useTable({
    features,
    data: flatData,
    columns,
  });

  return (
    <>
      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
            <Page.Search
              placeholder={intl.formatMessage({
                id: "pages.rooms.search_placeholder",
                defaultMessage: "Search…",
                description:
                  "Placeholder for the search input on the rooms list page",
              })}
              defaultValue={search.search_term}
              onInput={onSearchInput}
            />
          </Page.Header>

          <DataTable.Root>
            <DataTable.Header>
              <DataTable.Title>
                <FormattedMessage
                  id="pages.rooms.room_count"
                  defaultMessage="{COUNT, plural, zero {No rooms} one {# room} other {# rooms}}"
                  description="On the room list page, this heading shows the total number of rooms"
                  values={{ COUNT: totalCount }}
                />
              </DataTable.Title>

              <DataTable.FilterMenu>
                {filters.all.map((filter) => (
                  <CheckboxMenuItem
                    key={filter.key}
                    onSelect={(event) => {
                      event.preventDefault();
                      navigate({
                        replace: true,
                        search: filter.toggledState,
                      });
                    }}
                    label={intl.formatMessage(filter.message)}
                    checked={filter.enabled}
                  />
                ))}
              </DataTable.FilterMenu>

              {filters.active.length > 0 && (
                <DataTable.ActiveFilterList>
                  {filters.active.map((filter) => (
                    <DataTable.ActiveFilter key={filter.key}>
                      <FormattedMessage {...filter.message} />
                      <DataTable.RemoveFilterLink
                        from={from}
                        replace={true}
                        search={filter.toggledState}
                      />
                    </DataTable.ActiveFilter>
                  ))}

                  <TextLink
                    from={from}
                    replace={true}
                    search={filters.clearedState}
                    size="sm"
                  >
                    <FormattedMessage {...messages.actionClear} />
                  </TextLink>
                </DataTable.ActiveFilterList>
              )}
            </DataTable.Header>

            <DataTable.List
              table={table}
              totalCount={totalCount}
              hasNextPage={hasNextPage}
              isFetching={isFetching}
              fetchNextPage={fetchNextPage}
            />
          </DataTable.Root>
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>
    </>
  );
}
