import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import babelPluginFormatjs from "babel-plugin-formatjs";
import babelPluginReactCompiler from "babel-plugin-react-compiler";
import browserslistToEsbuild from "browserslist-to-esbuild";
import {
  createRunnableDevEnvironment,
  defineConfig,
  resolveConfig,
  type Plugin,
  type UserConfig,
} from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: true,
    target: browserslistToEsbuild(),
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
    vitePluginPrerender(),
  ],
}));

function vitePluginPrerender(): Plugin {
  let config: UserConfig | undefined;

  return {
    name: "prerender",
    apply: "build",
    enforce: "post",

    applyToEnvironment(environment) {
      // Only apply in the client build.
      return environment.name === "client";
    },

    config(config_) {
      config = {
        ...config_,
        dev: {
          ...config_.dev,
          moduleRunnerTransform: true,
        },
        server: {
          ...config_.server,
          perEnvironmentStartEndDuringDev: true,
        },
        ssr: { ...config_.ssr, target: "node" },
        appType: "custom",
        environments: {
          prerender: {},
        },
        // It is expected that all the expected functionality, be it transformations or rewrites,
        // would be handled by the main build process and cached. Having the plugins run again leads
        // to problems, as they would attempt to transform already transformed code.
        plugins: [],
      };
    },

    async transformIndexHtml(html: string): Promise<string> {
      if (!config) {
        throw new Error("config not loaded");
      }

      const resolvedConfig = await resolveConfig(config, "serve");

      const environment = createRunnableDevEnvironment(
        "prerender",
        resolvedConfig,
        {
          hot: false,
          runnerOptions: {
            hmr: {
              logger: false,
            },
          },
        },
      );

      await environment.init();

      const { render } = await environment.runner.import("/src/prerender");

      const rendered = await render();

      return html.replace(
        '<div id="app"></div>',
        `<div id="app">${rendered}</div>`,
      );
    },
  };
}
