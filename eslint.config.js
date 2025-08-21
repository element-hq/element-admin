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

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  reactHooksPlugin.configs["recommended-latest"],
  reactRefreshPlugin.configs.vite,
  jsxA11yPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.typescript,
  importXPlugin.flatConfigs.react,
  unicornPlugin.configs.recommended,
  eslintConfigPrettier,

  // Global configuration
  {
    settings: {
      react: {
        version: "detect",
      },

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
      "import-x/order": ["error"],

      // React Refresh
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Selected Unicorn rules
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            kebabCase: true,
          },
        },
      ],
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/prefer-top-level-await": "off",
      "unicorn/no-useless-undefined": "off",

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
      "@typescript-eslint/no-empty-object-type": "off", // Allow {} types
      "@typescript-eslint/no-namespace": "off", // Allow namespaces
      "@typescript-eslint/no-unused-expressions": "off", // Allow some unused expressions

      // React rules
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/display-name": "off",
    },
  },

  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".tanstack/**",
      "src/routeTree.gen.ts",
      "translations/**",
      ".wrangler/**",
      "coverage/**",
    ],
  },
);
