import { build, defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
// import devtools from 'solid-devtools/vite';
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";
import arraybuffer from "vite-plugin-arraybuffer";
import { compression } from "vite-plugin-compression2";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [
    /* 
    Uncomment the following line to enable solid-devtools.
    For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
    */
    // devtools(),
    solidPlugin(),
    viteSingleFile({
      removeViteModuleLoader: true,
    }),
    arraybuffer(),
    compression(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    minify: true,
  },
  define: {
    BUILD_DATE:
      process.env.NODE_ENV === "production"
        ? JSON.stringify(new Date().toISOString())
        : undefined,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
