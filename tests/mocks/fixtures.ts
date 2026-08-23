// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type {
  ErrorResponse,
  PaginatedResponseForUser,
  SingleResponseForUser,
  Ulid,
  User,
} from "@/api/mas/api";
import type { Room, RoomDetail, RoomsListResponse } from "@/api/synapse";

/**
 * The Matrix server name every test logs in against. Discovery starts at
 * `https://{SERVER_NAME}/.well-known/matrix/client`.
 */
export const SERVER_NAME = "example.com";

/** `m.homeserver.base_url` in the mocked well-known document. */
export const SYNAPSE_ROOT = "https://matrix.example.com/";

/**
 * Where MAS lives. The app discovers this from the mocked auth metadata rather
 * than from configuration, so handlers match on `*\/path` rather than on an
 * absolute URL.
 */
export const MAS_ROOT = "https://auth.example.com";

/** The Matrix ID the mocked `whoami` reports for the logged-in admin. */
export const ADMIN_MXID = `@admin:${SERVER_NAME}`;

export const ACCESS_TOKEN = "mock-access-token";
export const REFRESH_TOKEN = "mock-refresh-token";

/**
 * A MAS version above every version gate: `personalTokens` needs >=1.5.0 and
 * `devices` needs >=1.20.0.
 */
export const MAS_VERSION = "1.22.0";

/**
 * The ESS version reported by `/_synapse/ess/version` in the default
 * deployment. One release behind `LATEST_ESS_RELEASE`, so the dashboard has an
 * upgrade to point at.
 */
export const ESS_VERSION = "26.8.1";

/** The `tag_name` of the mocked latest ESS release on GitHub. */
export const LATEST_ESS_RELEASE = "26.9.0";

export const SYNAPSE_VERSION = "1.158.0";

/**
 * The page size the console asks every collection for, mirroring `PAGE_SIZE` in
 * `src/constants.ts`. That module cannot be imported here: evaluating it reads
 * `globalThis.location`, which the test process does not have.
 */
export const PAGE_SIZE = 200;

/**
 * The instant the numeric epoch-ms fixtures are laid out around. MAS sends its
 * timestamps as ISO strings and does not use it.
 */
export const FIXTURE_EPOCH_MS = 1_779_987_680_000;

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A deterministic ULID for the fixture at `index`, in Crockford base32,
 * left-padded to 26 characters.
 *
 * Fixture IDs cannot be arbitrary strings: MAS's generated valibot schemas
 * validate every ID against `^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$`
 * (`vUlid`), and detail routes reject a non-ULID path parameter with
 * `notFound()` via `ensureParametersAreUlids` before ever querying.
 */
export const ulid = (index: number): Ulid => {
  let remaining = index;
  let encoded = "";
  do {
    encoded = ULID_ALPHABET.charAt(remaining % 32) + encoded;
    remaining = Math.floor(remaining / 32);
  } while (remaining > 0);
  return encoded.padStart(26, "0");
};

/**
 * A `count=only` MAS response: `meta.count` and `links`, with no `data`. That is
 * a different shape from a list response, and `ensureHasCount` in
 * `src/api/mas/index.ts` throws when `meta.count` is missing.
 *
 * The shape satisfies `PaginatedResponseFor*` for every resource type.
 */
export const countOnly = (
  count: number,
  self = "/api/admin/v1/unknown?count=only",
): { meta: { count: number }; links: { self: string } } => ({
  meta: { count },
  links: { self },
});

/**
 * `links` for a list response that fits on a single page. MAS omits
 * `next`/`prev` entirely in that case, and the app's infinite queries read a
 * missing `next` as the end of the collection.
 */
export const listLinks = (
  path: string,
): { self: string; first: string; last: string } => ({
  self: path,
  first: path,
  last: path,
});

/** A typed MAS error body, for 4xx/5xx responses. */
export const masError = (...titles: string[]): ErrorResponse => ({
  errors: titles.map((title) => ({ title })),
});

/** Overrides for a fixture: any subset of its attributes, plus an explicit id. */
type MasOverrides<A> = Partial<A> & { id?: Ulid };

/** A JSON:API resource, as MAS serialises it. */
interface MasResource<A> {
  type: string;
  id: Ulid;
  attributes: A;
  links: { self: string };
}

/**
 * A resource inside a list response. Each entry carries its own pagination
 * cursor, which is what `cursorForSingleResource` in `src/api/mas/index.ts`
 * reads.
 */
interface MasListItem<A> extends MasResource<A> {
  meta: { page: { cursor: Ulid } };
}

interface MasPage<A> {
  data: MasListItem<A>[];
  links: { self: string; first: string; last: string; next?: string };
}

interface MasSingle<A> {
  data: MasResource<A>;
  links: { self: string };
}

