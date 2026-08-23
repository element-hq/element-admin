// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { AdminbotResponse } from "@/api/ess";
import type {
  CompatSession,
  ErrorResponse,
  OAuth2Client,
  OAuth2Session,
  PaginatedResponseForCompatSession,
  PaginatedResponseForOAuth2Client,
  PaginatedResponseForOAuth2Session,
  PaginatedResponseForPersonalSession,
  PaginatedResponseForUser,
  PaginatedResponseForUserRegistrationToken,
  PersonalSession,
  SingleResponseForCompatSession,
  SingleResponseForOAuth2Client,
  SingleResponseForOAuth2Session,
  SingleResponseForPersonalSession,
  SingleResponseForUser,
  SingleResponseForUserRegistrationToken,
  Ulid,
  User,
  UserRegistrationToken,
} from "@/api/mas/api";
import type {
  Destination,
  DestinationsListResponse,
  Room,
  RoomDetail,
  RoomsListResponse,
} from "@/api/synapse";

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

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

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
const CLIENT_ID_BASE = 1_000_000;
const OAUTH2_SESSION_ID_BASE = 2_000_000;
const COMPAT_SESSION_ID_BASE = 3_000_000;
const REGISTRATION_TOKEN_ID_BASE = 4_000_000;
const PERSONAL_SESSION_ID_BASE = 5_000_000;

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

const clientCollection = masCollection<OAuth2Client>({
  type: "oauth2-client",
  path: "/api/admin/v1/oauth2-clients",
  idBase: CLIENT_ID_BASE,
  defaults: (index, id) => ({
    // A dynamically-registered client's `client_id` is its ULID, and that is
    // what an OAuth 2.0 session's `client_id` points at.
    client_id: id,
    client_name: `Application ${index}`,
    client_uri: null,
    // `ClientInfo` feeds `logo_uri` to `Avatar src`, so a real URL would make
    // the browser fetch a third-party image that no handler covers.
    logo_uri: null,
    redirect_uris: [`https://app${index}.example.com/callback`],
    grant_types: ["authorization_code", "refresh_token"],
    is_static: false,
  }),
});

/** Overrides for an application fixture: any `OAuth2Client` attribute. */
export type OAuth2ClientOverrides = MasOverrides<OAuth2Client>;

export const clientId: (
  clients: OAuth2ClientOverrides[],
  index: number,
) => Ulid = clientCollection.id;

export const oauth2ClientPage: (
  clients: OAuth2ClientOverrides[],
) => PaginatedResponseForOAuth2Client = clientCollection.page;

export const singleOauth2Client: (
  index: number,
  overrides?: OAuth2ClientOverrides,
) => SingleResponseForOAuth2Client = clientCollection.single;

/** The default set of applications served by the `essPro` deployment. */
export const DEFAULT_OAUTH2_CLIENTS: OAuth2ClientOverrides[] = [
  {
    client_name: "Element Web",
    client_uri: "https://app.element.io/",
    redirect_uris: ["https://app.element.io/"],
  },
  {
    client_name: "Element X",
    redirect_uris: ["https://element.io/mobile/callback"],
    grant_types: ["authorization_code"],
  },
  // Neither a name nor a homepage, so every surface falls back to the raw
  // client ID — the applications equivalent of the nameless room fixture.
  { client_name: null },
];

/**
 * The scope a device-bound OAuth 2.0 session carries. `deviceIdFromScope` in
 * `src/utils/scope.ts` reads the device ID back out of it, so this is the only
 * place a session fixture's device ID lives.
 */
const deviceScope = (deviceId: string): string =>
  `urn:matrix:client:api:* urn:matrix:client:device:${deviceId}`;

const oauth2SessionCollection = masCollection<OAuth2Session>({
  type: "oauth2-session",
  path: "/api/admin/v1/oauth2-sessions",
  idBase: OAUTH2_SESSION_ID_BASE,
  defaults: (index) => ({
    created_at: "2026-07-01T09:00:00.000000Z",
    finished_at: null,
    user_id: userId(DEFAULT_USERS, 1),
    user_session_id: null,
    client_id: clientId(DEFAULT_OAUTH2_CLIENTS, 0),
    scope: deviceScope(`DEVICE${index}`),
    user_agent: null,
    last_active_at: null,
    last_active_ip: null,
    human_name: null,
  }),
});

