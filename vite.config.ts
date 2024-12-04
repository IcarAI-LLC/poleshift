import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [react(), wasm(), topLevelAwait()],
    optimizeDeps: {
        // Don't optimize these packages as they contain web workers and WASM files.
        // https://github.com/vitejs/vite/issues/11672#issuecomment-1415820673
        exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
        include: ['@powersync/web > js-logger']
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
            watch: ["**/src/**"],
        },
    },
}));