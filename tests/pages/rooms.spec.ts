// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { drawer, heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import { DEFAULT_ROOMS, roomId } from "../mocks/fixtures";
import { expect, test } from "../mocks/test";

const roomsHeading = "Rooms";

test.describe("rooms", () => {
  test("lists the mocked rooms", async ({ page }) => {
    await loginAs(page);
    await page.goto("/rooms");

    await expect(
      page.getByRole("heading", heading(roomsHeading)),
    ).toBeVisible();

    // The third room has neither a name nor an alias, so its display name comes
    // from the members endpoint and its alias cell falls back to the room ID.
    await expect(page.getByRole("grid")).toMatchAriaSnapshot(`
      - grid "3 rooms":
        - rowgroup:
          - row "Room Alias Members Type"
        - rowgroup:
          - row:
            - gridcell:
              - link:
                - paragraph: General
            - gridcell "#general:example.com"
            - gridcell "Public"
          - row:
            - gridcell:
              - link:
                - paragraph: Element Space
            - gridcell "Restricted"
          - row:
            - gridcell:
              - link:
                - paragraph: Admin, Alice
            - gridcell "!room2:example.com"
            - gridcell "Private"
    `);
  });

  test("shows a room's details", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/rooms/${encodeURIComponent(roomId(DEFAULT_ROOMS, 0))}`);

    // The detail page is a drawer over the list, so the list is still there.
    await expect(
      page.getByRole("heading", heading(roomsHeading)),
    ).toBeVisible();

    const pane = drawer(page, page.getByRole("button", { name: "Delete" }));

    // `topic` and `history_visibility` come back only from the room detail
    // endpoint, so they distinguish the drawer from the list row behind it.
    await expect(pane).toMatchAriaSnapshot(`
      - heading "General" [level=3]
      - paragraph: "#general:example.com"
      - paragraph: "!room0:example.com"
      - paragraph: Everything and anything
      - button "Delete"
      - list:
        - listitem:
          - term: History Visibility
          - definition: World Readable
    `);
  });

  test("shows a not-found alert for an unknown room", async ({ page }) => {
    await loginAs(page);
    // Room IDs are not ULIDs and this route has no ULID guard, so an unknown
    // but well-formed room ID reaches Synapse, which 404s.
    await page.goto(
      `/rooms/${encodeURIComponent(roomId(DEFAULT_ROOMS, 9999))}`,
    );

    await expect(page.getByText("Room not found")).toBeVisible();
  });
});
