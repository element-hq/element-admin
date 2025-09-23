// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input:
    "http://element-hq.github.io/matrix-authentication-service/api/spec.json",

  output: {
    path: "src/api/mas/api",
    format: "prettier",
    lint: "eslint",
  },

  parser: {
    pagination: {
      keywords: ["page[first]", "page[last]", "page[before]", "page[after]"],
    },

    patch: {
      // The schema lies. We advertise OpenAPI 3.1.0 but use "nullable" which is
      // a 3.0.0 thing and removed in 3.1.0
      version: "3.0.0",

      schemas: {
        User: (schema) => {
          // Make the 'legacy_guest' flag on users optional, as it was
          // introduced in MAS 1.3.0
          schema.required = schema.required
            ? schema.required.filter((property) => property !== "legacy_guest")
            : undefined;
        },
      },
    },
  },

  plugins: [
    {
      name: "@hey-api/client-fetch",
      // Throw when an error occurs
      throwOnError: true,
    },
    {
      name: "@hey-api/sdk",
      // Use valibot for response validations
      validator: "valibot",
      // Only reply with the data
      responseStyle: "data",
      // Force passing the client as parameter
      client: false,
    },
  ],
});
