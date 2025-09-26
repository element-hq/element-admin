// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import js from "@eslint/js";
import * as tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import * as reactHooksPlugin from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "eslint-plugin-react-refresh";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import * as importXPlugin from "eslint-plugin-import-x";
import unicornPlugin from "eslint-plugin-unicorn";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tanstackRouterPlugin from "@tanstack/eslint-plugin-router";
import tanstackQueryPlugin from "@tanstack/eslint-plugin-query";
import compatPlugin from "eslint-plugin-compat";
// eslint-disable-next-line import-x/default -- The exported types are wrong
import formatjsPlugin from "eslint-plugin-formatjs";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  reactHooksPlugin.configs["recommended-latest"],
  reactRefreshPlugin.configs.vite,
  jsxA11yPlugin.flatConfigs.strict,
  importXPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.typescript,
  importXPlugin.flatConfigs.react,
  unicornPlugin.configs.recommended,
  tanstackRouterPlugin.configs["flat/recommended"],
  tanstackQueryPlugin.configs["flat/recommended"],
  formatjsPlugin.configs.strict,
  eslintConfigPrettier,
  compatPlugin.configs["flat/recommended"],

  // Global configuration
  {
    settings: {
      react: {
        version: "detect",
      },

      lintAllEsApis: true,

      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: ["./tsconfig.json"],
        }),
        importXPlugin.createNodeResolver(),
      ],

      // Our typescript configuration aliases `@/` to the project root
      "import-x/internal-regex": "^@/",
    },
  },

  // TypeScript files
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      // Import
      "import-x/order": [
        "error",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
        },
      ],

      // React Refresh
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Unicorn
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            kebabCase: true,
          },
        },
      ],
      "unicorn/prevent-abbreviations": [
        "error",
        { replacements: { props: false, ref: false, refs: false } },
      ],
      "unicorn/no-null": "off",

      // Format.JS
      "formatjs/enforce-id": "off", // We don't use the hashed IDs

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
    },
  },

  // Tone things done for generated files
  {
    files: ["**/*.gen.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-dynamic-delete": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "unicorn/explicit-length-check": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-abusive-eslint-disable": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-useless-switch-case": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/prefer-string-slice": "off",
      "unicorn/prefer-type-error": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/switch-case-braces": "off",
      "no-useless-escape": "off",
    },
  },

  // Ignore patterns
  {
    ignores: ["dist/**", "node_modules/**", ".tanstack/**"],
  },
);
