// src/lib/powersync/db.ts

import {PowerSyncDatabase} from '@powersync/web';
import {supabaseConnector} from './SupabaseConnector';
import {AppSchema} from './Schema';

// By default, we export the current instance. The first import of this file
// will cause the first instance to be created (no web worker).
export const db  = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
        dbFilename: 'powersync2.db'
    },
    flags: {
        useWebWorker: false
    }
});

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

    console.log('Connector created');

    try {
        await db.connect(supabaseConnector);
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
