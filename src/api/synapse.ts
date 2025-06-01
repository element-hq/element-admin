import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { type } from "arktype";

import { accessToken } from "@/stores/auth";

const ServerVersionResponse = type({
  server_version: "string",
});

const Room = type({
  room_id: "string",
  name: "string | null",
  canonical_alias: "string | null",
  joined_members: "number",
  joined_local_members: "number",
  version: "string",
  creator: "string",
  encryption: "string | null",
  federatable: "boolean",
  public: "boolean",
  join_rules: "string | null",
  guest_access: "string | null",
  history_visibility: "string | null",
  state_events: "number",
  room_type: "string | null",
});

const RoomDetail = type({
  room_id: "string",
  name: "string | null",
  topic: "string | null",
  avatar: "string | null",
  canonical_alias: "string | null",
  joined_members: "number",
  joined_local_members: "number",
  joined_local_devices: "number",
  version: "string",
  creator: "string",
  encryption: "string | null",
  federatable: "boolean",
  public: "boolean",
  join_rules: "string | null",
  guest_access: "string | null",
  history_visibility: "string | null",
  state_events: "number",
  room_type: "string | null",
  forgotten: "boolean",
});

const RoomsListResponse = type({
  rooms: "unknown[]",
  offset: "number",
  total_rooms: "number",
  "next_batch?": "string | number",
  "prev_batch?": "string | number",
}).pipe((value) => {
  const validatedRooms = (value.rooms as unknown[]).map((item) => {
    const result = Room(item);
    if (result instanceof type.errors) {
      throw new Error(result.summary);
    }
    return result;
  });

  return {
    ...value,
    rooms: validatedRooms,
  };
});

export type Room = typeof Room.infer;
export type RoomDetail = typeof RoomDetail.infer;
export type RoomsListResponse = typeof RoomsListResponse.infer;

export type RoomListParams = {
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

      const serverVersion = ServerVersionResponse(await response.json());
      if (serverVersion instanceof type.errors) {
        throw new Error(serverVersion.summary);
      }

      return serverVersion;
    },
  });

export const roomsQuery = (
  queryClient: QueryClient,
  synapseRoot: string,
  params: RoomListParams = {},
) =>
  queryOptions({
    queryKey: ["synapse", "rooms", synapseRoot, params],
    queryFn: async ({ signal }) => {
      const token = await accessToken(queryClient, signal);
      if (!token) {
        throw new Error("No access token");
      }

      const url = new URL("/_synapse/admin/v1/rooms", synapseRoot);

      // Add query parameters
      if (params.from !== undefined)
        url.searchParams.set("from", String(params.from));
      if (params.limit !== undefined)
        url.searchParams.set("limit", String(params.limit));
      if (params.order_by) url.searchParams.set("order_by", params.order_by);
      if (params.dir) url.searchParams.set("dir", params.dir);
      if (params.search_term)
        url.searchParams.set("search_term", params.search_term);
      if (params.public_rooms !== undefined)
        url.searchParams.set("public_rooms", String(params.public_rooms));
      if (params.empty_rooms !== undefined)
        url.searchParams.set("empty_rooms", String(params.empty_rooms));

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch rooms");
      }

      const rooms = RoomsListResponse(await response.json());
      if (rooms instanceof type.errors) {
        throw new Error(rooms.summary);
      }

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

      const roomDetail = RoomDetail(await response.json());
      if (roomDetail instanceof type.errors) {
        throw new Error(roomDetail.summary);
      }

      return roomDetail;
    },
  });
