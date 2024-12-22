// src/lib/powersync/db.ts

import {PowerSyncDatabase} from '@powersync/web';
import { SupabaseConnector } from './SupabaseConnector';
import { AppSchema } from './Schema';

// Variables to track the instance creation
let instanceCount = 0;
let dbInstance: PowerSyncDatabase | null = null;

/**
 * Returns the database instance.
 *  - 1st call: Creates a non-web-worker instance and returns it.
 *  - 2nd call: Creates a web-worker instance, replaces the first one, and returns it.
 *  - Subsequent calls: Returns the web-worker instance (no new creation).
 */
export const getDatabaseInstance = (): PowerSyncDatabase => {
    instanceCount++;

    if (instanceCount === 1) {
        // First time: no web worker
        dbInstance = new PowerSyncDatabase({
            schema: AppSchema,
            database: {
                dbFilename: 'powersync.db',
            },
            flags: {
                useWebWorker: false,
            }

        });
        console.log('PowerSyncDatabase instance created (no web worker).');
        return dbInstance;
    }

    if (instanceCount === 2) {
        // Second time: create and use a web worker instance.
        // Replace the old instance with the new one.
        dbInstance = new PowerSyncDatabase({
            schema: AppSchema,
            database: {
                dbFilename: 'powersync.db',
            },
            flags: {
                useWebWorker: true,
            }
        });
        console.log('PowerSyncDatabase instance created (with web worker). This instance is now primary.');
        return dbInstance;
    }

    // For any subsequent calls, just return the web-worker instance
    console.log('Returning existing web-worker instance.');
    return dbInstance as PowerSyncDatabase;
};

// By default, we export the current instance. The first import of this file
// will cause the first instance to be created (no web worker).
export const db = getDatabaseInstance();

/**
 * Sets up PowerSync with event listeners.
 */
export const setupPowerSync = async () => {
    console.log("Setup Power Sync called");
    // Always reference `db`, which will be the currently active instance.
    if (db.connected) {
        console.debug('PowerSync is already connected.');
        return;
    }
    console.log('PowerSync is not yet connected');

    const connector = new SupabaseConnector();
    console.log('Connector created');

    try {
        await db.connect(connector);
    } catch (error) {
        console.error('Failed to connect PowerSyncDatabase:', error);
        return;
    }

    // Register event listeners
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
