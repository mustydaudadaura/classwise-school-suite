// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type ConfigEnv } from "vite";

const appConfig = defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        { find: "entities/lib/decode.js", replacement: new URL('./node_modules/entities/lib/decode.js', import.meta.url).pathname },
        { find: "entities/lib/encode.js", replacement: new URL('./node_modules/entities/lib/encode.js', import.meta.url).pathname },
        { find: "entities", replacement: new URL('./node_modules/entities', import.meta.url).pathname },
        {
        find: /^@\/integrations\/supabase\/auth-middleware$/,
        replacement: new URL('./src/lib/verified-auth.ts', import.meta.url).pathname,
      }],
    },
    build: {
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" ||
            warning.message.includes('"use client"')
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
  },
});

export default async (env: ConfigEnv) => {
  // Server secrets stay in process.env, never in browser define values.
  Object.assign(process.env, loadEnv(env.mode, process.cwd(), ""));
  return appConfig(env);
};
