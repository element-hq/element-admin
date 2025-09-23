// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
