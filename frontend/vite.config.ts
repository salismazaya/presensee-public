import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react_utils: ["react-toastify", "react-day-picker", "react-router"],
          sweetalert2: ["sweetalert2"],
          lz_string: ["lz-string"],
        },
      },
      input: {
        main: "index.html",
        piket: "piket.html",
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      strategies: "generateSW",
      // srcDir: "src",
      // filename: "sw.js",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg",],
      manifest: {
        name: "Presensee",
        lang: "id",
        short_name: "Presensee",
        description: "Aplikasi Presensi Offline First",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/logo.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
