import type { StorageService } from '../storage/StorageService';
import type { ProcessingQueueItem } from '../../types';
import { supabase } from '../../supabase/client';

interface ProgressCallback {
    (progress: number, status: string): void;
}

export class UploadService {
    private uploadInProgress = false;
    private readonly MAX_CONCURRENT_UPLOADS = 3;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000;

    constructor(private storageService: StorageService) {}

    async startUploadProcess(onProgress?: ProgressCallback): Promise<void> {
        if (this.uploadInProgress) {
            onProgress?.(0, 'Upload process already running');
            return;
        }

        this.uploadInProgress = true;

        try {
            let pendingUploads = await this.storageService.getPendingUploads();

            while (pendingUploads.length > 0) {
                const totalItems = pendingUploads.length;
                let processedItems = 0;

                // Process uploads in chunks
                for (let i = 0; i < pendingUploads.length; i += this.MAX_CONCURRENT_UPLOADS) {
                    const uploadChunk = pendingUploads.slice(i, i + this.MAX_CONCURRENT_UPLOADS);

                    await Promise.all(
                        uploadChunk.map(async (item) => {
                            const result = await this.processUploadWithRetry(item);

                            if (result.success) {
                                await this.storageService.markUploadComplete(item.id);
                                processedItems++;
                            } else {
                                await this.handleUploadError(item, result.error);
                            }

                            if (onProgress) {
                                const progress = (processedItems / totalItems) * 100;
                                onProgress(
                                    progress,
                                    `Uploaded ${processedItems} of ${totalItems} files`
                                );
                            }
                        })
                    );
                }

                pendingUploads = await this.storageService.getPendingUploads();
            }

            onProgress?.(100, 'All uploads complete');
        } finally {
            this.uploadInProgress = false;
        }
    }

    private async processUploadWithRetry(item: ProcessingQueueItem): Promise<{
        success: boolean;
        error?: Error;
    }> {
        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                await this.uploadFileToSupabase(item);
                return { success: true };
            } catch (error) {
                if (attempt === this.MAX_RETRIES - 1) {
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(String(error))
                    };
                }
                await new Promise(resolve =>
                    setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, attempt))
                );
            }
        }

        return {
            success: false,
            error: new Error('Upload failed after maximum retries')
        };
    }

    private async uploadFileToSupabase(item: ProcessingQueueItem): Promise<void> {
        const { fileBlob, filePath, type } = item;
        const bucket = type === 'raw' ? 'raw-data' : 'processed-data';

        const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, fileBlob, { upsert: true });

        if (error) throw error;
    }

    private async handleUploadError(
        item: ProcessingQueueItem,
        error?: Error
    ): Promise<void> {
        await this.storageService.markUploadError(
            item.id,
            error?.message || 'Unknown error'
        );

        if (item.retryCount < this.MAX_RETRIES) {
            await this.storageService.queueProcessedFile(
                item.sampleId,
                item.configId,
                item.fileBlob,
                { customPath: item.filePath }
            );
        }
    }

    async getUploadStatus(): Promise<{
        inProgress: boolean;
        pendingCount: number;
        failedCount: number;
    }> {
        const pendingUploads = await this.storageService.getPendingUploads();
        const failedUploads = pendingUploads.filter(item => item.status === 'error');

        return {
            inProgress: this.uploadInProgress,
            pendingCount: pendingUploads.length - failedUploads.length,
            failedCount: failedUploads.length
        };
    }
}