/** Overrides for a device fixture: any `OAuth2Session` attribute. */
export type OAuth2SessionOverrides = MasOverrides<OAuth2Session>;

export const oauth2SessionId: (
  sessions: OAuth2SessionOverrides[],
  index: number,
) => Ulid = oauth2SessionCollection.id;

export const oauth2SessionPage: (
  sessions: OAuth2SessionOverrides[],
) => PaginatedResponseForOAuth2Session = oauth2SessionCollection.page;

export const singleOauth2Session: (
  index: number,
  overrides?: OAuth2SessionOverrides,
) => SingleResponseForOAuth2Session = oauth2SessionCollection.single;

/**
 * The default set of devices served by the `essPro` deployment.
 *
 * Every fixture sits in a time-independent activity bucket: `DeviceStatusBadge`
 * classifies a session against cutoffs derived from `Date.now()`, so a fixture
 * with a fixed `last_active_at` and no `finished_at` would drift from "recently
 * used" to "active" to "inactive" as the suite ages. A null `last_active_at` is
 * always "Never used" and a `finished_at` is always "Signed out".
 */
export const DEFAULT_OAUTH2_SESSIONS: OAuth2SessionOverrides[] = [
  {
    human_name: "Alice's laptop",
    scope: deviceScope("ELEMENTWEB01"),
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  },
  {
    client_id: clientId(DEFAULT_OAUTH2_CLIENTS, 1),
    scope: deviceScope("ELEMENTX0001"),
    // No human name, so the display name comes from the user-agent. This custom
    // (non-`Mozilla/`) form is parsed by the console's own parser rather than by
    // woothee, so the derived model name is ours to predict.
    user_agent: "ElementX/1.4.1 (iPhone 14; iOS 17.0.3; Scale/3.00)",
    last_active_at: "2026-07-20T11:30:00.000000Z",
    last_active_ip: "203.0.113.42",
    finished_at: "2026-07-25T08:15:00.000000Z",
  },
  {
    // No user, and a scope with no device token: the list falls back to "No
    // user" and "Unknown device".
    user_id: null,
    client_id: clientId(DEFAULT_OAUTH2_CLIENTS, 2),
    scope: "urn:matrix:client:api:*",
  },
];

const compatSessionCollection = masCollection<CompatSession>({
  type: "compat-session",
  path: "/api/admin/v1/compat-sessions",
  idBase: COMPAT_SESSION_ID_BASE,
  defaults: (index) => ({
    user_id: userId(DEFAULT_USERS, 1),
    device_id: `LEGACYDEVICE${index}`,
    user_session_id: null,
    redirect_uri: null,
    created_at: "2026-06-15T14:20:00.000000Z",
    user_agent: null,
    last_active_at: null,
    last_active_ip: null,
    finished_at: null,
    human_name: null,
  }),
});

/** Overrides for a legacy-device fixture: any `CompatSession` attribute. */
export type CompatSessionOverrides = MasOverrides<CompatSession>;

export const compatSessionId: (
  sessions: CompatSessionOverrides[],
  index: number,
) => Ulid = compatSessionCollection.id;

export const compatSessionPage: (
  sessions: CompatSessionOverrides[],
) => PaginatedResponseForCompatSession = compatSessionCollection.page;

export const singleCompatSession: (
  index: number,
  overrides?: CompatSessionOverrides,
) => SingleResponseForCompatSession = compatSessionCollection.single;

/**
 * The default set of legacy devices served by the `essPro` deployment.
 * Same time-independence rule as `DEFAULT_OAUTH2_SESSIONS`.
 */
export const DEFAULT_COMPAT_SESSIONS: CompatSessionOverrides[] = [
  {
    // No human name and no user-agent, so the device ID is the display name.
    device_id: "LEGACYWEB01",
    redirect_uri: "https://app.element.io/",
  },
  {
    device_id: "LEGACYAND01",
    human_name: "Riot on Android",
    // The deactivated user, whose Matrix profile 404s, so the user cell falls
    // back to a bare Matrix ID.
    user_id: userId(DEFAULT_USERS, 2),
    user_agent:
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    last_active_at: "2026-06-20T09:00:00.000000Z",
    last_active_ip: "203.0.113.7",
    finished_at: "2026-07-02T16:45:00.000000Z",
  },
];

