// src/utils/offlineStorage.ts

const DB_NAME = 'sampleDB';
const DB_VERSION = 1;
const SAMPLE_STORE = 'sampleGroups';
const PENDING_OPS_STORE = 'pendingOperations';

export interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
  data: any;
  timestamp?: number;
}

// Initialize the database
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create sample groups store if it doesn't exist
      if (!db.objectStoreNames.contains(SAMPLE_STORE)) {
        db.createObjectStore(SAMPLE_STORE, { keyPath: 'id' });
      }

      // Create pending operations store if it doesn't exist
      if (!db.objectStoreNames.contains(PENDING_OPS_STORE)) {
        const pendingStore = db.createObjectStore(PENDING_OPS_STORE, {
          keyPath: 'id',
        });
        pendingStore.createIndex('timestamp', 'timestamp');
      }
    };
  });
};

// Helper to get database connection
const getDB = async (): Promise<IDBDatabase> => {
  try {
    return await initDB();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

// Add or update a sample group
// src/utils/offlineStorage.ts

export const addOrUpdateSampleGroup = async (
  sampleGroup: any,
): Promise<void> => {
  console.log('Saving sampleGroup to IndexedDB:', sampleGroup); // Debug log
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SAMPLE_STORE, 'readwrite');
    const store = transaction.objectStore(SAMPLE_STORE);

    const request = store.put(sampleGroup);

    request.onerror = () => {
      console.error('Failed to save sampleGroup:', request.error); // Debug log
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('sampleGroup saved successfully'); // Debug log
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};


// Get all sample groups
export const getAllSampleGroups = async (): Promise<any[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SAMPLE_STORE, 'readonly');
    const store = transaction.objectStore(SAMPLE_STORE);
    const request = store.getAll();

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Delete a sample group
export const deleteSampleGroup = async (id: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SAMPLE_STORE, 'readwrite');
    const store = transaction.objectStore(SAMPLE_STORE);
    const request = store.delete(id);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Add pending operation
export const addPendingOperation = async (
  operation: Omit<PendingOperation, 'id'>,
): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_OPS_STORE, 'readwrite');
    const store = transaction.objectStore(PENDING_OPS_STORE);

    const operationWithId = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    const request = store.add(operationWithId);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Get all pending operations
export const getAllPendingOperations = async (): Promise<
  PendingOperation[]
> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_OPS_STORE, 'readonly');
    const store = transaction.objectStore(PENDING_OPS_STORE);
    const request = store.getAll();

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Delete pending operation
export const deletePendingOperation = async (id: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_OPS_STORE, 'readwrite');
    const store = transaction.objectStore(PENDING_OPS_STORE);
    const request = store.delete(id);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Clear all data (useful for testing or user logout)
export const clearDatabase = async (): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [SAMPLE_STORE, PENDING_OPS_STORE],
      'readwrite',
    );

    const sampleStore = transaction.objectStore(SAMPLE_STORE);
    const pendingStore = transaction.objectStore(PENDING_OPS_STORE);

    sampleStore.clear();
    pendingStore.clear();

    transaction.onerror = () => {
      reject(transaction.error);
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
};
