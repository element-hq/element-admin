// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  defineMessage,
  type MessageDescriptor,
  type PrimitiveType,
} from "react-intl";

// Enforce that the error messages are in the `errors.` namespace
interface ErrorMessageDescriptor extends MessageDescriptor {
  id: MessageDescriptor["id"] & `errors.${string}`;
}

/**
 * An abstract localized error, which is used to display errors in the user-selected language.
 *
 * Implementers must define the `localizedMessage` property using the `defineMessage` helper, and may
 * optionally define the `localizedValues` getter, to fill in the values for the message.
 *
 * All errors must use the `errors.*` namesapce
 */
export abstract class LocalizedError extends Error {
  abstract readonly localizedMessage: ErrorMessageDescriptor;
  protected values: Record<string, PrimitiveType> = {};
  get localizedValues(): Readonly<Record<string, PrimitiveType>> {
    return this.values;
  }
}

export class NotLoggedInError extends LocalizedError {
  localizedMessage = defineMessage({
    id: "errors.not_logged_in",
    defaultMessage: "Not logged in",
    description:
      "Error message when a request was sent which was supposed to be authenticated, but turns out that the user is not logged in. This is a rare error, usually because of a race-condition during login or logout.",
  });

  constructor(options?: ErrorOptions) {
    super("Not logged in", options);
  }
}

export class HttpStatusError extends LocalizedError {
  localizedMessage = defineMessage({
    id: "errors.http_status",
    defaultMessage:
      "Request to {url} failed with status code {status} {statusText}",
    description:
      "Generic error message when we fail to make a request to the specified URL. Typical values for 'status' are '404' or '500', typical values for 'statusText' are 'Not Found' or 'Internal Server Error'",
  });

  constructor(response: Response, options?: ErrorOptions) {
    super(
      `Request to ${response.url} failed with status code ${response.status} ${response.statusText}`,
      options,
    );
    this.values = {
      status: response.status,
      statusText: response.statusText,
      url: response.url.toString(),
    };
  }
}

export class FetchError extends LocalizedError {
  localizedMessage = defineMessage({
    id: "errors.http_fetch",
    defaultMessage: "Request to {url} failed",
    description:
      "Generic error message when we fail to make a request to the specified URL",
  });

  constructor(url: string | URL, options?: ErrorOptions) {
    super(`Request to ${url} failed`, options);
    this.values = {
      url: url.toString(),
    };
  }
}

export class FetchJsonDecodingError extends LocalizedError {
  localizedMessage = defineMessage({
    id: "errors.http_fetch_json_decoding",
    defaultMessage: "Failed to decode JSON response from {url}",
    description:
      "Error message when we fail to decode a JSON response from the specified URL",
  });

  constructor(url: string | URL, options?: ErrorOptions) {
    super(`Failed to decode JSON response from ${url}`, options);
    this.values = {
      url: url.toString(),
    };
  }
}
