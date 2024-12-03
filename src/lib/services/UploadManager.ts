import { IndexedDBStorage } from '../storage/IndexedDB';
import { ProcessingQueueItem } from '../types';
import { storage } from '../storage/IndexedDB';
import { supabase } from "../supabase/client";
import { networkService } from './EnhancedNetworkService';

interface ProgressCallback {
    (progress: number, status: string): void;
}

interface UploadResult {
    success: boolean;
    error?: Error;
}

export class UploadManager {
    private uploadInProgress = false;
    private storage: IndexedDBStorage;
    private readonly MAX_CONCURRENT_UPLOADS = 3;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000;

    constructor() {
        this.storage = storage;
    }

    public async startUploadProcess(onUploadProgress?: ProgressCallback): Promise<void> {
        if (this.uploadInProgress || !(await networkService.hasActiveConnection())) {
            if (onUploadProgress) {
                onUploadProgress(0, 'Uploads pending due to offline status');
            }
            return;
        }

        this.uploadInProgress = true;
        try {
            let pendingUploads = await this.storage.getPendingUploads();

            while (pendingUploads.length > 0) {
                const totalItems = pendingUploads.length;
                let processedItems = 0;

                // Process uploads in chunks to limit concurrent uploads
                for (let i = 0; i < pendingUploads.length; i += this.MAX_CONCURRENT_UPLOADS) {
                    const uploadChunk = pendingUploads.slice(i, i + this.MAX_CONCURRENT_UPLOADS);

                    await Promise.all(
                        uploadChunk.map(async (item) => {
                            const result = await this.processUploadWithRetry(item);

                            if (result.success) {
                                await this.storage.markUploadComplete(item.id);
                                processedItems++;
                            } else {
                                await this.handleUploadError(item, result.error);
                            }

                            if (onUploadProgress) {
                                const progress = (processedItems / totalItems) * 100;
                                onUploadProgress(
                                    progress,
                                    `Uploaded ${processedItems} of ${totalItems} files`
                                );
                            }
                        })
                    );
                }

                // Check for any remaining uploads
                pendingUploads = await this.storage.getPendingUploads();
            }

            if (onUploadProgress) {
                onUploadProgress(100, 'All uploads complete');
            }
        } finally {
            this.uploadInProgress = false;
        }
    }

    private async processUploadWithRetry(item: ProcessingQueueItem): Promise<UploadResult> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                if (!(await networkService.hasActiveConnection())) {
                    return {
                        success: false,
                        error: new Error('No network connection available')
                    };
                }

                await this.uploadFileToSupabase(item);
                return { success: true };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < this.MAX_RETRIES - 1) {
                    await new Promise(resolve =>
                        setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, attempt))
                    );
                }
            }
        }

        return {
            success: false,
            error: lastError || new Error('Upload failed after maximum retries')
        };
    }

    private async uploadFileToSupabase(item: ProcessingQueueItem): Promise<void> {
        const { fileBlob, filePath, type } = item;
        const bucket = type === 'raw' ? 'raw-data' : 'processed-data';
        console.error(fileBlob);
        const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, fileBlob, { upsert: true });

        if (error) {
            throw error;
        }
    }

    private async handleUploadError(
        item: ProcessingQueueItem,
        error: Error | undefined
    ): Promise<void> {
        console.error(`Upload failed for item ${item.id}:`, error);
        await this.storage.markUploadError(item.id, error?.message || 'Unknown error');

        // Add to operation queue for retry if needed
        if (item.retryCount < this.MAX_RETRIES) {
            await this.storage.queueProcessedFile(
                item.sampleId,
                item.configId,
                item.fileBlob,
                { customPath: item.filePath }
            );
        }
    }

    public async getUploadStatus(): Promise<{
        inProgress: boolean;
        pendingCount: number;
        failedCount: number;
    }> {
        const { pending, error } = await this.storage.getQueueStats();
        return {
            inProgress: this.uploadInProgress,
            pendingCount: pending,
            failedCount: error
        };
    }

    public async cancelAllUploads(): Promise<void> {
        this.uploadInProgress = false;
        const pendingUploads = await this.storage.getPendingUploads();

        await Promise.all(
            pendingUploads.map(item =>
                this.storage.markUploadError(item.id, 'Upload cancelled by user')
            )
        );
    }
}