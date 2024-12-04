// src/lib/utils/uploadQueue.ts

import { openDB, DBSchema } from 'idb';

export interface UploadTask {
    id: string;
    file: File;
    path: string;
    bucket: string;
    retries: number;
}

interface UploadQueueDB extends DBSchema {
    uploads: {
        key: string;
        value: UploadTask;
    };
}

const dbPromise = openDB<UploadQueueDB>('upload-queue-db', 1, {
    upgrade(db) {
        db.createObjectStore('uploads', { keyPath: 'id' });
    },
});

/**
 * Adds a new upload task to the queue.
 * @param uploadTask The upload task to add.
 */
export const addToQueue = async (uploadTask: UploadTask): Promise<void> => {
    const db = await dbPromise;
    await db.add('uploads', uploadTask);
};

/**
 * Retrieves all queued upload tasks.
 * @returns An array of upload tasks.
 */
export const getAllQueuedUploads = async (): Promise<UploadTask[]> => {
    const db = await dbPromise;
    return await db.getAll('uploads');
};

/**
 * Removes a specific upload task from the queue.
 * @param id The unique identifier of the upload task.
 */
export const removeFromQueue = async (id: string): Promise<void> => {
    const db = await dbPromise;
    await db.delete('uploads', id);
};

/**
 * Updates an existing upload task in the queue.
 * @param uploadTask The updated upload task.
 */
export const updateQueueItem = async (uploadTask: UploadTask): Promise<void> => {
    const db = await dbPromise;
    await db.put('uploads', uploadTask);
};
