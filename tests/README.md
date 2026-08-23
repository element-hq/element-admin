<!--
SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
-->

# Playwright tests

These tests drive the whole console with no backend behind it: [MSW](https://mswjs.io/)
intercepts every request through [`@msw/playwright`](https://github.com/mswjs/playwright),
with the resolvers running in the Node test process, so nothing mock-related
ships in the app bundle.

## Running the tests

On a dev machine:

```sh
pnpm build && pnpm test --grep-invert "@screenshot"
```

Skip `@screenshot` locally: those baselines come from CI's Linux container and
never match local font rendering. Everything else is untagged and runs in the
`desktop-light` project only. CI runs the whole suite, `pnpm build && pnpm test`,
against the built `dist/`.

The a11y scans assert the exact axe rules each page is known to trip, with a
comment on the cause. Fixing a defect fails the scan until its rule leaves the
expected list, and a regression shows up as a new rule on an otherwise clean
page. Any scan that finds violations attaches the full axe report to the test
results, offending selectors included.

### Driving a containerised browser

Reproduces CI, and is required to regenerate screenshots. With a Playwright
server listening on `:3000`:

```sh
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:3000/ \
PW_TEST_CONNECT_EXPOSE_NETWORK='<loopback>' \
  pnpm test
```

Keep `exposeNetwork` as written: it lets the containerised browser reach this
machine's `http://127.0.0.1:4173`, a secure context, which login needs because
PKCE uses `crypto.subtle`. The config refuses to start against a non-secure
origin such as `host.docker.internal`.

### Regenerating screenshots

```sh
pnpm build
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:3000/ \
PW_TEST_CONNECT_EXPOSE_NETWORK='<loopback>' \
  pnpm test -g "@screenshot" --update-snapshots
```

Use the same container image CI uses (`mcr.microsoft.com/playwright`, at the
version pinned in `package.json`); the baselines depend on its font rendering.
Timezone and locale are pinned in the config, so fixture dates render the same
everywhere.

The `@screenshot` tag runs a test in all six projects, so each one costs six
baselines. Only the login-page shot actually takes all six: it makes no
cross-origin request. The console shots skip every browser but Chromium, since
WebKit applies CORS to mocked responses and silently degrades the pages, and the
tablet and mobile projects run WebKit.

## Writing a test

Specs live in `tests/pages/`, one per console section plus the cross-cutting
ones (accessibility, deployments, empty states, error states, filters, misc,
pagination, screenshots); the login page is covered there with everything else.

Import `test` and `expect` from `../mocks/test`, never from `@playwright/test`,
or the network fixture is not installed. Start each test with `loginAs(page)`,
which writes static credentials through a debug hook rather than driving the
OAuth 2 flow, then `page.goto()` the route.

Assert the heading plus at least one piece of mocked data — the data is what
proves the page rendered your fixtures rather than a fallback or an error tile.
A detail page is a drawer over its list, so both are on screen: scope drawer
assertions with `drawer(page, anchor)` from `tests/helpers.ts`, passing
something rendered only inside the drawer, such as one of its action buttons.

If an endpoint has no handler yet, add fixtures to `mocks/fixtures.ts` and a
handler factory to `mocks/mas.ts` or `mocks/matrix.ts`, following the existing
style. Type MAS bodies with `satisfies` against `@/api/mas/api`; the generated
SDK also validates them with valibot at runtime, so a drifting fixture fails
loudly in the browser.

### Picking a deployment

A deployment is the handler set for one kind of server. Pick one per spec or
describe block:

```ts
test.use({ deployment: "plainMas" }); // "essPro" (default) | "essCommunity" | "plainMas"
```

The two gating axes are independent: the ESS edition (`/_synapse/ess/version`)
gates the ESS-only surfaces, the MAS version (`/api/admin/v1/version`) gates
`/devices` and the personal-tokens nav entry. All three deployments live in the
`deployments` record in `mocks/handlers.ts`.

### Overriding a handler

For a one-off scenario — an empty collection, a failing endpoint — override in
the test rather than adding a deployment. `network.use()` prepends, so the
override wins, and it is synchronous: don't await it.

```ts
network.use(usersList([])); // empty state
network.use(masFailing("/api/admin/v1/users")); // 500
```

Resolvers are plain closures running in the test process, so an override can
close over test-local state and record what the app asked for; that is how the
filters and pagination specs assert on emitted query parameters. The paginated
handlers take a callback for it, and `observeQuery` records a request and then
returns nothing, so the deployment's own handler still answers it. A closure is
the only way to do this: `network.events` no longer fires on msw 2.13 and later.

## Reference

```
mocks/
  test.ts       extended `test` — the `deployment` option and an auto `network` fixture
  handlers.ts   the deployments
  mas.ts        MAS admin API handlers
  matrix.ts     Matrix C-S, Synapse admin, ESS and GitHub handlers
  fixtures.ts   deterministic data factories
  auth.ts       loginAs()
helpers.ts      shared locators
pages/          the specs
__screenshots__/  the baselines, one directory per spec
```

Things that bite:

- Strict mode is on: `onUnhandledRequest` fails the test and names the URL for
  any request with no handler, except a `blob:` or `data:` URL the page minted
  for itself.
- Mutations are not mocked, so a test that submits a POST/PUT/DELETE fails under
  strict mode. Mocking them needs per-test mutable state, since the app refetches
  after a mutation and the refetch has to show the change; a stateless mutation
  handler makes a broken flow look green.
- List pages need the detail handlers of related collections: rows fire per-row
  queries (room rows fetch room detail and members, device rows fetch the
  client, personal-token rows fetch the user and its profile).
- Some queries fire regardless of feature gating, so their endpoints need a
  handler in every deployment even where the feature is off: the adminbot
  prefetch, the federation allowlist probe, the dashboard's GitHub release query.
- `count=only` is a separate request with a different shape, `{ meta: { count } }`
  and no `data`.
- Keep fixtures clock- and locale-independent: no future expiry dates, and no
  assertions on formatted timestamps or durations.
- IDs derive from a fixture's array index (`ulid(i)`), so reordering an array
  changes identities. Filter by selecting indices, don't slice.
