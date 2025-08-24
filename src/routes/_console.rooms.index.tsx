/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, MatchRoute } from "@tanstack/react-router";
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, Button, Text } from "@vector-im/compound-web";
import { useState, useEffect, useCallback } from "react";
import { FormattedMessage } from "react-intl";
import * as v from "valibot";

import { wellKnownQuery } from "@/api/matrix";
import { type RoomListParameters, roomsQuery } from "@/api/synapse";
import { ButtonLink, ChatFilterLink } from "@/components/link";
import * as Page from "@/components/page";
import * as Table from "@/components/table";
import { PAGE_SIZE } from "@/constants";

const RoomSearchParameters = v.object({
  from: v.optional(v.union([v.number(), v.string()])),
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
    const parameters: RoomListParameters = {
      limit: PAGE_SIZE,
      ...(search.from !== undefined && { from: search.from }),
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

    await queryClient.ensureQueryData(roomsQuery(synapseRoot, parameters));

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

const resetPagination = ({
  from: _from,
  ...search
}: v.InferOutput<typeof RoomSearchParameters>): v.InferOutput<
  typeof RoomSearchParameters
> => search;

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  object: T,
  keys: K[],
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(object).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;

const formatEncryption = (encryption: string | null) => {
  if (!encryption) return "None";
  if (encryption === "m.megolm.v1.aes-sha2") return "E2EE";
  return encryption;
};

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
          const newParameters = resetPagination(previous);
          if (!localSearchTerm.trim()) {
            const { search_term: _, ...rest } = newParameters;
            return rest;
          }
          return { ...newParameters, search_term: localSearchTerm.trim() };
        },
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [localSearchTerm, navigate]);

  const parameters: RoomListParameters = {
    limit: PAGE_SIZE,
    ...(search.from !== undefined && { from: search.from }),
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

  const { data } = useSuspenseQuery(roomsQuery(synapseRoot, parameters));

  const currentFrom = search.from || 0;

  const nextPageParameters = data.next_batch && {
    ...resetPagination(search),
    from: data.next_batch,
  };

  const previousPageParameters = (data.prev_batch || data.prev_batch === 0) && {
    ...resetPagination(search),
    from: data.prev_batch,
  };

  const firstPageParameters = !!currentFrom && resetPagination(search);

  const formatRoomName = (room: (typeof data.rooms)[0]) => {
    if (room.name) return room.name;
    if (room.canonical_alias) return room.canonical_alias;
    return room.room_id;
  };

  const onSearchInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      setLocalSearchTerm(event.currentTarget.value);
    },
    [setLocalSearchTerm],
  );

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
            Export
          </Page.LinkButton>
        </Page.Controls>
      </Page.Header>

      <div className="flex gap-4 flex-wrap">
        <ChatFilterLink
          selected={search.public_rooms === true}
          to={Route.fullPath}
          search={
            search.public_rooms === true
              ? omit(resetPagination(search), ["public_rooms"])
              : {
                  ...resetPagination(search),
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
              ? omit(resetPagination(search), ["public_rooms"])
              : {
                  ...resetPagination(search),
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
              ? omit(resetPagination(search), ["empty_rooms"])
              : {
                  ...resetPagination(search),
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
              values={{ COUNT: data.total_rooms }}
            />
          </Table.Title>
          <Table.Controls>
            <Table.Showing>
              Showing {data.rooms.length} room
              {data.rooms.length === 1 ? "" : "s"}
            </Table.Showing>
            <Table.FilterButton />
          </Table.Controls>
        </Table.Header>

        <Table.List>
          <Table.ListHeader>
            <Table.ListHeaderCell>Room</Table.ListHeaderCell>
            <Table.ListHeaderCell>Members</Table.ListHeaderCell>
            <Table.ListHeaderCell>Local Members</Table.ListHeaderCell>
            <Table.ListHeaderCell>Version</Table.ListHeaderCell>
            <Table.ListHeaderCell>Encryption</Table.ListHeaderCell>
            <Table.ListHeaderCell>Visibility</Table.ListHeaderCell>
            <Table.ListHeaderCell>Join Rules</Table.ListHeaderCell>
          </Table.ListHeader>

          <Table.ListBody>
            {data.rooms.map((room) => (
              <Table.ListRow key={room.room_id} clickable>
                <Table.ListCell>
                  <div className="flex flex-col">
                    <Link
                      to="/rooms/$roomId"
                      params={{ roomId: room.room_id }}
                      className="text-text-link-external hover:underline"
                    >
                      <Text weight="medium">{formatRoomName(room)}</Text>
                    </Link>
                    <Text size="sm" className="text-text-secondary">
                      {room.room_id}
                    </Text>
                    {room.canonical_alias &&
                      room.canonical_alias !== formatRoomName(room) && (
                        <Text size="sm" className="text-text-primary">
                          {room.canonical_alias}
                        </Text>
                      )}
                  </div>
                </Table.ListCell>
                <Table.ListCell>
                  <Text>{room.joined_members}</Text>
                </Table.ListCell>
                <Table.ListCell>
                  <Text>{room.joined_local_members}</Text>
                </Table.ListCell>
                <Table.ListCell>
                  <Badge kind="grey">{room.version}</Badge>
                </Table.ListCell>
                <Table.ListCell>
                  <Badge kind={room.encryption ? "green" : "grey"}>
                    {formatEncryption(room.encryption)}
                  </Badge>
                </Table.ListCell>
                <Table.ListCell>
                  <Badge kind={room.public ? "blue" : "grey"}>
                    {room.public ? "Public" : "Private"}
                  </Badge>
                </Table.ListCell>
                <Table.ListCell>
                  <Badge
                    kind={
                      room.join_rules === "public"
                        ? "green"
                        : room.join_rules === "invite"
                          ? "blue"
                          : "grey"
                    }
                  >
                    {room.join_rules}
                  </Badge>
                </Table.ListCell>
              </Table.ListRow>
            ))}
          </Table.ListBody>
        </Table.List>
      </Table.Root>

      <div className="flex items-center justify-between">
        <MatchRoute to={Route.path} pending>
          {(match) => (
            <>
              <div className="flex gap-2">
                {firstPageParameters ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={firstPageParameters}
                  >
                    First
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    First
                  </Button>
                )}

                {previousPageParameters ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={previousPageParameters}
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
                {nextPageParameters ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={nextPageParameters}
                  >
                    Next
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Next
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
