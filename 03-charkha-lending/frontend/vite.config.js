import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Support use of Node builtins in the browser, ie. Buffer */
import NodeGlobalsPolyfillPlugin from "@esbuild-plugins/node-globals-polyfill";
import rollupNodePolyFill from "rollup-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [NodeGlobalsPolyfillPlugin({ buffer: true })],
    },
  },
  server: {
    proxy: {
      "/proxy": {
        target: "https://pro-api.coinmarketcap.com/",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      plugins: [rollupNodePolyFill()],
    },
  },
});
