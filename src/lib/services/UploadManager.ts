// lib/services/UploadManager.ts

import {IndexedDBStorage } from '../storage/IndexedDB';
import { SupabaseClient } from '@supabase/supabase-js';
import { NetworkService } from './offline';
import { ProcessingQueueItem } from '../types';
import { storage } from '../storage/IndexedDB';
import { supabase } from "../supabase/client.ts";

interface ProgressCallback {
    (progress: number, status: string): void;
}

export class UploadManager {
    private uploadInProgress = false;
    private storage: IndexedDBStorage;

    constructor(
        private networkService = new NetworkService,
    ) {
        this.storage = storage; // Use provided storage instance or the singleton
    }

    public async startUploadProcess(onUploadProgress?: ProgressCallback): Promise<void> {
        if (this.uploadInProgress || !this.networkService.isOnline()) return;

        this.uploadInProgress = true;
        try {
            let pendingUploads = await this.storage.getPendingUploads();

            while (pendingUploads.length > 0) {
                const totalItems = pendingUploads.length;
                let processedItems = 0;

                for (const item of pendingUploads) {
                    try {
                        await this.uploadFileToSupabase(item);
                        await this.storage.markUploadComplete(item.id);

                        processedItems++;
                        const progress = (processedItems / totalItems) * 100;
                        if (onUploadProgress) {
                            onUploadProgress(progress, `Uploaded ${processedItems} of ${totalItems} files`);
                        }
                    } catch (error: any) {
                        console.error(`Upload failed for item ${item.id}:`, error);
                        await this.storage.markUploadError(item.id, error.message);
                        if (onUploadProgress) {
                            onUploadProgress(0, `Upload failed for file ${item.filePath}`);
                        }
                    }
                }
                pendingUploads = await this.storage.getPendingUploads();
            }

            if (onUploadProgress) {
                onUploadProgress(100, 'All uploads complete');
            }
        } finally {
            this.uploadInProgress = false;
        }
    }

    private async uploadFileToSupabase(item: ProcessingQueueItem): Promise<void> {
        const { fileBlob, filePath, type } = item;
        console.log('Uploading file to path:', filePath);

        if (type === 'raw') {
            const { error } = await supabase.storage
                .from('raw-data') // Replace with your actual bucket name
                .upload(filePath, fileBlob, { upsert: true });

            if (error) {
                throw error;
            }
        } else if (type === 'processed') {
            const { error } = await supabase.storage
                .from('processed-data') // Replace with your actual bucket name
                .upload(filePath, fileBlob, { upsert: true });

            if (error) {
                throw error;
            }
        } else {
            throw new Error(`Unknown file type: ${type}`);
        }
    }
}