const registrationTokenCollection = masCollection<UserRegistrationToken>({
  type: "user-registration-token",
  path: "/api/admin/v1/user-registration-tokens",
  idBase: REGISTRATION_TOKEN_ID_BASE,
  defaults: (index) => ({
    token: `token${index}`,
    // Server-computed, not derived by MAS from the other attributes, so every
    // fixture that is not active has to say `valid: false` — `TokenStatusBadge`
    // short-circuits to "Active" otherwise.
    valid: true,
    usage_limit: null,
    times_used: 0,
    created_at: "2026-06-01T08:00:00.000000Z",
    last_used_at: null,
    expires_at: null,
    revoked_at: null,
  }),
});

/** Overrides for a registration-token fixture: any `UserRegistrationToken` field. */
export type RegistrationTokenOverrides = MasOverrides<UserRegistrationToken>;

export const registrationTokenId: (
  tokens: RegistrationTokenOverrides[],
  index: number,
) => Ulid = registrationTokenCollection.id;

export const registrationTokenPage: (
  tokens: RegistrationTokenOverrides[],
) => PaginatedResponseForUserRegistrationToken =
  registrationTokenCollection.page;

export const singleRegistrationToken: (
  index: number,
  overrides?: RegistrationTokenOverrides,
) => SingleResponseForUserRegistrationToken =
  registrationTokenCollection.single;

/**
 * The default set of registration tokens served by the `essPro` deployment. One
 * fixture per branch of `TokenStatusBadge`, and all four are
 * clock-independent: "Active" comes from `valid`, "Revoked" from `revoked_at`,
 * "Used up" from `times_used >= usage_limit`, and "Expired" from an `expires_at`
 * that is in the past and stays there as the suite ages. A future `expires_at`
 * is the one thing that would rot, so no fixture has one.
 */
export const DEFAULT_REGISTRATION_TOKENS: RegistrationTokenOverrides[] = [
  { token: "welcome-2026" },
  {
    token: "revoked-token",
    valid: false,
    revoked_at: "2026-07-04T12:00:00.000000Z",
  },
  {
    token: "used-up-token",
    valid: false,
    usage_limit: 5,
    times_used: 5,
    last_used_at: "2026-07-10T15:30:00.000000Z",
  },
  {
    token: "expired-token",
    valid: false,
    expires_at: "2026-02-01T00:00:00.000000Z",
  },
];

const personalSessionCollection = masCollection<PersonalSession>({
  type: "personal-session",
  path: "/api/admin/v1/personal-sessions",
  idBase: PERSONAL_SESSION_ID_BASE,
  defaults: (index) => ({
    created_at: "2026-06-10T11:00:00.000000Z",
    revoked_at: null,
    // The admin owns the token, which is what makes the detail page's
    // `amITheOwner` check (`owner` vs. `whoami`) come out true.
    owner_user_id: userId(DEFAULT_USERS, 0),
    owner_client_id: null,
    actor_user_id: userId(DEFAULT_USERS, 1),
    human_name: `Personal token ${index}`,
    scope: "urn:mas:admin",
    last_active_at: null,
    last_active_ip: null,
    expires_at: null,
    // MAS returns `access_token` from the create and regenerate endpoints only,
    // never from a list or a detail read.
    access_token: null,
  }),
});

/** Overrides for a personal-token fixture: any `PersonalSession` field. */
export type PersonalSessionOverrides = MasOverrides<PersonalSession>;

export const personalSessionId: (
  sessions: PersonalSessionOverrides[],
  index: number,
) => Ulid = personalSessionCollection.id;

export const personalSessionPage: (
  sessions: PersonalSessionOverrides[],
) => PaginatedResponseForPersonalSession = personalSessionCollection.page;

export const singlePersonalSession: (
  index: number,
  overrides?: PersonalSessionOverrides,
) => SingleResponseForPersonalSession = personalSessionCollection.single;

/**
 * The default set of personal tokens served by the `essPro` deployment.
 *
 * Same clock-independence rule as everywhere else: `PersonalTokenStatusBadge`
 * reads `revoked_at` first and only then compares `expires_at` against
 * `Date.now()`, so "Revoked" and a past `expires_at` ("Expired") never drift,
 * and the active fixture has no `expires_at` at all.
 *
 * Every `actor_user_id` and `owner_user_id` has to be a user fixture's ULID:
 * both the list rows and the detail pane resolve them through
 * `GET /api/admin/v1/users/{id}`.
 */