interface MasCollectionSpec<A> {
  /** The JSON:API resource type, e.g. `"user"`. */
  type: string;
  /** The collection path, e.g. `"/api/admin/v1/users"`. */
  path: string;
  /** The start of this collection's ULID range. */
  idBase: number;
  /** The attributes an override-free fixture at `index` gets. */
  defaults: (index: number, id: Ulid) => A;
}

/**
 * The six MAS admin collections the console reads share one envelope, one
 * cursor protocol and one fixture convention, so they are all built from here.
 * Callers bind the members they need to exported names annotated with the
 * generated response types.
 */
const masCollection = <A>({
  type,
  path,
  idBase,
  defaults,
}: MasCollectionSpec<A>) => {
  const listPath = `${path}?count=false&page[first]=${PAGE_SIZE}`;

  /**
   * `index` seeds both the ULID and the attribute defaults, so fixtures are
   * stable across runs.
   */
  const resource = (
    index: number,
    { id = ulid(idBase + index), ...attributes }: MasOverrides<A> = {},
  ): MasResource<A> => ({
    type,
    id,
    attributes: { ...defaults(index, id), ...attributes },
    links: { self: `${path}/${id}` },
  });

  const listItem = (index: number, overrides?: MasOverrides<A>) => {
    const item = resource(index, overrides);
    return { ...item, meta: { page: { cursor: item.id } } };
  };

  /** The id the fixture at `index` will be served under. */
  const id = (items: MasOverrides<A>[], index: number): Ulid =>
    items[index]?.id ?? ulid(idBase + index);

  /**
   * One page of `first` items starting at `start`.
   *
   * `links.next` is present only while items remain after this page, and its
   * presence is the app's only stopping condition: `getNextPageParam` in
   * `src/api/mas/index.ts` is
   * `lastPage.links.next && cursorForSingleResource(lastPage.data.at(-1))`, so a
   * `next` on the final page makes the app ask for another page forever, and a
   * missing `next` on a non-final page hides the rest of the collection. Only
   * its truthiness is read; the value mirrors what MAS sends.
   */
  const pageSlice = (
    items: MasOverrides<A>[],
    start: number,
    first: number,
  ): MasPage<A> => {
    const data = items
      .slice(start, start + first)
      .map((overrides, offset) => listItem(start + offset, overrides));
    const cursor = data.at(-1)?.meta.page.cursor;

    return {
      data,
      links: {
        ...listLinks(listPath),
        ...(start + data.length < items.length &&
          cursor !== undefined && {
            next: `${listPath}&page[after]=${cursor}`,
          }),
      },
    };
  };

  /**
   * The whole collection on one page, so there is no `links.next` and the app
   * stops after the first request. This is what every fixture deployment serves.
   */
  const page = (items: MasOverrides<A>[]): MasPage<A> =>
    pageSlice(items, 0, items.length);

  /**
   * One page holding exactly the items at `indices`, in that order.
   *
   * A fixture's identity is seeded from its array index, so a filtered
   * collection has to select indices rather than slice a filtered array: that
   * would renumber the survivors and `@user3:example.com` would come back as
   * `@user0:…`. There is no `links.next`, since filter fixtures are single-page.
   */
  const pageOf = (
    items: MasOverrides<A>[],
    indices: readonly number[],
  ): MasPage<A> => ({
    data: indices.map((index) => listItem(index, items[index])),
    links: listLinks(listPath),
  });

  /**
   * A single resource, as `GET {path}/{id}` returns it. There is no `meta.page`:
   * single-resource responses have no cursor.
   */
  const single = (
    index: number,
    overrides: MasOverrides<A> = {},
  ): MasSingle<A> => {
    const item = resource(index, overrides);
    return { data: item, links: item.links };
  };

  return { resource, id, page, pageSlice, pageOf, single };
};

/**
 * ULID bases, one range per collection. IDs only have to be unique within their
 * own collection, but disjoint ranges mean a ULID in a failed assertion says
 * which fixture it came from — and that a session's `client_id` cannot be
 * mistaken for a user ID. The spacing has to exceed the largest generated
 * collection, which is `pagination.spec.ts`'s 250 users.
 */
const USER_ID_BASE = 0;

const userCollection = masCollection<User>({
  type: "user",
  path: "/api/admin/v1/users",
  idBase: USER_ID_BASE,
  defaults: (index) => ({
    username: `user${index}`,
    created_at: "2026-05-04T13:58:19.771840Z",
    locked_at: null,
    deactivated_at: null,
    admin: false,
    legacy_guest: false,
  }),
});

export type UserOverrides = MasOverrides<User>;

export const userId: (users: UserOverrides[], index: number) => Ulid =
  userCollection.id;

export const userPage: (users: UserOverrides[]) => PaginatedResponseForUser =
  userCollection.page;

export const singleUser: (
  index: number,
  overrides?: UserOverrides,
) => SingleResponseForUser = userCollection.single;

