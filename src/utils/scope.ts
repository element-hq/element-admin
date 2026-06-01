// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

// Device scopes are suffixed with the device ID. MAS supports both the stable
// prefix and the legacy MSC2967 one
const DEVICE_SCOPE_PREFIXES = [
  "urn:matrix:client:device:",
  "urn:matrix:org.matrix.msc2967.client:device:",
];

export const scopeTokens = (scope: string): string[] =>
  scope.split(" ").filter(Boolean);

// Extract the Matrix device ID out of an OAuth 2.0 session scope, if any
export const deviceIdFromScope = (scope: string): string | undefined => {
  for (const token of scopeTokens(scope)) {
    for (const prefix of DEVICE_SCOPE_PREFIXES) {
      if (token.length > prefix.length && token.startsWith(prefix)) {
        return token.slice(prefix.length);
      }
    }
  }
  return undefined;
};
