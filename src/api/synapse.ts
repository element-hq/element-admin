import { type QueryClient, queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

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

export type RoomListParameters = {
  from?: number | string;
  limit?: number;
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
};

export const serverVersionQuery = (
  queryClient: QueryClient,
  synapseRoot: string,
) =>
  queryOptions({
    queryKey: ["serverVersion", synapseRoot],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
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

export const roomsQuery = (
  queryClient: QueryClient,
  synapseRoot: string,
  parameters: RoomListParameters = {},
) =>
  queryOptions({
    queryKey: ["synapse", "rooms", synapseRoot, parameters],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const url = new URL("/_synapse/admin/v1/rooms", synapseRoot);

      // Add query parameters
      if (parameters.from !== undefined)
        url.searchParams.set("from", String(parameters.from));
      if (parameters.limit !== undefined)
        url.searchParams.set("limit", String(parameters.limit));
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
  });

export const roomDetailQuery = (
  queryClient: QueryClient,
  synapseRoot: string,
  roomId: string,
) =>
  queryOptions({
    queryKey: ["synapse", "room", synapseRoot, roomId],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
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
