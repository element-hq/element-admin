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
