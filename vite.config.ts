import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works from a GitHub Pages project subpath
  // (https://<user>.github.io/<repo>/) as well as from a domain root.
  base: "./",
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
