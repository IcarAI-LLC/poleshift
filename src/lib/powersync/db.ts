// src/lib/powersync/db.ts

import { PowerSyncDatabase } from '@powersync/web';
import type { PowerSyncDatabaseOptions } from '@powersync/web/lib/index.js';
import { SupabaseConnector } from './SupabaseConnector';
import { AppSchema } from './Schema';

// Counter to track the number of instances created
let instanceCount = 0;

/**
 * Factory function to create PowerSyncDatabase instances.
 * - The first instance will have useWebWorker set to false.
 * - Subsequent instances will have useWebWorker set to true.
 */
export const createDatabaseInstance = (): PowerSyncDatabase => {
    const useWebWorker = instanceCount > 0; // false for first instance, true otherwise
    const db = new PowerSyncDatabase({
        schema: AppSchema,
        database: {
            dbFilename: 'powersync.db',
        },
        flags: {
            useWebWorker: useWebWorker,
        },
        sync: true
    });
    instanceCount++;
    console.log(`PowerSyncDatabase instance created with useWebWorker: ${useWebWorker}`);
    return db;
};

// Create the first instance with useWebWorker: false
export const db = createDatabaseInstance();

/**
 * Sets up PowerSync with event listeners.
 */
export const setupPowerSync = async () => {
    console.log("Setup Power Sync called");
    if (db.connected) {
        console.debug('PowerSync is already connected.');
        return;
    }
    console.log('PowerSync is not yet connected');

    const connector = new SupabaseConnector();
    console.log('Connector created');

    try {
        // Connect the database with the Supabase connector
        await db.connect(connector);
    } catch (error) {
        console.error('Failed to connect PowerSyncDatabase:', error);
        return;
    }

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
