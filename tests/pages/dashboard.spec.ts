// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Page } from "@playwright/test";
import { http, HttpResponse } from "msw";

import { heading } from "../helpers";
import { loginAs } from "../mocks/auth";
import {
  DEFAULT_ROOMS,
  DEFAULT_USERS,
  ESS_VERSION,
  type EssProFeedItem,
  LATEST_ESS_PRO_RELEASE,
  LATEST_ESS_RELEASE,
  SERVER_NAME,
  SYNAPSE_VERSION,
} from "../mocks/fixtures";
import {
  ESS_PRO_FEED_URL,
  essProReleaseFeed,
  essVersion,
  githubLatestRelease,
} from "../mocks/matrix";
import { expect, test } from "../mocks/test";

const latestReleaseTile = (page: Page) =>
  page.getByRole("listitem").filter({ hasText: "Latest ESS version" });

interface ProCase {
  name: string;
  /** The version the deployment reports. */
  running: string;
  feed?: readonly EssProFeedItem[];
  /** The "Latest ESS version" tile's value. */
  tile: string;
}

const PRO_CASES: ProCase[] = [
  {
    name: "a mainline deployment which is behind",
    running: "26.9.1",
    tile: `
      - definition:
        - /children: equal
        - link "26.10.0":
          - /url: https://docs.example.com/ess-pro#26.10.0
        - text: (New release)
    `,
  },
  {
    name: "a mainline deployment which is up to date",
    running: "26.10.0",
    tile: `
      - definition:
        - /children: equal
        - link "26.10.0":
          - /url: https://docs.example.com/ess-pro#26.10.0
        - text: (You're running the latest version)
    `,
  },
  {
    name: "a release candidate of the latest mainline release",
    running: "26.10.0-rc1",
    tile: `
      - definition:
        - /children: equal
        - link "26.10.0":
          - /url: https://docs.example.com/ess-pro#26.10.0
        - text: (New release)
    `,
  },
  {
    name: "a release on an LTS stream which is not an LTS release itself",
    running: "26.4.0",
    tile: `
      - definition:
        - /children: equal
        - link "26.10.0":
          - /url: https://docs.example.com/ess-pro#26.10.0
        - text: (New release)
    `,
  },
  {
    name: "a mainline deployment whose stream turned LTS",
    running: "26.10.6",
    feed: ["ESS Pro LTS 26.10.7 (2026-11-20)", "ESS Pro 26.10.6 (2026-11-11)"],
    tile: `
      - definition:
        - /children: equal
        - link "26.10.7":
          - /url: https://docs.example.com/ess-pro#26.10.7
        - text: (New release)
    `,
  },
  {
    name: "the latest LTS stream, behind",
    running: "26.4.9+lts",
    tile: `
      - definition:
        - /children: equal
        - link "26.4.10":
          - /url: https://docs.example.com/ess-pro#26.4.10
        - text: (New LTS release)
    `,
  },
  {
    name: "the latest LTS stream, up to date",
    running: "26.4.10+lts",
    tile: `
      - definition:
        - /children: equal
        - link "26.4.10":
          - /url: https://docs.example.com/ess-pro#26.4.10
        - text: (You're running the latest LTS release)
    `,
  },
  {
    name: "an older LTS stream, behind",
    running: "25.10.13+lts",
    tile: `
      - definition:
        - /children: equal
        - link "25.10.14":
          - /url: https://docs.example.com/ess-pro#25.10.14
        - text: (New LTS release)
        - link "26.4":
          - /url: https://docs.example.com/ess-pro#26.4.10
        - text: is the latest LTS stream
    `,
  },
  {
    name: "an older LTS stream, up to date",
    running: "25.10.14+lts",
    tile: `
      - definition:
        - /children: equal
        - link "25.10.14":
          - /url: https://docs.example.com/ess-pro#25.10.14
        - text: (You're running the latest LTS release)
        - link "26.4":
          - /url: https://docs.example.com/ess-pro#26.4.10
        - text: is the latest LTS stream
    `,
  },
  {
    name: "the oldest of three LTS streams",
    running: "25.4.19+lts",
    tile: `
      - definition:
        - /children: equal
        - link "25.4.19":
          - /url: https://docs.example.com/ess-pro#25.4.19
        - text: (You're running the latest LTS release)
        - link "26.4":
          - /url: https://docs.example.com/ess-pro#26.4.10
        - text: is the latest LTS stream
    `,
  },
  {
    name: "an LTS stream the feed no longer lists",
    running: "24.10.20+lts",
    tile: `
      - definition:
        - /children: equal
        - link "26.4":
          - /url: https://docs.example.com/ess-pro#26.4.10
        - text: is the latest LTS stream
    `,
  },
];

