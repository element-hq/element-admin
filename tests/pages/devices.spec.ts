// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * The three devices tabs. The whole section is gated on MAS >= 1.20, so every
 * route here is a not-found on an older one.
 */

import { drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  clientId,
  compatSessionId,
  DEFAULT_COMPAT_SESSIONS,
  DEFAULT_OAUTH2_CLIENTS,
  DEFAULT_OAUTH2_SESSIONS,
  oauth2SessionId,
  SERVER_NAME,
  ulid,
} from "../mocks/fixtures";
import { observeQuery } from "../mocks/mas";
import { expect, test } from "../mocks/test";

const userDevicesHeading = "User devices";
const applicationsHeading = "Applications";
const legacyDevicesHeading = "Legacy devices";

test.describe("devices", () => {
  test("lists the mocked devices", async ({ page }) => {
    await loginAs(page);
    await page.goto("/devices/user");

    await expect(
      page.getByRole("heading", heading(userDevicesHeading)),
    ).toBeVisible();
    // The fixtures only use the two clock-independent badge states: a null
    // `last_active_at` renders "Never used" and a `finished_at` renders
    // "Signed out". The third session's application has no name, so its cell
    // shows the raw client ID.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "3 devices":
        - rowgroup:
          - row "Device Application User Status"
        - rowgroup:
          - row:
            - gridcell:
              - link:
                - paragraph: Alice's laptop
                - paragraph: ELEMENTWEB01
            - gridcell:
              - paragraph: Element Web
            - gridcell:
              - paragraph: Alice
              - paragraph: "@alice:${SERVER_NAME}"
            - gridcell "Never used"
          - row:
            - gridcell:
              - link:
                - paragraph: iPhone 14
                - paragraph: ELEMENTX0001
            - gridcell:
              - paragraph: Element X
            - gridcell:
              - paragraph: Alice
            - gridcell "Signed out"
          - row:
            - gridcell:
              - link:
                - paragraph: Unknown device
            - gridcell:
              - paragraph: "${clientId(DEFAULT_OAUTH2_CLIENTS, 2)}"
            - gridcell "No user"
            - gridcell "Never used"
    `);
  });

  test("shows a device's details", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/devices/user/${oauth2SessionId(DEFAULT_OAUTH2_SESSIONS, 0)}`,
    );

    // The detail page is a drawer over the list, so the list is still there.
    await expect(
      page.getByRole("heading", heading(userDevicesHeading)),
    ).toBeVisible();

    // The remove button is in the drawer only, and only because this session
    // has no `finished_at`.
    const detail = drawer(
      page,
      page.getByRole("button", { name: "Remove device" }),
    );

    // The user and the application cards come from side queries on the
    // session's `user_id` and `client_id`, so they show a resolved name rather
    // than the bare identifier.
    await expect(detail).toMatchAriaSnapshot(`
      - heading "Alice's laptop" [level=3]
      - paragraph: Chrome 140.0.0.0 · macOS
      - text: Never used
      - link:
        - paragraph: Alice
        - paragraph: "@alice:${SERVER_NAME}"
      - link:
        - paragraph: Element Web
      - list:
        - listitem:
          - term: Device ID
          - definition: ELEMENTWEB01
    `);
  });

  test("shows a not-found alert for an unknown device", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/devices/user/${ulid(9999)}`);

    await expect(page.getByText("Device not found")).toBeVisible();
  });

  test("lists the mocked applications", async ({ page }) => {
    await loginAs(page);
    await page.goto("/devices/applications");

    await expect(
      page.getByRole("heading", heading(applicationsHeading)),
    ).toBeVisible();
    // The third client has neither a name nor a homepage, so its row falls back
    // to the raw client ID.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "3 applications":
        - rowgroup:
          - row "Name"
        - rowgroup:
          - row:
            - gridcell:
              - link:
                - paragraph: Element Web
                - paragraph: https://app.element.io/
          - row:
            - gridcell:
              - link:
                - paragraph: Element X
          - row:
            - gridcell:
              - link:
                - paragraph: "${clientId(DEFAULT_OAUTH2_CLIENTS, 2)}"
    `);
  });

  test("shows an application's details", async ({ page, network }) => {
    // The three statistics counts differ only in the filters they carry, and
    // the mocked collection ignores those, so the emitted parameters are the
    // only thing that tells the tiles apart.
    const counts: string[] = [];
    network.use(
      observeQuery("/api/admin/v1/oauth2-sessions", (parameters) => {
        if (parameters.get("count") !== "only") return;
        // The two `-after` bounds derive from the current clock, so a shape
        // keeps the key and drops the value.
        counts.push(
          [...new Set(parameters.keys())]
            .filter((key) => key.startsWith("filter["))
            .map((key) =>
              key.endsWith("-after]")
                ? key
                : `${key}=${parameters.getAll(key).join(",")}`,
            )
            .toSorted()
            .join(" "),
        );
      }),
    );

    await loginAs(page);
    await page.goto(
      `/devices/applications/${clientId(DEFAULT_OAUTH2_CLIENTS, 0)}`,
    );

    await expect(
      page.getByRole("heading", heading(applicationsHeading)),
    ).toBeVisible();

    const detail = drawer(
      page,
      page.getByRole("link", { name: "View all devices" }),
    );

    await expect(detail).toMatchAriaSnapshot(`
      - heading "Element Web" [level=3]
      - list:
        - listitem:
          - term: Client ID
          - definition: "${clientId(DEFAULT_OAUTH2_CLIENTS, 0)}"
        - listitem:
          - term: Homepage
          - definition:
            - link "https://app.element.io/"
        - listitem:
          - term: Redirect URIs
          - definition: https://app.element.io/
        - listitem:
          - term: Grant types
          - definition: authorization_code
          - definition: refresh_token
      - heading "Device statistics" [level=4]
    `);

    // Three separately-filtered device counts, each in its own suspense
    // boundary.
    await expect(detail.getByRole("list").filter({ hasText: "Active devices" }))
      .toMatchAriaSnapshot(`
      - list:
        - listitem:
          - term: Active devices
          - definition: "${DEFAULT_OAUTH2_SESSIONS.length}"
        - listitem:
          - term: Devices added in the past 7 days
          - definition: "${DEFAULT_OAUTH2_SESSIONS.length}"
        - listitem:
          - term: Active in the past 7 days
          - definition: "${DEFAULT_OAUTH2_SESSIONS.length}"
    `);

    // All three narrow to this application; on top of that one asks for active
    // devices, one for recently created ones, and one for both.
    const client = clientId(DEFAULT_OAUTH2_CLIENTS, 0);
    await expect
      .poll(() => counts.toSorted())
      .toEqual([
        `filter[client]=${client} filter[created-after]`,
        `filter[client]=${client} filter[last-active-after] filter[status]=active`,
        `filter[client]=${client} filter[status]=active`,
      ]);
  });

  test("shows a not-found alert for an unknown application", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(`/devices/applications/${ulid(9999)}`);

    await expect(page.getByText("Application not found")).toBeVisible();
  });

  test("lists the mocked legacy devices", async ({ page }) => {
    await loginAs(page);
    await page.goto("/devices/legacy");

    await expect(
      page.getByRole("heading", heading(legacyDevicesHeading)),
    ).toBeVisible();
    // The first row has neither a human name nor a user-agent, so the device ID
    // is both the name and the ID line. The second belongs to the deactivated
    // user, whose Matrix profile 404s, so his cell is a bare Matrix ID.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "2 legacy devices":
        - rowgroup:
          - row "Device User Status"
        - rowgroup:
          - row:
            - gridcell:
              - link:
                - paragraph: LEGACYWEB01
                - paragraph: LEGACYWEB01
            - gridcell:
              - paragraph: Alice
              - paragraph: "@alice:${SERVER_NAME}"
            - gridcell "Never used"
          - row:
            - gridcell:
              - link:
                - paragraph: Riot on Android
                - paragraph: LEGACYAND01
            - gridcell:
              - paragraph: "@bob:${SERVER_NAME}"
            - gridcell "Signed out"
    `);
  });

  test("shows a legacy device's details", async ({ page }) => {
    await loginAs(page);
    await page.goto(
      `/devices/legacy/${compatSessionId(DEFAULT_COMPAT_SESSIONS, 0)}`,
    );

    await expect(
      page.getByRole("heading", heading(legacyDevicesHeading)),
    ).toBeVisible();

    const detail = drawer(
      page,
      page.getByRole("button", { name: "Remove device" }),
    );

    // No human name and no user-agent, so the device ID is the heading too.
    await expect(detail).toMatchAriaSnapshot(`
      - heading "LEGACYWEB01" [level=3]
      - text: Never used
      - link:
        - paragraph: Alice
        - paragraph: "@alice:${SERVER_NAME}"
      - list:
        - listitem:
          - term: Device ID
          - definition: LEGACYWEB01
    `);
  });

  test("shows a not-found alert for an unknown legacy device", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(`/devices/legacy/${ulid(9999)}`);

    await expect(page.getByText("Legacy device not found")).toBeVisible();
  });
});
