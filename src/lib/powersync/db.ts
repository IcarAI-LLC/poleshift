// src/lib/powersync/db.ts

import { PowerSyncDatabase } from '@powersync/web';
import type { PowerSyncDatabaseOptions } from '@powersync/web/lib/index.js';
import { SupabaseConnector } from './SupabaseConnector';
import { AppSchema } from './Schema';

class DatabaseSingleton {
    private static instance: PowerSyncDatabase;

    // Private constructor to prevent direct instantiation
    private constructor() {}

    public static getInstance(): PowerSyncDatabase {
        if (!DatabaseSingleton.instance) {
            DatabaseSingleton.instance = new PowerSyncDatabase({
                schema: AppSchema,
                database: {
                    dbFilename: 'powersync.db',
                },
                flags: {
                    useWebWorker: false,
                },
                sync: true
            });
            console.log('PowerSyncDatabase instance created.');
        } else {
            console.debug('Using existing PowerSyncDatabase instance.');
        }
        return DatabaseSingleton.instance;
    }
}

export const db = DatabaseSingleton.getInstance();

// PowerSync setup with event listeners
export const setupPowerSync = async () => {
    console.log("Setup Power Sync called");
    if (db.connected) {
        console.debug('PowerSync is already connected.');
        return;
    }
    console.log('PowerSync is not yet connected');

    const connector = new SupabaseConnector();
    console.log('Connector created');

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
