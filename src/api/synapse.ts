// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { QueryClient } from "@tanstack/react-query";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import * as v from "valibot";

import { PAGE_SIZE } from "@/constants";
import { MatrixStandardError } from "@/errors";
import { accessToken } from "@/stores/auth";
import { ensureResponseOk, fetch } from "@/utils/fetch";

const MatrixErrorResponse = v.object({
  errcode: v.string(),
  error: v.string(),
});

const ensureNotError = async (response: Response, handleNotFound = false) => {
  try {
    ensureResponseOk(response);
  } catch (error) {
    // Try to decode the error message from the JSON response
    let matrixError;
    try {
      const data = await response.json();
      matrixError = v.parse(MatrixErrorResponse, data);
    } catch {
      // In case the body wasn't JSON, ignore that error and instead throw the original error
      throw error;
    }

    // Special case for M_NOT_FOUND errors
    if (
      handleNotFound &&
      response.status === 404 &&
      matrixError.errcode === "M_NOT_FOUND"
    ) {
      console.warn(
        "Received M_NOT_FOUND error from Synapse, throwing a 'notFound' error",
        error,
        matrixError,
      );
      throw notFound();
    }

    throw new MatrixStandardError(matrixError.errcode, matrixError.error, {
      cause: error,
    });
  }
};

const baseOptions = async (
  client: QueryClient,
  signal?: AbortSignal,
): Promise<{ signal?: AbortSignal; headers: HeadersInit }> => ({
  headers: {
    Authorization: `Bearer ${await accessToken(client, signal)}`,
  },
  signal,
});

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

const RoomMembers = v.object({
  members: v.array(v.string()),
  total: v.number(),
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
export type RoomMembers = v.InferOutput<typeof RoomMembers>;
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
      const url = new URL("/_synapse/admin/v1/server_version", synapseRoot);
      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response);

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

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response);

      const rooms = v.parse(RoomsListResponse, await response.json());

      return rooms;
    },
    initialPageParam: null as number | string | null,
    getNextPageParam: (lastPage): number | string | null =>
      lastPage.next_batch ?? null,
  });

export const roomsCountQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["synapse", "rooms-count", synapseRoot],
    queryFn: async ({ client, signal }) => {
      const url = new URL("/_synapse/admin/v1/rooms?limit=0", synapseRoot);

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response);

      const rooms = v.parse(RoomsListResponse, await response.json());

      return rooms.total_rooms;
    },
  });

export const roomDetailQuery = (synapseRoot: string, roomId: string) =>
  queryOptions({
    queryKey: ["synapse", "room", synapseRoot, roomId],
    queryFn: async ({ client, signal }) => {
      const url = new URL(
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`,
        synapseRoot,
      );

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response, true);

      const roomDetail = v.parse(RoomDetail, await response.json());

      return roomDetail;
    },
  });

export const roomMembersQuery = (synapseRoot: string, roomId: string) =>
  queryOptions({
    queryKey: ["synapse", "roomMembers", synapseRoot, roomId],
    queryFn: async ({ client, signal }) => {
      const url = new URL(
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/members`,
        synapseRoot,
      );

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response, true);

      const roomMembers = v.parse(RoomMembers, await response.json());

      return roomMembers;
    },
  });

const RoomDeletionResponse = v.object({
  delete_id: v.string(),
});

export interface DeleteRoomParameters {
  block: boolean;
}

export const deleteRoom = async (
  client: QueryClient,
  synapseRoot: string,
  roomId: string,
  parameters: DeleteRoomParameters,
  signal?: AbortSignal,
): Promise<string> => {
  const url = new URL(
    `/_synapse/admin/v2/rooms/${encodeURIComponent(roomId)}`,
    synapseRoot,
  );

  const options = await baseOptions(client, signal);
  const response = await fetch(url, {
    ...options,
    method: "DELETE",
    body: JSON.stringify({
      block: parameters.block,
      purge: true,
    }),
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
    },
  });

  await ensureNotError(response);

  const result = v.parse(RoomDeletionResponse, await response.json());

  return result.delete_id;
};

const ScheduledTask = v.object({
  id: v.string(),
  action: v.string(),
  status: v.union([
    v.literal("scheduled"),
    v.literal("active"),
    v.literal("complete"),
    v.literal("failed"),
  ]),
  timestamp_ms: v.number(),
  resource_id: v.nullable(v.string()),
  result: v.nullable(v.record(v.string(), v.any())),
  error: v.nullable(v.string()),
});

export type ScheduledTask = v.InferOutput<typeof ScheduledTask>;

