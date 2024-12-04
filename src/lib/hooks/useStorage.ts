// src/lib/hooks/useStorage.ts

import { useCallback } from 'react';
import { db } from '../powersync/db.ts';
import { useAuth } from './useAuth.ts';

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
    const { connector } = useAuth();

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
            bucket: string, // Add bucket parameter
            onProgress?: (progress: UploadProgress) => void
        ): Promise<string> => {
            try {
                const storage = getStorageClient();
                const { data, error } = await storage
                    .from(bucket) // Use the bucket parameter
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

                // Record the upload in PowerSync
                await db.execute(
                    `
                        INSERT INTO file_uploads (
                            id,
                            file_path,
                            file_name,
                            file_size,
                            upload_date,
                            status
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        `${path}:${Date.now()}`,
                        data.path,
                        file.name,
                        file.size,
                        new Date().toISOString(),
                        'completed',
                    ]
                );

                return data.path;
            } catch (error) {
                console.error('Upload error:', error);
                throw error;
            }
        },
        [getStorageClient]
    );

    const uploadFiles = useCallback(
        async (
            files: File[],
            basePath: string,
            bucket: string, // Add bucket parameter
            onProgress?: (progress: UploadProgress) => void
        ): Promise<string[]> => {
            const paths: string[] = [];
            let totalUploaded = 0;
            const totalSize = files.reduce((acc, f) => acc + f.size, 0);

            for (const file of files) {
                const path = `${basePath}/${file.name}`;
                await uploadFile(file, path, bucket, (progress) => {
                    if (onProgress) {
                        onProgress({
                            progress:
                                ((totalUploaded + progress.bytesUploaded) / totalSize) * 100,
                            bytesUploaded: totalUploaded + progress.bytesUploaded,
                            totalBytes: totalSize,
                        });
                    }
                });
                paths.push(path);
                totalUploaded += file.size;
            }

            return paths;
        },
        [uploadFile]
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
