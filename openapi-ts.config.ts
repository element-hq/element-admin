// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input:
    "http://element-hq.github.io/matrix-authentication-service/api/spec.json",

  output: {
    path: "src/api/mas/api",
    postProcess: ["oxfmt", "oxlint"],
  },

  parser: {
    pagination: {
      keywords: ["page[first]", "page[last]", "page[before]", "page[after]"],
    },

    patch: {
      schemas: {
        User: (schema) => {
          // Make the 'legacy_guest' flag on users optional, as it was
          // introduced in MAS 1.3.0
          schema.required = schema.required
            ? schema.required.filter((property) => property !== "legacy_guest")
            : undefined;
        },

        SiteConfig: (schema) => {
          // Only make the `server_name` required, rest can be optional
          schema.required = ["server_name"];
        },
      },
    },
  },

  plugins: [
    {
      name: "@hey-api/client-fetch",
    },
    {
      name: "@hey-api/sdk",
      // Use valibot for response validations
      validator: "valibot",
      // Force passing the client as parameter
      client: false,
    },
  ],
});
