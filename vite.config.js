import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react-oxc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ 
      target: "react",
      autoCodeSplitting: true, 
    }),
    viteReact(),
    tailwindcss(),
    cloudflare(),
  ],
  test: {
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
