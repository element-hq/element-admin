/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Avatar, Badge, Text } from "@vector-im/compound-web";
import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FormattedMessage } from "react-intl";
import * as v from "valibot";

import { mediaThumbnailQuery, wellKnownQuery } from "@/api/matrix";
import {
  type RoomListFilters,
  roomsInfiniteQuery,
  type Room,
  roomDetailQuery,
} from "@/api/synapse";
import { ChatFilterLink } from "@/components/link";
import * as Page from "@/components/page";
import * as Table from "@/components/table";
import { useImageBlob } from "@/utils/blob";

const RoomSearchParameters = v.object({
  order_by: v.optional(
    v.picklist([
      "alphabetical",
      "size",
      "name",
      "canonical_alias",
      "joined_members",
      "joined_local_members",
      "version",
      "creator",
      "encryption",
      "federatable",
      "public",
      "join_rules",
      "guest_access",
      "history_visibility",
      "state_events",
    ]),
  ),
  dir: v.optional(v.picklist(["f", "b"])),
  search_term: v.optional(v.string()),
  public_rooms: v.optional(v.boolean()),
  empty_rooms: v.optional(v.boolean()),
});

export const Route = createFileRoute("/_console/rooms/")({
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
      ...(search.order_by && { order_by: search.order_by }),
      ...(search.dir && { dir: search.dir }),
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
      title: intl.formatMessage({
        id: "pages.rooms.title",
        defaultMessage: "Rooms",
        description: "The title of the rooms list page",
      }),
    };
  },
  head: ({ loaderData }) => ({
    meta: [loaderData ? { title: loaderData.title } : {}],
  }),
  component: RouteComponent,
});

const LazyRoomAvatar = ({
  roomId,
  name,
  synapseRoot,
}: {
  roomId: string;
  name: string;
  synapseRoot: string;
}) => {
  const { data: room } = useSuspenseQuery(roomDetailQuery(synapseRoot, roomId));
  const { data: avatar } = useQuery(
    mediaThumbnailQuery(synapseRoot, room.avatar || undefined),
  );
  const avatarUrl = useImageBlob(avatar);
  return <Avatar id={roomId} name={name} src={avatarUrl} size="32px" />;
};

const RoomAvatarWithFallback = ({
  roomId,
  name,
  synapseRoot,
}: {
  roomId: string;
  name: string;
  synapseRoot: string;
}) => (
  <Suspense fallback={<Avatar id={roomId} name={name} size="32px" />}>
    <LazyRoomAvatar roomId={roomId} name={name} synapseRoot={synapseRoot} />
  </Suspense>
);

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
    ...(search.order_by && { order_by: search.order_by }),
    ...(search.dir && { dir: search.dir }),
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
          const displayName = room.name || room.canonical_alias || room.room_id;
          return (
            <div className="flex items-center gap-3 max-w-full w-full min-w-0">
              <RoomAvatarWithFallback
                synapseRoot={synapseRoot}
                roomId={room.room_id}
                name={displayName}
              />
              <div className="flex flex-col min-w-0">
                <Link
                  to="/rooms/$roomId"
                  params={{ roomId: room.room_id }}
                  className="text-text-link-external hover:underline"
                >
                  <Text weight="semibold" size="md">
                    {displayName}
                  </Text>
                </Link>
              </div>
            </div>
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
    <div className="flex flex-col gap-6">
      <Page.Header>
        <Page.Title>
          <FormattedMessage
            id="pages.rooms.title"
            defaultMessage="Rooms"
            description="The title of the rooms list page"
          />
        </Page.Title>
        <Page.Search
          placeholder="Search…"
          value={localSearchTerm}
          onInput={onSearchInput}
        />
        <Page.Controls>
          <Page.LinkButton to="/" variant="secondary" Icon={DownloadIcon}>
            <FormattedMessage
              id="action.export"
              defaultMessage="Export"
              description="The label for the export action/button"
            />
          </Page.LinkButton>
        </Page.Controls>
      </Page.Header>

      {/* Filters */}
      <div className="flex gap-4">
        <ChatFilterLink
          selected={search.public_rooms === true}
          to={Route.fullPath}
          search={
            search.public_rooms === true
              ? omit(search, ["public_rooms"])
              : {
                  ...search,
                  public_rooms: true,
                }
          }
        >
          Public Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.public_rooms === false}
          to={Route.fullPath}
          search={
            search.public_rooms === false
              ? omit(search, ["public_rooms"])
              : {
                  ...search,
                  public_rooms: false,
                }
          }
        >
          Private Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.empty_rooms === true}
          to={Route.fullPath}
          search={
            search.empty_rooms === true
              ? omit(search, ["empty_rooms"])
              : {
                  ...search,
                  empty_rooms: true,
                }
          }
        >
          Empty Only
        </ChatFilterLink>
      </div>

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
    </div>
  );
}
