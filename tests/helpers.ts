// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * A detail drawer is a labelled `<section>`, i.e. a `region` landmark, over
 * its list. The anchor — something rendered exclusively inside the drawer —
 * keeps the lookup unambiguous on pages with other named regions.
 */
export const drawer = (page: Page, anchor: Locator): Locator =>
  page.getByRole("region").filter({ has: anchor });

/**
 * `getByRole("heading", …)` options for a page title. Every page title is also
 * a sidebar link or a tab, so an assertion on it has to go through the `h1`
 * rather than matching text anywhere on the page.
 */
export const heading = (name: string) =>
  ({ name, exact: true, level: 1 }) as const;

/** The sidebar is the only `<nav>` in the console layout. */
export const navEntry = (page: Page, name: string): Locator =>
  page.getByRole("navigation").getByRole("link", { name, exact: true });

/**
 * `DataTable.List` renders one row beyond the data, the column headers, so the
 * number of data rows is the row count minus one. There is no empty-table
 * placeholder, so an empty list is `count` 0.
 */
export const expectRowCount = async (
  page: Page,
  count: number,
): Promise<void> => {
  await expect(page.getByRole("row")).toHaveCount(count + 1);
};

/** The SBG allowlist page's subtitle, which identifies that federation tab. */
export const ALLOWLIST_SUBTITLE =
  "List of patterns allowed to federate with you";
