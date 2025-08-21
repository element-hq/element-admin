import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, MatchRoute } from "@tanstack/react-router";
import { Badge, Button, H2, Text, TextInput } from "@vector-im/compound-web";
import * as v from "valibot";

import { wellKnownQuery } from "@/api/matrix";
import { type RoomListParameters, roomsQuery } from "@/api/synapse";
import { ButtonLink, ChatFilterLink } from "@/components/link";
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
    context: { queryClient, credentials },
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

    await queryClient.ensureQueryData(
      roomsQuery(queryClient, synapseRoot, parameters),
    );
  },
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
  const queryClient = useQueryClient();

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

  const { data } = useSuspenseQuery(
    roomsQuery(queryClient, synapseRoot, parameters),
  );

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <H2 className="flex-1">Rooms</H2>
        <Text size="sm" className="text-text-secondary">
          Total: {data.total_rooms}
        </Text>
      </div>

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

      <TextInput
        placeholder="Search rooms by name, alias, or ID..."
        value={search.search_term || ""}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          navigate({
            search: (previous) => {
              const newParameters = resetPagination(previous);
              if (!event.target.value) {
                const { search_term, ...rest } = newParameters;
                search_term as undefined; // trick biome about it being used
                return rest;
              }
              return { ...newParameters, search_term: event.target.value };
            },
          });
        }}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-interactive-secondary">
          <thead className="bg-bg-canvas-disabled">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Room
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Local Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Encryption
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Visibility
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Join Rules
              </th>
            </tr>
          </thead>
          <tbody className="bg-bg-action-secondary-rest divide-y divide-border-interactive-secondary">
            {data.rooms.map((room) => (
              <tr
                key={room.room_id}
                className="hover:bg-bg-action-secondary-hovered"
              >
                <td className="px-6 py-4 whitespace-nowrap">
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
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Text>{room.joined_members}</Text>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Text>{room.joined_local_members}</Text>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge kind="grey">{room.version}</Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge kind={room.encryption ? "green" : "grey"}>
                    {formatEncryption(room.encryption)}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge kind={room.public ? "blue" : "grey"}>
                    {room.public ? "Public" : "Private"}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
