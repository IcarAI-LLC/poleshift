//src/lib/powersync/db.ts

import { PowerSyncDatabase } from '@powersync/web';
import type { PowerSyncDatabaseOptions } from '@powersync/web/lib/index.js';
import { SupabaseConnector } from './SupabaseConnector';
import { AppSchema } from './Schema';

export const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
        dbFilename: 'powersync.db',
        wasmUrl: '/node_modules/@powersync/sqlite-wasm/sqlite3.wasm',
        workerUrl: '/node_modules/@powersync/web/worker'
    }
});

// PowerSync setup with event listeners
export const setupPowerSync = async (connector: SupabaseConnector) => {
    if (db.connected) {
        console.debug('PowerSync is already connected.');
        return;
    }
    // Connect the database with the Supabase connector
    await db.connect(connector);

    // Register event listeners using `registerListener`
    db.registerListener({
        onConfigure: () => {
            console.log('PowerSync configured');
        },
        onConnect: () => {
            console.log('PowerSync connected');
        },
        onDisconnect: () => {
            console.log('PowerSync disconnected');
        },
        onError: (error) => {
            console.error('PowerSync error:', error);
        },
        onCrudOperation: (operation) => {
            console.log('PowerSync CRUD operation:', operation);
        }
    });

    console.log('PowerSync initialized successfully.');
};
