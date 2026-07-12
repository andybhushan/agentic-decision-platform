import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Carbon's compiled CSS references Plex with webpack-style "~@ibm/plex/..." urls.
      // Map them to the installed package so the fonts are bundled and self-hosted.
      { find: /^~@ibm\/plex/, replacement: "@ibm/plex" },
    ],
  },
  server: {
    // CORS on ca-tracesapi is verified for this origin; keep the port stable.
    port: 5173,
    strictPort: true,
  },
});
