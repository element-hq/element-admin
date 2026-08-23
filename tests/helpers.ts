// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * `getByRole("heading", …)` options for a page title. Every page title is also
 * a sidebar link or a tab, so an assertion on it has to go through the `h1`
 * rather than matching text anywhere on the page.
 */
export const heading = (name: string) =>
  ({ name, exact: true, level: 1 }) as const;
