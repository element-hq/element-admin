// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

// Add a timeout (in milliseconds) to the given AbortSignal
export function addTimeout(
  signal: AbortSignal | undefined,
  delay: number,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(delay);

  if (signal) {
    return AbortSignal.any([signal, timeoutSignal]);
  }

  return timeoutSignal;
}
