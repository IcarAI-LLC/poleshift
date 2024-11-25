// lib/api/storage.ts
import { apiClient } from './client';

export const fileStorage = {
    async uploadFile(bucket: string, path: string, file: File): Promise<string> {
        const { data, error } = await apiClient
            .getClient()
            .storage
            .from(bucket)
            .upload(path, file, { upsert: true });

        if (error) throw error;
        return data.path;
    },

    async downloadFile(bucket: string, path: string): Promise<Blob> {
        const { data, error } = await apiClient
            .getClient()
            .storage
            .from(bucket)
            .download(path);

        if (error) throw error;
        return data;
    },

    async removeFiles(bucket: string, paths: string[]): Promise<void> {
        const { error } = await apiClient
            .getClient()
            .storage
            .from(bucket)
            .remove(paths);

        if (error) throw error;
    },

    async listFiles(bucket: string, path: string): Promise<string[]> {
        const { data, error } = await apiClient
            .getClient()
            .storage
            .from(bucket)
            .list(path);

        if (error) throw error;
        return data.map(item => item.name);
    }
};