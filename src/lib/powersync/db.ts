// src/lib/powersync/db.ts

import {
  PowerSyncDatabase,
  WASQLiteOpenFactory,
  WASQLiteVFS,
} from '@powersync/web';
import { supabaseConnector } from './SupabaseConnector';
import { AppSchema } from './Schema';

/**
 * A singleton wrapper class for the PowerSyncDatabase.
 */
export class PowerSyncDB {
  // The single instance will be stored in this static property.
  private static instance: PowerSyncDatabase | null = null;

  /**
   * Returns the singleton PowerSyncDatabase instance.
   * If it doesn't exist, it is created here.
   */
  public static getInstance(): PowerSyncDatabase {
    try {
      if (!this.instance) {
        const isLinux =
          typeof navigator !== 'undefined' && /Linux/i.test(navigator.platform);

        // Then use:
        const vfsImplementation = isLinux
          ? WASQLiteVFS.IDBBatchAtomicVFS
          : WASQLiteVFS.OPFSCoopSyncVFS;
        this.instance = new PowerSyncDatabase({
          schema: AppSchema,
          database: new WASQLiteOpenFactory({
            dbFilename: 'powersync2',
            vfs: vfsImplementation,
            dbLocation: './powersync2/',
          }),
        });
      }
    } catch (e) {
      console.error('Powersync error: ', e);
    }
    if (this.instance) {
      return this.instance;
    } else {
      throw new Error('Failed to create PowerSyncDatabase instance.');
    }
  }
}

/**
 * Sets up PowerSync with event listeners using the singleton DB instance.
 */
export const setupPowerSync = async () => {
  console.log('Setup Power Sync called');
  const db = PowerSyncDB.getInstance();
  // Always reference the singleton DB instance through the static getter
  if (db?.connected) {
    console.debug('PowerSync is already connected.');
    return;
  }
  console.log('PowerSync is not yet connected');
  try {
    await db?.connect(supabaseConnector);
    console.log('Connector created');
  } catch (error) {
    console.error('Failed to connect PowerSyncDatabase:', error);
    return;
  }

  // Register event listeners
  db?.registerListener({
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
    },
  });

  console.log('PowerSync initialized successfully.');
};

export const db = PowerSyncDB.getInstance();
