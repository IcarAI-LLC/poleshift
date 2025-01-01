import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import * as path from "node:path";

const ReactCompilerConfig = {
    sources: (filename: string | string[]) => {
        return filename.indexOf('./src') !== -1;
    },
};
const host = process.env.TAURI_DEV_HOST;

// Use top-level await if necessary to resolve any async configuration steps before defining the config
const main = async () => {
    // If you have asynchronous steps, resolve them here

    return defineConfig({
        plugins: [
            react({
                babel: {
                    plugins: [
                        ["babel-plugin-react-compiler"],
                    ],
            }
            }),
            wasm(),
            topLevelAwait()],
        optimizeDeps: {
            exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
            include: ['@powersync/web > js-logger']
        },
        clearScreen: false,
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
        envPrefix: ['VITE_', 'TAURI_ENV_*'],
        build: {
            target: process.env.TAURI_ENV_PLATFORM == 'windows'
                ? 'chrome105'
                : 'safari14',
            minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
            sourcemap: !!process.env.TAURI_ENV_DEBUG,
        },
        worker: {
            format: 'es',
            plugins: () => [wasm(), topLevelAwait()]
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    });
};

export default main();