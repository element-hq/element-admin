import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

import { PAGE_SIZE } from "@/constants";
import { accessToken } from "@/stores/auth";

const ServerVersionResponse = v.object({
  server_version: v.string(),
});

const Room = v.object({
  room_id: v.string(),
  name: v.nullable(v.string()),
  canonical_alias: v.nullable(v.string()),
  joined_members: v.number(),
  joined_local_members: v.number(),
  version: v.string(),
  creator: v.string(),
  encryption: v.nullable(v.string()),
  federatable: v.boolean(),
  public: v.boolean(),
  join_rules: v.nullable(v.string()),
  guest_access: v.nullable(v.string()),
  history_visibility: v.nullable(v.string()),
  state_events: v.number(),
  room_type: v.nullable(v.string()),
});

const RoomDetail = v.object({
  room_id: v.string(),
  name: v.nullable(v.string()),
  topic: v.nullable(v.string()),
  avatar: v.nullable(v.string()),
  canonical_alias: v.nullable(v.string()),
  joined_members: v.number(),
  joined_local_members: v.number(),
  joined_local_devices: v.number(),
  version: v.string(),
  creator: v.string(),
  encryption: v.nullable(v.string()),
  federatable: v.boolean(),
  public: v.boolean(),
  join_rules: v.nullable(v.string()),
  guest_access: v.nullable(v.string()),
  history_visibility: v.nullable(v.string()),
  state_events: v.number(),
  room_type: v.nullable(v.string()),
  forgotten: v.boolean(),
});

const RoomsListResponse = v.pipe(
  v.object({
    rooms: v.array(v.unknown()),
    offset: v.number(),
    total_rooms: v.number(),
    next_batch: v.optional(v.union([v.string(), v.number()])),
    prev_batch: v.optional(v.union([v.string(), v.number()])),
  }),
  v.transform((value) => {
    const validatedRooms = value.rooms.map((item) => {
      return v.parse(Room, item);
    });

    return {
      ...value,
      rooms: validatedRooms,
    };
  }),
);

export type Room = v.InferOutput<typeof Room>;
export type RoomDetail = v.InferOutput<typeof RoomDetail>;
export type RoomsListResponse = v.InferOutput<typeof RoomsListResponse>;

export interface RoomListFilters {
  order_by?:
    | "alphabetical"
    | "size"
    | "name"
    | "canonical_alias"
    | "joined_members"
    | "joined_local_members"
    | "version"
    | "creator"
    | "encryption"
    | "federatable"
    | "public"
    | "join_rules"
    | "guest_access"
    | "history_visibility"
    | "state_events";
  dir?: "f" | "b";
  search_term?: string;
  public_rooms?: boolean;
  empty_rooms?: boolean;
}

export const serverVersionQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["serverVersion", synapseRoot],
    queryFn: async ({ client, signal }) => {
      const token = await accessToken(client, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const url = new URL("/_synapse/admin/v1/server_version", synapseRoot);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get server version");
      }

      const serverVersion = v.parse(
        ServerVersionResponse,
        await response.json(),
      );

      return serverVersion;
    },
  });

export const roomsInfiniteQuery = (
  synapseRoot: string,
  parameters: RoomListFilters = {},
) =>
  infiniteQueryOptions({
    queryKey: ["synapse", "rooms", "infinite", synapseRoot, parameters],
    queryFn: async ({ client, signal, pageParam }) => {
      const token = await accessToken(client, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const url = new URL("/_synapse/admin/v1/rooms", synapseRoot);

      // Set limit to PAGE_SIZE for infinite queries
      url.searchParams.set("limit", String(PAGE_SIZE));

      // Add pagination parameter
      if (pageParam !== null) {
        url.searchParams.set("from", String(pageParam));
      }

      // Add other query parameters
      if (parameters.order_by)
        url.searchParams.set("order_by", parameters.order_by);
      if (parameters.dir) url.searchParams.set("dir", parameters.dir);
      if (parameters.search_term)
        url.searchParams.set("search_term", parameters.search_term);
      if (parameters.public_rooms !== undefined)
        url.searchParams.set("public_rooms", String(parameters.public_rooms));
      if (parameters.empty_rooms !== undefined)
        url.searchParams.set("empty_rooms", String(parameters.empty_rooms));

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch rooms");
      }

      const rooms = v.parse(RoomsListResponse, await response.json());

      return rooms;
    },
    initialPageParam: null as number | string | null,
    getNextPageParam: (lastPage): number | string | null =>
      lastPage.next_batch ?? null,
  });

export const roomDetailQuery = (synapseRoot: string, roomId: string) =>
  queryOptions({
    queryKey: ["synapse", "room", synapseRoot, roomId],
    queryFn: async ({ client, signal }) => {
      const token = await accessToken(client, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const url = new URL(
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`,
        synapseRoot,
      );

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch room details");
      }

      const roomDetail = v.parse(RoomDetail, await response.json());

      return roomDetail;
    },
  });
