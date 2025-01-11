import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import * as path from "node:path";
import eslint from "vite-plugin-eslint";
import {nodePolyfills} from "vite-plugin-node-polyfills";
//because __dirname was showing undefined
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.TAURI_DEV_HOST;


// Use top-level await if necessary to resolve any async configuration steps before defining the config
export default function main() {
    // If you have asynchronous steps, resolve them here
    const ReactCompilerConfig = {
        sources: (filename: string | string[]) => {
            return filename.indexOf('./src') !== -1;
        },
    };

    return defineConfig({
        plugins: [
            react({
                babel: {
                    plugins: [
                        ["babel-plugin-react-compiler",
                        ReactCompilerConfig],
                    ],
            }
            }), eslint(), nodePolyfills()],
        // PowerSync
        optimizeDeps: {
            // Don't optimize these packages as they contain web workers and WASM files.
            // https://github.com/vitejs/vite/issues/11672#issuecomment-1415820673
            exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],

            // But include js-logger from @powersync/web, otherwise app breaks.
            // https://github.com/powersync-ja/powersync-js/pull/267
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
                : 'safari16',
            minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
            sourcemap: !!process.env.TAURI_ENV_DEBUG
        },
        worker: {
            format: 'es',
            plugins: () => [wasm(), topLevelAwait()],
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    });
};