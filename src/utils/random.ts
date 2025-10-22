// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * Generates a random string of specified length using alphanumeric characters.
 * @param length The length of the random string to generate
 * @returns A random string containing uppercase, lowercase, and numeric characters
 */
export function randomString(length: number): string {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint8Array(length);
  globalThis.crypto.getRandomValues(randomValues);

  let result = "";
  for (const value of randomValues) {
    result += possible[value % possible.length];
  }
  return result;
}