test.describe("dashboard", () => {
  test("renders the mocked counts and versions", async ({ page }) => {
    await loginAs(page);
    await page.goto("/");

    await expect(page.getByRole("heading", heading("Dashboard"))).toBeVisible();
    await expect(
      page.getByRole("heading", { name: SERVER_NAME, level: 2 }),
    ).toBeVisible();

    // Each tile is its own suspense boundary, so all of them are asserted: a
    // tile still loading or errored would drop out of the snapshot.
    const tiles = page.getByRole("list").filter({ hasText: "ESS version" });
    await expect(tiles).toMatchAriaSnapshot(`
      - list:
        - listitem:
          - term: ESS version
          - definition: ${ESS_VERSION}
        - listitem:
          - term: Latest ESS version
          - definition:
            - link "${LATEST_ESS_PRO_RELEASE}"
            - text: (New release)
        - listitem:
          - term: Synapse version
          - definition: ${SYNAPSE_VERSION}
        - listitem:
          - term: Rooms total
          - definition: "${DEFAULT_ROOMS.length}"
        - listitem:
          - term: Users registered
          - definition: "${DEFAULT_USERS.length}"
    `);
  });

  test.describe("latest ESS release on ESS Pro", () => {
    for (const { name, running, feed, tile } of PRO_CASES) {
      test(`for ${name}`, async ({ page, network }) => {
        let githubRequests = 0;
        network.use(
          essVersion(running, "pro"),
          essProReleaseFeed(feed),
          githubLatestRelease(() => {
            githubRequests += 1;
          }),
        );

        await loginAs(page);
        await page.goto("/");

        await expect(page.getByRole("definition").first()).toHaveText(running);
        await expect(
          latestReleaseTile(page).getByRole("definition"),
        ).toMatchAriaSnapshot(tile);
        expect(githubRequests).toBe(0);
      });
    }

    for (const [name, handler] of [
      [
        "the feed fails to load",
        http.get(
          ESS_PRO_FEED_URL,
          () => new HttpResponse(null, { status: 500 }),
        ),
      ],
      [
        "no feed title is recognised",
        essProReleaseFeed(["ESS Pro release notes have moved"]),
      ],
    ] as const) {
      test(`degrades only the tile when ${name}`, async ({ page, network }) => {
        network.use(handler);

        await loginAs(page);
        await page.goto("/");

        const tile = latestReleaseTile(page);
        await expect(tile.getByText("Failed to load")).toBeVisible();
        await expect(page.getByText("Failed to load")).toHaveCount(1);
        await expect(page.getByText(SYNAPSE_VERSION)).toBeVisible();
      });
    }
  });

  test.describe("latest ESS release on ESS Community", () => {
    test.use({ deployment: "essCommunity" });

    test("compares against the GitHub release, not the Pro feed", async ({
      page,
      network,
    }) => {
      let feedRequests = 0;
      network.use(
        essProReleaseFeed(undefined, () => {
          feedRequests += 1;
        }),
      );

      await loginAs(page);
      await page.goto("/");

      await expect(latestReleaseTile(page)).toMatchAriaSnapshot(`
        - listitem:
          - term: Latest ESS version
          - definition:
            - /children: equal
            - link "${LATEST_ESS_RELEASE}":
              - /url: https://github.com/element-hq/ess-helm/releases/tag/${LATEST_ESS_RELEASE}
            - text: (New release)
      `);
      expect(feedRequests).toBe(0);
    });
  });
});
