// src/lib/hooks/useStorage.ts

import { useCallback, useEffect } from 'react';
import { db } from '../powersync/db';
import { supabaseConnector } from '../powersync/SupabaseConnector';
import {
    addToQueue,
    getAllQueuedUploads,
    removeFromQueue,
    updateQueueItem,
    UploadTask,
} from '../utils/uploadQueue';
import { v4 as uuidv4 } from 'uuid';
import { useNetworkStatus } from './useNetworkStatus';
// Import the Snackbar store
import { useSnackbarStore } from '../stores/snackbarStore';

interface UploadProgress {
    progress: number; // now represents % of files processed
    bytesUploaded: number;
    totalBytes: number;
}

interface DownloadProgress {
    progress: number;
    bytesDownloaded: number;
    totalBytes: number;
}

export const useStorage = () => {
    const connector = supabaseConnector;
    const { isOnline } = useNetworkStatus();
    // Use the Snackbar store's showSnackbar method
    const showSnackbar = useSnackbarStore((state: { showSnackbar: any; }) => state.showSnackbar);

    const getStorageClient = useCallback(() => {
        if (!connector) {
            throw new Error('No auth connector available');
        }
        return connector.client.storage;
    }, [connector]);

    const uploadFile = useCallback(
        async (
            file: File,
            path: string,
            bucket: string,
        ): Promise<string> => {
            // Note: Removed the onUploadProgress from here as Supabase
            // doesn't currently support it. We'll track progress by file count.
            try {
                const storage = getStorageClient();
                const { data, error } = await storage
                    .from(bucket)
                    .upload(path, file);

                if (error) throw error;
                if (!data) throw new Error('Upload failed');

                return data.path;
            } catch (error) {
                console.error('Upload error:', error);
                throw error;
            }
        },
        [getStorageClient]
    );

    const processUploadQueue = useCallback(async () => {
        if (!isOnline) return;

        const queuedUploads = await getAllQueuedUploads();

        for (const uploadTask of queuedUploads) {
            const { id, file, path, bucket, retries } = uploadTask;

            // Check if the file already exists
            const exists = await fileExists(path);
            if (exists) {
                await removeFromQueue(id);
                showSnackbar(`File "${file.name}" already exists. Removed from queue.`, 'info');
                continue;
            }

            try {
                await uploadFile(file, path, bucket);
                // On success, remove from queue
                await removeFromQueue(id);
                showSnackbar(`Successfully uploaded "${file.name}".`, 'success');
                console.log(`Successfully uploaded ${file.name} from queue.`);
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);

                // Update retries
                if (retries < 3) { // Retry up to 3 times
                    await updateQueueItem({
                        ...uploadTask,
                        retries: retries + 1,
                    });
                    showSnackbar(`Retrying upload for "${file.name}". Attempt ${retries + 1}`, 'warning');
                    console.log(`Retrying upload for ${file.name}. Attempt ${retries + 1}`);
                } else {
                    // Exceeded retry attempts, notify the user
                    showSnackbar(`Max retries exceeded for "${file.name}". Upload failed.`, 'error');
                    console.error(`Max retries exceeded for ${file.name}. Upload failed.`);
                    await removeFromQueue(id);
                }
            }
        }
    }, [isOnline, uploadFile, showSnackbar]);

    useEffect(() => {
        // When back online, process the queue
        if (isOnline) {
            processUploadQueue();
        }
    }, [isOnline, processUploadQueue]);

    const fileExists = useCallback(
        async (path: string): Promise<boolean> => {
            try {
                const storage = getStorageClient();
                const { data, error } = await storage
                    .from('processed-data')
                    .list(path);

                if (error) throw error;
                return data?.length > 0;
            } catch (error) {
                console.error('File check error:', error);
                return false; // Assume file doesn't exist on error
            }
        },
        [getStorageClient]
    );

    const uploadFiles = useCallback(
        async (
            files: File[],
            basePath: string,
            bucket: string,
            onProgress?: (progress: UploadProgress) => void
        ): Promise<string[]> => {
            const paths: string[] = [];
            let filesProcessed = 0;
            const totalFiles = files.length;
            const concurrentUploads = 3; // Number of concurrent uploads

            console.debug(`Uploading ${files.length} files to ${bucket}...`);

            // Process files in chunks
            for (let i = 0; i < files.length; i += concurrentUploads) {
                const chunk = files.slice(i, i + concurrentUploads);
                const uploadPromises = chunk.map(async (file) => {
                    const path = `${basePath}/${file.name}`;

                    if (isOnline) {
                        // Check if file exists before uploading
                        const exists = await fileExists(path);
                        if (exists) {
                            showSnackbar(`File "${file.name}" already exists. Skipping upload.`, 'info');
                            paths.push(path);
                            filesProcessed += 1;
                            if (onProgress) {
                                onProgress({
                                    progress: (filesProcessed / totalFiles) * 100,
                                    bytesUploaded: 0,
                                    totalBytes: 0,
                                });
                            }
                            return path;
                        }

                        try {
                            await uploadFile(file, path, bucket);
                            paths.push(path);
                            filesProcessed += 1;
                            if (onProgress) {
                                onProgress({
                                    progress: (filesProcessed / totalFiles) * 100,
                                    bytesUploaded: 0,
                                    totalBytes: 0,
                                });
                            }
                            return path;
                        } catch (error) {
                            // If upload fails while online, queue the upload
                            console.error(`Failed to upload ${file.name} while online. Queuing...`);
                            const uploadTask: UploadTask = {
                                id: uuidv4(),
                                file,
                                path,
                                bucket,
                                retries: 0,
                                status: 'queued',
                                progress: 0,
                            };
                            await addToQueue(uploadTask);
                            showSnackbar(`Queued upload for "${file.name}".`, 'warning');
                            paths.push(path);
                            filesProcessed += 1;
                            if (onProgress) {
                                onProgress({
                                    progress: (filesProcessed / totalFiles) * 100,
                                    bytesUploaded: 0,
                                    totalBytes: 0,
                                });
                            }
                            return path;
                        }
                    } else {
                        // Offline: Queue the upload
                        console.log(`Offline: Queuing upload for ${file.name}`);
                        const uploadTask: UploadTask = {
                            id: uuidv4(),
                            file,
                            path,
                            bucket,
                            retries: 0,
                            status: 'queued',
                            progress: 0,
                        };
                        await addToQueue(uploadTask);
                        showSnackbar(`Queued upload for "${file.name}" (Offline).`, 'info');
                        paths.push(path);
                        filesProcessed += 1;
                        if (onProgress) {
                            onProgress({
                                progress: (filesProcessed / totalFiles) * 100,
                                bytesUploaded: 0,
                                totalBytes: 0,
                            });
                        }
                        return path;
                    }
                });

                // Wait for current chunk to complete before moving to next chunk
                await Promise.all(uploadPromises);
            }

            return paths;
        },
        [uploadFile, isOnline, fileExists, showSnackbar]
    );

    const downloadFile = useCallback(
        async (
            path: string,
            onProgress?: (progress: DownloadProgress) => void
        ): Promise<Blob> => {
            try {
                const storage = getStorageClient();
                const { data, error } = await storage
                    .from('processed-data')
                    .download(path, {
                        //@ts-ignore
                        onDownloadProgress: ({ loaded, total }) => {
                            if (onProgress && total) {
                                onProgress({
                                    progress: (loaded / total) * 100,
                                    bytesDownloaded: loaded,
                                    totalBytes: total,
                                });
                            }
                        },
                    });

                if (error) throw error;
                if (!data) throw new Error('Download failed');

                return data;
            } catch (error) {
                console.error('Download error:', error);
                throw error;
            }
        },
        [getStorageClient]
    );

    const getFileMetadata = useCallback(
        async (path: string): Promise<any> => {
            try {
                const storage = getStorageClient();
                const { data, error } = await storage
                    .from('processed-data')
                    .list(path);

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Metadata fetch error:', error);
                throw error;
            }
        },
        [getStorageClient]
    );

    const deleteFile = useCallback(
        async (path: string): Promise<void> => {
            try {
                const storage = getStorageClient();
                const { error } = await storage
                    .from('processed-data')
                    .remove([path]);

                if (error) throw error;

                // Remove file record from PowerSync
                await db.execute(
                    `
                        DELETE FROM file_uploads
                        WHERE file_path = ?
                    `,
                    [path]
                );
            } catch (error) {
                console.error('Delete error:', error);
                throw error;
            }
        },
        [getStorageClient]
    );

    const getSignedUrl = useCallback(
        async (path: string, expiresIn: number = 3600): Promise<string> => {
            try {
                const storage = getStorageClient();
                const { data, error } = await storage
                    .from('processed-data')
                    .createSignedUrl(path, expiresIn);

                if (error) throw error;
                if (!data?.signedUrl) throw new Error('Failed to create signed URL');

                return data.signedUrl;
            } catch (error) {
                console.error('Signed URL error:', error);
                throw error;
            }
        },
        [getStorageClient]
    );

    const getProcessingStatus = useCallback(
        async (filePath: string): Promise<string> => {
            const result = await db.execute(
                `
                    SELECT status
                    FROM processed_data
                    WHERE processed_path = ?
                    ORDER BY timestamp DESC
                    LIMIT 1
                `,
                [filePath]
            );
            //@ts-ignore
            return result[0]?.status || 'unknown';
        },
        []
    );

    return {
        uploadFile,
        uploadFiles,
        downloadFile,
        getFileMetadata,
        deleteFile,
        getSignedUrl,
        fileExists,
        getProcessingStatus,
    };
};
