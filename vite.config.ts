import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import babelPluginFormatjs from "babel-plugin-formatjs";
import babelPluginReactCompiler from "babel-plugin-react-compiler";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: true,
  },

  resolve: {
    alias:
      mode === "production"
        ? {
            // We load the translations from the compiled files, so we don't need the
            // message parser, which reduces the bundle size
            "@formatjs/icu-messageformat-parser":
              "@formatjs/icu-messageformat-parser/no-parser",
          }
        : [],
  },

  plugins: [
    tsConfigPaths(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteReact({
      babel: {
        plugins: [
          babelPluginReactCompiler,
          [
            babelPluginFormatjs,
            {
              // We only remove the default message in production, so that in
              // development we get a feedback even if we did not update the
              // translations yet
              removeDefaultMessage: mode === "production",
            },
          ],
        ],
      },
    }),
    tailwindcss(),
    cloudflare(),
  ],
}));
