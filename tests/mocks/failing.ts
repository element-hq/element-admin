// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/**
 * Handlers that make one endpoint fail. Prepend one with `network.use()` to
 * break a single query without building a whole deployment for it.
 *
 * Reads are `GET` and take a status and a body; `masFailingPost` covers the
 * mutation paths, where only the status matters.
 */

import {
  http,
  HttpResponse,
  type JsonBodyType,
  type RequestHandler,
} from "msw";

import type { ErrorResponse } from "@/api/mas/api";

import { masError } from "./fixtures";
import { matrixError } from "./matrix";

/**
 * A family of failing handlers sharing one default body. A string body is not
 * JSON, so the client rethrows the raw text instead of a decoded error, which
 * is the other branch of both API clients' error handling.
 */
const failingWith =
  <B extends JsonBodyType>(defaultBody: B) =>
  (
    path: string,
    status = 500,
    body: B | string = defaultBody,
  ): RequestHandler =>
    http.get(`*${path}`, () =>
      typeof body === "string"
        ? new HttpResponse(body, {
            status,
            headers: { "Content-Type": "text/plain" },
          })
        : HttpResponse.json(body, { status }),
    );

/**
 * Any MAS admin `GET` endpoint, made to fail.
 *
 * A `masError(...)` object is what the generated client decodes into
 * `result.error`, so the thrown value is a plain object and `RenderError`
 * stringifies it into the error page's technical details; a string body takes
 * `RenderError`'s `String(error)` fallback instead.
 */
export const masFailing = failingWith<ErrorResponse>(
  masError("Something went wrong"),
);

/**
 * A MAS admin mutation endpoint, made to fail. The path takes msw parameters,
 * e.g. `/api/admin/v1/personal-sessions/:id/revoke`.
 */
export const masFailingPost = (path: string, status = 500): RequestHandler =>
  http.post(`*${path}`, () =>
    HttpResponse.json(masError("Something went wrong"), { status }),
  );

/**
 * Any Synapse `GET` endpoint, made to fail.
 *
 * A `matrixError(...)` object decodes, so the app throws a
 * `MatrixStandardError` and the error page shows the errcode and the server's
 * message; a string body does not decode, so the original `HttpStatusError` is
 * rethrown and the page shows "…failed with status code {status}".
 *
 * A 404 with `M_NOT_FOUND` is not an error path — `ensureNotError(…, true)`
 * turns it into `notFound()` — so use another status or another errcode to
 * reach the error UI.
 */
export const matrixFailing = failingWith(
  matrixError("M_UNKNOWN", "Internal server error"),
);