const ScheduledTaskList = v.object({
  scheduled_tasks: v.array(ScheduledTask),
});

// Federation destinations

const Destination = v.object({
  destination: v.string(),
  retry_last_ts: v.number(),
  retry_interval: v.number(),
  failure_ts: v.nullable(v.number()),
  last_successful_stream_ordering: v.nullable(v.number()),
});

export type Destination = v.InferOutput<typeof Destination>;

const DestinationsListResponse = v.object({
  destinations: v.array(Destination),
  next_token: v.optional(v.union([v.string(), v.number()])),
  total: v.number(),
});

export type DestinationsListResponse = v.InferOutput<
  typeof DestinationsListResponse
>;

export interface DestinationListFilters {
  order_by?:
    | "destination"
    | "retry_last_ts"
    | "retry_interval"
    | "failure_ts"
    | "last_successful_stream_ordering";
  dir?: "f" | "b";
  // Undocumented Synapse param: filters destinations with a
  // `LOWER(destination) LIKE '%<destination>%'` match.
  destination?: string;
}

export const federationDestinationsInfiniteQuery = (
  synapseRoot: string,
  parameters: DestinationListFilters = {},
) =>
  infiniteQueryOptions({
    queryKey: [
      "synapse",
      "federation",
      "destinations",
      "infinite",
      synapseRoot,
      parameters,
    ],
    queryFn: async ({ client, signal, pageParam }) => {
      const url = new URL(
        "/_synapse/admin/v1/federation/destinations",
        synapseRoot,
      );

      url.searchParams.set("limit", String(PAGE_SIZE));

      if (pageParam !== null) {
        url.searchParams.set("from", String(pageParam));
      }

      if (parameters.order_by)
        url.searchParams.set("order_by", parameters.order_by);
      if (parameters.dir) url.searchParams.set("dir", parameters.dir);
      if (parameters.destination)
        url.searchParams.set("destination", parameters.destination);

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response);

      const destinations = v.parse(
        DestinationsListResponse,
        await response.json(),
      );

      return destinations;
    },
    initialPageParam: null as number | string | null,
    getNextPageParam: (lastPage): number | string | null =>
      lastPage.next_token ?? null,
  });

export const federationDestinationsCountQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["synapse", "federation", "destinations-count", synapseRoot],
    queryFn: async ({ client, signal }) => {
      const url = new URL(
        "/_synapse/admin/v1/federation/destinations?limit=0",
        synapseRoot,
      );

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response);

      const destinations = v.parse(
        DestinationsListResponse,
        await response.json(),
      );

      return destinations.total;
    },
  });

export const federationDestinationQuery = (
  synapseRoot: string,
  destination: string,
) =>
  queryOptions({
    queryKey: [
      "synapse",
      "federation",
      "destination",
      synapseRoot,
      destination,
    ],
    queryFn: async ({ client, signal }) => {
      const url = new URL(
        `/_synapse/admin/v1/federation/destinations/${encodeURIComponent(destination)}`,
        synapseRoot,
      );

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response, true);

      const dest = v.parse(Destination, await response.json());

      return dest;
    },
  });

export const scheduledTasksForResource = (
  synapseRoot: string,
  resourceId: string,
) =>
  queryOptions({
    queryKey: ["synapse", "scheduledTasks", synapseRoot, resourceId],
    queryFn: async ({ client, signal }) => {
      const url = new URL(
        `/_synapse/admin/v1/scheduled_tasks?resource_id=${encodeURIComponent(resourceId)}`,
        synapseRoot,
      );

      const response = await fetch(url, await baseOptions(client, signal));

      await ensureNotError(response);

      const statusList = v.parse(ScheduledTaskList, await response.json());

      return statusList;
    },
    refetchInterval: (result) => {
      const tasks = result.state.data?.scheduled_tasks ?? [];

      // Refetch every second if there are any scheduled or active tasks
      return tasks.some(
        (task) => task.status === "scheduled" || task.status === "active",
      )
        ? 1000
        : false;
    },
  });

export const changeDisplayName = async (
  queryClient: QueryClient,
  synapseRoot: string,
  mxid: string,
  displayname: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const url = new URL(
    `/_synapse/admin/v2/users/${encodeURIComponent(mxid)}`,
    synapseRoot,
  );

  const baseOptions_ = await baseOptions(queryClient, signal);
  const response = await fetch(url, {
    ...baseOptions_,
    method: "PUT",
    body: JSON.stringify({ displayname }),
    headers: {
      ...baseOptions_.headers,
      "Content-Type": "application/json",
    },
  });

  await ensureNotError(response);

  return response;
};
