/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_POWERSYNC_URL: string;
    readonly VITE_AYD_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module 'plotly.js-dist' {
    import * as Plotly from 'plotly.js';
    export default Plotly;
}