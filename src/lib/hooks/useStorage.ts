// src/lib/hooks/useStorage.ts

import { useCallback, useEffect } from 'react';
import { db } from '../powersync/db';
import { useAuth } from './useAuth';
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
import { useSnackbar } from 'notistack'; // Assuming you use notistack for notifications

interface UploadProgress {
    progress: number;
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
    const { organization } = useAuth();
    const { enqueueSnackbar } = useSnackbar(); // For notifications

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
            onProgress?: (progress: UploadProgress) => void
        ): Promise<string> => {
            try {
                const storage = getStorageClient();
                const { data, error } = await storage
                    .from(bucket)
                    .upload(path, file, {
                        onUploadProgress: ({ loaded, total }) => {
                            if (onProgress && total) {
                                onProgress({
                                    progress: (loaded / total) * 100,
                                    bytesUploaded: loaded,
                                    totalBytes: total,
                                });
                            }
                        },
                    });

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
                enqueueSnackbar(`File "${file.name}" already exists. Removed from queue.`, { variant: 'info' });
                continue;
            }

            try {
                await uploadFile(file, path, bucket, (progress) => {
                    // Optionally, you can update the uploadTask with progress here
                    // e.g., updateQueueItem({ ...uploadTask, progress: progress.progress });
                });

                // On success, remove from queue
                await removeFromQueue(id);
                enqueueSnackbar(`Successfully uploaded "${file.name}".`, { variant: 'success' });
                console.log(`Successfully uploaded ${file.name} from queue.`);
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);

                // Update retries
                if (retries < 3) { // Retry up to 3 times
                    await updateQueueItem({
                        ...uploadTask,
                        retries: retries + 1,
                    });
                    enqueueSnackbar(`Retrying upload for "${file.name}". Attempt ${retries + 1}`, { variant: 'warning' });
                    console.log(`Retrying upload for ${file.name}. Attempt ${retries + 1}`);
                } else {
                    // Exceeded retry attempts, notify the user
                    enqueueSnackbar(`Max retries exceeded for "${file.name}". Upload failed.`, { variant: 'error' });
                    console.error(`Max retries exceeded for ${file.name}. Upload failed.`);
                    await removeFromQueue(id); // Optionally remove or keep for manual intervention
                }
            }
        }
    }, [isOnline, uploadFile, enqueueSnackbar]);

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
                return data.length > 0;
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
            let totalUploaded = 0;
            const totalSize = files.reduce((acc, f) => acc + f.size, 0);

            for (const file of files) {
                const path = `${basePath}/${file.name}`;

                if (isOnline) {
                    // Check if file already exists before uploading
                    const exists = await fileExists(path);
                    if (exists) {
                        enqueueSnackbar(`File "${file.name}" already exists. Skipping upload.`, { variant: 'info' });
                        paths.push(path);
                        continue;
                    }

                    try {
                        const uploadedPath = await uploadFile(file, path, bucket, (progress) => {
                            if (onProgress) {
                                onProgress({
                                    progress:
                                        ((totalUploaded + progress.bytesUploaded) / totalSize) * 100,
                                    bytesUploaded: totalUploaded + progress.bytesUploaded,
                                    totalBytes: totalSize,
                                });
                            }
                        });
                        paths.push(uploadedPath);
                        totalUploaded += file.size;
                    } catch (error) {
                        // If upload fails while online, queue the upload
                        console.error(`Failed to upload ${file.name} while online. Queuing...`);
                        const uploadTask: UploadTask = {
                            id: uuidv4(),
                            file,
                            path,
                            bucket,
                            retries: 0,
                        };
                        await addToQueue(uploadTask);
                        enqueueSnackbar(`Queued upload for "${file.name}".`, { variant: 'warning' });
                        paths.push(path); // Optionally push the path or handle differently
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
                    };
                    await addToQueue(uploadTask);
                    enqueueSnackbar(`Queued upload for "${file.name}" (Offline).`, { variant: 'info' });
                    paths.push(path); // Optionally push the path or handle differently
                }
            }

            return paths;
        },
        [uploadFile, isOnline, fileExists, enqueueSnackbar]
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