export const DEFAULT_PERSONAL_SESSIONS: PersonalSessionOverrides[] = [
  {
    human_name: "CI automation",
    scope: "urn:mas:admin urn:matrix:client:api:*",
  },
  {
    human_name: "Retired bridge",
    // Owned by a client rather than a user, so the detail pane renders no owner
    // card and its "Regenerate token" button is the disabled variant.
    owner_user_id: null,
    owner_client_id: clientId(DEFAULT_OAUTH2_CLIENTS, 0),
    actor_user_id: userId(DEFAULT_USERS, 0),
    scope: "urn:synapse:admin:*",
    revoked_at: "2026-07-15T09:00:00.000000Z",
  },
  {
    human_name: "Old migration script",
    // The deactivated user, whose Matrix profile 404s — the row's acting-user
    // cell degrades to a bare Matrix ID, as in the legacy devices list.
    actor_user_id: userId(DEFAULT_USERS, 2),
    scope: "urn:matrix:client:api:*",
    expires_at: "2026-03-01T00:00:00.000000Z",
  },
];

/** Overrides for a federation destination fixture: any `Destination` field. */
export type DestinationOverrides = Partial<Destination>;

/** The deterministic name of an override-free destination fixture at `index`. */
const defaultDestinationName = (index: number): string =>
  `server${index}.example.net`;

/**
 * The name the destination fixture at `index` is served under; an index past
 * the end of `destinations` names a domain no handler serves.
 *
 * A destination is a bare Matrix server name — not a ULID and not a sigil
 * string — and `/federation/known-domains/$destination` passes it straight
 * through to Synapse.
 */
export const destinationName = (
  destinations: DestinationOverrides[],
  index: number,
): string => destinations[index]?.destination ?? defaultDestinationName(index);

/**
 * A single destination, as
 * `GET /_synapse/admin/v1/federation/destinations/{destination}` returns it.
 * Every key of `Destination` is required by the valibot schema — nullable, but
 * present — so the defaults spell all of them out.
 *
 * `retry_last_ts` and `retry_interval` default to 0, which the detail page
 * renders as an em dash: any other value goes through
 * `computeHumanReadableDateTimeStringFromUtc` / `Intl.DurationFormat`, whose
 * output depends on the runner's timezone and locale.
 */
export const singleDestination = (
  index: number,
  overrides: DestinationOverrides = {},
): Destination => ({
  destination: defaultDestinationName(index),
  retry_last_ts: 0,
  retry_interval: 0,
  failure_ts: null,
  last_successful_stream_ordering: 1000 + index,
  ...overrides,
});

/**
 * One page of at most `limit` destinations starting at the offset `from`, as
 * `GET /_synapse/admin/v1/federation/destinations` returns it.
 *
 * Offset pagination as with rooms, except the continuation token comes back in
 * `next_token`, which the schema types as `string | number`. This fixture
 * returns the string form — what Synapse sends here — and is the only place the
 * suite covers that branch of the union.
 *
 * `total` is the whole collection on every page, as with rooms.
 */
export const destinationPageSlice = (
  destinations: DestinationOverrides[],
  from: number,
  limit: number,
): DestinationsListResponse => {
  const slice = destinations.slice(from, from + limit);
  return {
    destinations: slice.map((overrides, index) =>
      singleDestination(from + index, overrides),
    ),
    total: destinations.length,
    ...(from + slice.length < destinations.length && {
      next_token: String(from + slice.length),
    }),
  };
};

/**
 * A page of destinations, as `GET /_synapse/admin/v1/federation/destinations`
 * returns it — the whole collection at once, so there is no `next_token` and
 * the app stops after the first request. This is what every fixture deployment
 * serves.
 */
export const destinationPage = (
  destinations: DestinationOverrides[],
): DestinationsListResponse =>
  destinationPageSlice(destinations, 0, destinations.length);

/**
 * The default set of destinations served by the `essPro` deployment. One
 * fixture per destination status, and all four are clock-independent — the
 * status is derived purely from the three numeric fields, never from
 * `Date.now()`.
 */
