import {  defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";
import arraybuffer from "vite-plugin-arraybuffer";
import { compression } from "vite-plugin-compression2";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    solidPlugin(),
    // 单文件插件：内联所有资源
    viteSingleFile({
      removeViteModuleLoader: true,
    }),
    arraybuffer(),
    // Tailwind 插件
    tailwindcss(),
    // gzip/brotli 压缩：这会生成 index.html.gz，但不会改变 index.html 本身的大小
    compression({
      algorithm: "gzip",
      deleteOriginalAssets: false,
    }),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/pdfjs-dist/cmaps",
          dest: "",
        },
      ],
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: ["debug"],
        drop_debugger: true,
      },
      format: {
        comments: false, // 删除所有注释
      },
    },
    cssMinify: "lightningcss",
    cssCodeSplit: false, // 单文件模式下，禁止 CSS 拆分是必须的
    sourcemap: false,

    // assetsInlineLimit: 4096,
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
