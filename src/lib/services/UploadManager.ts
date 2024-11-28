// lib/services/UploadManager.ts

import { processedDataStorage } from '../storage/processedDataDB.ts';
import { SupabaseClient } from '@supabase/supabase-js';
import { NetworkService } from './offline';
import { ProcessingQueueItem } from '../types';

export class UploadManager {
    private uploadInProgress = false;

    constructor(
        private supabase: SupabaseClient,
        private networkService: NetworkService
    ) {}

    public async startUploadProcess(): Promise<void> {
        if (this.uploadInProgress || !this.networkService.isOnline()) return;

        this.uploadInProgress = true;
        try {
            let pendingUploads = await processedDataStorage.getPendingUploads();

            while (pendingUploads.length > 0) {
                for (const item of pendingUploads) {
                    try {
                        await this.uploadFileToSupabase(item);
                        await processedDataStorage.markUploadComplete(item.id);
                    } catch (error: any) {
                        console.error(`Upload failed for item ${item.id}:`, error);
                        await processedDataStorage.markUploadError(item.id, error.message);
                    }
                }
                pendingUploads = await processedDataStorage.getPendingUploads();
            }
        } finally {
            this.uploadInProgress = false;
        }
    }

    private async uploadFileToSupabase(item: ProcessingQueueItem): Promise<void> {
        const { fileBlob, filePath, type } = item;
        console.log("File path: ", filePath);
        if ( type === 'raw' ){
            const { error } = await this.supabase.storage
                .from('raw-data') // Replace with your actual bucket name
                .upload(filePath, fileBlob, { upsert: true });
            if (error) {
                throw error;
            }
        }
        if ( type === 'processed' ){
            const { error } = await this.supabase.storage
                .from('processed-data') // Replace with your actual bucket name
                .upload(filePath, fileBlob, { upsert: true });
            if (error) {
                throw error;
            }
        }
    }
}