export const DEFAULT_DESTINATIONS: DestinationOverrides[] = [
  // No `failure_ts` and a stream ordering: "Working".
  { destination: "matrix.org", last_successful_stream_ordering: 4_812_003 },
  // Failed, and still retrying: "Failing".
  {
    destination: "flaky.example.net",
    retry_last_ts: FIXTURE_EPOCH_MS,
    retry_interval: HOUR_MS,
    failure_ts: FIXTURE_EPOCH_MS - DAY_MS,
  },
  // Failed, but no longer retrying: "Inactive".
  {
    destination: "paused.example.net",
    retry_last_ts: FIXTURE_EPOCH_MS - DAY_MS,
    failure_ts: FIXTURE_EPOCH_MS - 2 * DAY_MS,
  },
  // Never had a successful stream at all: "Never worked".
  {
    destination: "unreachable.example.net",
    last_successful_stream_ordering: null,
  },
];

/**
 * A `/.well-known/matrix/support` document (Matrix spec v1.10). The app's
 * valibot schema for it is not exported, so this mirrors it by hand: every
 * field is optional, and `support_page` must be a valid URL.
 */
export interface ServerSupport {
  contacts?: {
    email_address?: string;
    matrix_id?: string;
    role: string;
  }[];
  support_page?: string;
}

/**
 * Support documents for the fixture destinations, keyed by hostname.
 *
 * Only the destination detail page asks for these, and only for the destination
 * it is showing. Every other fixture destination is absent, so the handler 404s
 * for it and `ContactInfo` renders nothing.
 */
export const DEFAULT_SERVER_SUPPORT: Record<string, ServerSupport> = {
  "matrix.org": {
    contacts: [
      { role: "m.role.admin", email_address: "admin@matrix.org" },
      { role: "m.role.security", matrix_id: "@security:matrix.org" },
    ],
    support_page: "https://matrix.org/support/",
  },
};

/**
 * One entry of the SBG federation allowlist. Like `ServerSupport`, the app's
 * valibot schema for it is not exported, so this mirrors it. `created_at` is a
 * number (epoch ms), not the ISO string every MAS resource uses.
 */
export interface AllowlistEntry {
  server_name: string;
  creator_user_id: string;
  created_at: number;
}

/** The default federation allowlist served by the `essPro` deployment. */
export const DEFAULT_ALLOWLIST: AllowlistEntry[] = [
  {
    server_name: "matrix.org",
    creator_user_id: ADMIN_MXID,
    created_at: FIXTURE_EPOCH_MS,
  },
  // A wildcard pattern, which is the other thing this endpoint accepts.
  {
    server_name: "*.example.net",
    creator_user_id: ADMIN_MXID,
    created_at: FIXTURE_EPOCH_MS + DAY_MS,
  },
];

/** The Matrix ID of the mocked supervision ("adminbot") account. */
export const ADMINBOT_MXID = `@adminbot:${SERVER_NAME}`;

/**
 * The recovery key the mocked supervision config hands out. Exported separately
 * because `secure_passphrase` is nullish on `AdminbotResponse`, and the spec
 * asserts the field's exact value.
 */
export const ADMINBOT_PASSPHRASE =
  "EsTc 8Tzn Kk4W 9Xh2 QpLm 3Rvd 7Ybs Ncw5 Jf6t Gz1q Uh";

/**
 * The ESS supervision configuration, as `GET /_synapse/ess/adminbot` returns it
 * (`AdminbotResponse`).
 *
 * `ui_address` has to be a parseable URL: the schema pipes it through
 * `v.url()`, and the route feeds it to `new URL(...)` when the launch button is
 * clicked. `secure_passphrase` is nullish, and the page renders the
 * "Recovery key" field only when it is present.
 */
export const DEFAULT_ADMINBOT: AdminbotResponse = {
  mxid: ADMINBOT_MXID,
  access_token: "mock-adminbot-access-token",
  device_id: "ADMINBOTDEV01",
  secure_passphrase: ADMINBOT_PASSPHRASE,
  // ESS deploys the supervision UI as part of Element Web; a deployment without
  // it sends no `ui_address`, which is the page's "missing UI address" alert
  // branch.
  ui_address: "https://chat.example.com/",
};