/** The default set of users served by the `essPro` deployment. */
export const DEFAULT_USERS: UserOverrides[] = [
  { username: "admin", admin: true },
  { username: "alice", created_at: "2026-06-22T10:00:20.315679Z" },
  {
    username: "bob",
    created_at: "2026-07-01T09:12:00.000000Z",
    deactivated_at: "2026-08-01T09:12:00.000000Z",
  },
];

/** Overrides for a room fixture: any `RoomDetail` field. */
export type RoomOverrides = Partial<RoomDetail>;

/** The deterministic room ID of an override-free fixture at `index`. */
const defaultRoomId = (index: number): string => `!room${index}:${SERVER_NAME}`;

/**
 * The id the room fixture at `index` is served under; an index past the end of
 * `rooms` names a room no handler serves.
 *
 * Unlike every MAS resource, a room ID is not a ULID, and `/rooms/$roomId` has
 * no `ensureParametersAreUlids` guard — it passes the sigil string straight
 * through to Synapse. An unknown-room test therefore needs a plausible room ID,
 * not an unknown ULID.
 */
export const roomId = (rooms: RoomOverrides[], index: number): string =>
  rooms[index]?.room_id ?? defaultRoomId(index);

/**
 * A single room, as `GET /_synapse/admin/v1/rooms/{roomId}` returns it. Every
 * key of `RoomDetail` is required by the valibot schema — nullable, but present
 * — so the defaults spell all of them out.
 */
export const singleRoom = (
  index: number,
  overrides: RoomOverrides = {},
): RoomDetail => ({
  room_id: defaultRoomId(index),
  name: `Room ${index}`,
  topic: null,
  avatar: null,
  canonical_alias: null,
  joined_members: 1,
  joined_local_members: 1,
  joined_local_devices: 1,
  version: "10",
  creator: ADMIN_MXID,
  encryption: null,
  federatable: true,
  public: false,
  join_rules: "invite",
  guest_access: "forbidden",
  history_visibility: "shared",
  state_events: 10,
  room_type: null,
  forgotten: false,
  ...overrides,
});

/**
 * The same room as a list entry. `Room` is `RoomDetail` minus four keys, which
 * the list schema strips, so the fixture omits them.
 */
const roomListEntry = (index: number, overrides: RoomOverrides = {}): Room => {
  const {
    topic: _topic,
    avatar: _avatar,
    joined_local_devices: _devices,
    forgotten: _forgotten,
    ...room
  } = singleRoom(index, overrides);
  return room;
};

/**
 * One page of at most `limit` rooms starting at the offset `from`, as
 * `GET /_synapse/admin/v1/rooms` returns it.
 *
 * Synapse's rooms pagination is not a cursor: `from` is a numeric offset and
 * `next_batch` is the offset of the page after this one, which is what the app
 * echoes back (`url.searchParams.set("from", String(pageParam))`). `next_batch`
 * is present only while rooms remain, because `getNextPageParam` is
 * `lastPage.next_batch ?? null` and a value on the last page makes the app ask
 * forever.
 *
 * `total_rooms` is the whole collection on every page, not the page size: the
 * list heading reads it off page one and must not contradict the rows.
 */
export const roomPageSlice = (
  rooms: RoomOverrides[],
  from: number,
  limit: number,
): RoomsListResponse => {
  const slice = rooms.slice(from, from + limit);
  return {
    rooms: slice.map((overrides, index) =>
      roomListEntry(from + index, overrides),
    ),
    offset: from,
    total_rooms: rooms.length,
    ...(from + slice.length < rooms.length && {
      next_batch: from + slice.length,
    }),
  };
};

/**
 * A page of rooms, as `GET /_synapse/admin/v1/rooms` returns it — the whole
 * collection at once, so there is no `next_batch` and the app stops after the
 * first request. This is what every fixture deployment serves.
 */
export const roomPage = (rooms: RoomOverrides[]): RoomsListResponse =>
  roomPageSlice(rooms, 0, rooms.length);

/** The default set of rooms served by the `essPro` deployment. */
export const DEFAULT_ROOMS: RoomOverrides[] = [
  {
    name: "General",
    canonical_alias: `#general:${SERVER_NAME}`,
    topic: "Everything and anything",
    avatar: "mxc://example.com/general-avatar",
    public: true,
    join_rules: "public",
    guest_access: "can_join",
    history_visibility: "world_readable",
    joined_members: 3,
    joined_local_members: 3,
    joined_local_devices: 4,
    state_events: 42,
  },
  {
    name: "Element Space",
    room_type: "m.space",
    join_rules: "restricted",
    joined_members: 2,
    joined_local_members: 2,
    state_events: 12,
  },
  {
    // Neither a name nor an alias, so `useRoomName` in
    // `src/components/room-info.tsx` derives a display name (and the avatar's
    // heroes) from the members endpoint — the only thing that ever requests it.
    name: null,
    encryption: "m.megolm.v1.aes-sha2",
    joined_members: 2,
    joined_local_members: 2,
    state_events: 7,
  },
];
