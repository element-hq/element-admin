// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { Locator, Page } from "@playwright/test";

/**
 * A detail drawer is an unnamed `<section>` over its list — no landmark role,
 * no heading of its own — so it can only be found through something rendered
 * exclusively inside it.
 */
export const drawer = (page: Page, anchor: Locator): Locator =>
  page.locator("section").filter({ has: anchor }).last();

/**
 * `getByRole("heading", …)` options for a page title. Every page title is also
 * a sidebar link or a tab, so an assertion on it has to go through the `h1`
 * rather than matching text anywhere on the page.
 */
export const heading = (name: string) =>
  ({ name, exact: true, level: 1 }) as const;
