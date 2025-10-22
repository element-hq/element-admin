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

        PersonalSession: (schema) => {
          if (!schema.properties)
            throw new Error("PersonalSession schema has no properties");

          // openapi-ts doesn't like the nullable ref, so we make this a string
          // instead instead of the reference to the ULID type
          schema.properties["owner_user_id"] = {
            description:
              "The ID of the user who owns this session (if user-owned)",
            type: "string",
            nullable: true,
          };
          schema.properties["owner_client_id"] = {
            description:
              "The ID of the `OAuth2` client who owns this session (if client-owned)",
            type: "string",
            nullable: true,
          };
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
