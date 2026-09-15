import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

const srcAlias = fileURLToPath(new URL("./src", import.meta.url));

// Nitro deploy target. Vercel sets VERCEL=1 in its build container, so builds
// there emit .vercel/output; everything else keeps the Cloudflare Worker build.
const nitroPreset = process.env.NITRO_PRESET ?? (process.env.VERCEL ? "vercel" : "cloudflare-module");

export default defineConfig(({ mode, command }) => {
  // Expose VITE_*-prefixed env vars as import.meta.env.* at build time.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": srcAlias },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        server: { entry: "server" },
      }),
      // nitro builds the server bundle; only needed for `vite build`, not dev.
      ...(command === "build" ? [nitro({ preset: nitroPreset })] : []),
      viteReact(),
    ],
  };
});
