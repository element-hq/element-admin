// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { FetchError, FetchJsonDecodingError, HttpStatusError } from "@/errors";

/* Our cursom fetch function, which wraps the errors with the original request URL */
export const fetch: typeof globalThis.fetch = async (
  request: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url: string | URL = request instanceof Request ? request.url : request;
  let response;
  try {
    response = await globalThis.fetch(request, init);
  } catch (error) {
    throw new FetchError(url, { cause: error });
  }

  // Monkey-patch response.json to wrap our own error type
  const originalJson = response.json.bind(response);
  response.json = async function (...parameters) {
    try {
      return await originalJson(...parameters);
    } catch (error) {
      throw new FetchJsonDecodingError(url, { cause: error });
    }
  };

  return response;
};

export const ensureResponseOk = (response: Response) => {
  if (!response.ok) {
    throw new HttpStatusError(response);
  }
};
