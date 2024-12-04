import { supabase } from '../supabaseClient';
import { db } from '../powersync/db';
import { api } from './api';

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

type ProgressCallback = (progress: number) => void;

class StorageService {
    // Upload file with progress tracking
    async uploadFile(
        file: File,
        path: string,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<string> {
        try {
            const { data, error } = await supabase.storage
                .from('processed-data')
                .upload(path, file, {
                    onUploadProgress: ({ loaded, total }) => {
                        if (onProgress && total) {
                            onProgress({
                                progress: (loaded / total) * 100,
                                bytesUploaded: loaded,
                                totalBytes: total
                            });
                        }
                    }
                });

            if (error) throw error;
            if (!data) throw new Error('Upload failed');

            // Record the upload in the database
            await db.execute(`
                INSERT INTO file_uploads (
                    file_path,
                    file_name,
                    file_size,
                    upload_date
                ) VALUES (?, ?, ?, ?)
            `, [
                data.path,
                file.name,
                file.size,
                new Date().toISOString()
            ]);

            return data.path;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    // Upload multiple files
    async uploadFiles(
        files: File[],
        basePath: string,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<string[]> {
        const paths: string[] = [];
        let totalUploaded = 0;

        for (const file of files) {
            const path = `${basePath}/${file.name}`;
            await this.uploadFile(file, path, (progress) => {
                if (onProgress) {
                    const overallProgress = {
                        progress: ((totalUploaded + progress.bytesUploaded) /
                            (files.reduce((acc, f) => acc + f.size, 0))) * 100,
                        bytesUploaded: totalUploaded + progress.bytesUploaded,
                        totalBytes: files.reduce((acc, f) => acc + f.size, 0)
                    };
                    onProgress(overallProgress);
                }
            });
            paths.push(path);
            totalUploaded += file.size;
        }

        return paths;
    }

    // Download file with progress tracking
    async downloadFile(
        path: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<Blob> {
        try {
            const { data, error } = await supabase.storage
                .from('processed-data')
                .download(path, {
                    onDownloadProgress: ({ loaded, total }) => {
                        if (onProgress && total) {
                            onProgress({
                                progress: (loaded / total) * 100,
                                bytesDownloaded: loaded,
                                totalBytes: total
                            });
                        }
                    }
                });

            if (error) throw error;
            if (!data) throw new Error('Download failed');

            return data;
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    }

    // Get file metadata
    async getFileMetadata(path: string): Promise<any> {
        try {
            const { data, error } = await supabase.storage
                .from('processed-data')
                .list(path);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Metadata fetch error:', error);
            throw error;
        }
    }

    // Delete file
    async deleteFile(path: string): Promise<void> {
        try {
            const { error } = await supabase.storage
                .from('processed-data')
                .remove([path]);

            if (error) throw error;

            // Remove file record from database
            await db.execute(`
                DELETE FROM file_uploads 
                WHERE file_path = ?
            `, [path]);
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    }

    // Get signed URL for file sharing
    async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
        try {
            const { data, error } = await supabase.storage
                .from('processed-data')
                .createSignedUrl(path, expiresIn);

            if (error) throw error;
            if (!data?.signedUrl) throw new Error('Failed to create signed URL');

            return data.signedUrl;
        } catch (error) {
            console.error('Signed URL error:', error);
            throw error;
        }
    }

    // Check if file exists
    async fileExists(path: string): Promise<boolean> {
        try {
            const { data, error } = await supabase.storage
                .from('processed-data')
                .list(path);

            if (error) throw error;
            return data.length > 0;
        } catch (error) {
            console.error('File check error:', error);
            throw error;
        }
    }

    // Get file processing status
    async getProcessingStatus(filePath: string): Promise<string> {
        const result = await db.execute(`
            SELECT status 
            FROM processed_data 
            WHERE processed_path = ?
            ORDER BY timestamp DESC
            LIMIT 1
        `, [filePath]);

        return result[0]?.status || 'unknown';
    }
}

// Export singleton instance
export const storage = new StorageService();