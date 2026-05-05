import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import path from "path";
import moduleFederationConfig from "./module-federation.config";

export default defineConfig({
  plugins: [pluginReact(), pluginModuleFederation(moduleFederationConfig)],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  dev: {
    client: {
      port: 3000,
      host: "127.0.0.1",
      protocol: "ws",
    },
  },

  server: {
    port: 3000,
    host: "127.0.0.1",
    cors: { origin: "*" },
  },
});
