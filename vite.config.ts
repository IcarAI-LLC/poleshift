import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
    plugins: [react(), wasm(), topLevelAwait()],
    clearScreen: false,

    optimizeDeps: {
        // Don't optimize these packages as they contain web workers and WASM files.
        // https://github.com/vitejs/vite/issues/11672#issuecomment-1415820673
        exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
        include: ['@powersync/web > js-logger']
    },

    worker: {
        format: 'es',
        plugins: () => []
    },

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
            ignored: ["**/src-tauri/**"],
        },
    },

    // Add public directory configuration
    publicDir: 'public',

    build: {
        target: ['es2021', 'chrome100', 'safari13'],
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
        rollupOptions: {
            output: {
                format: 'es',
                inlineDynamicImports: true
            }
        }
    },

    // Add resolve configuration
    resolve: {
        alias: {
            '@powersync/web': '@powersync/web'
        }
    }
}));