import { defineConfig } from "vite";

export default defineConfig(({ command }) =>
  command === "serve"
    ? // `npm run dev` serves the playground in ./demo
      { root: "demo" }
    : {
        build: {
          lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: "index",
          },
          rollupOptions: {
            // Never bundle React; the host app provides it.
            external: [/^react($|\/)/, /^react-dom($|\/)/],
          },
        },
      },
);
