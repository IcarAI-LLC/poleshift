// src/lib/hooks/useUploadQueue.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllQueuedUploads, removeFromQueue, UploadTask } from '../utils/uploadQueue';
import { useStorage } from './useStorage';

export const useUploadQueue = () => {
    const [isUploadQueueOpen, setIsUploadQueueOpen] = useState(false);
    const [queuedUploads, setQueuedUploads] = useState<UploadTask[]>([]);
    const previousQueueRef = useRef<UploadTask[]>([]);
    const storage = useStorage();

    const fetchQueuedUploads = useCallback(async () => {
        const uploads = await getAllQueuedUploads();
        const updatedUploads: UploadTask[] = [];

        for (const upload of uploads) {
            const exists = await storage.fileExists(upload.path);
            if (exists) {
                await removeFromQueue(upload.id);
            } else {
                updatedUploads.push(upload);
            }
        }

        previousQueueRef.current = updatedUploads;
        setQueuedUploads(updatedUploads);
    }, [storage.fileExists]);

    useEffect(() => {
        fetchQueuedUploads();
        const interval = setInterval(fetchQueuedUploads, 5000);
        return () => clearInterval(interval);
    }, [fetchQueuedUploads]);

    const toggleUploadQueue = useCallback(() => {
        setIsUploadQueueOpen(prev => !prev);
    }, []);

    return {
        isUploadQueueOpen,
        setIsUploadQueueOpen,
        queuedUploads,
        setQueuedUploads,
        toggleUploadQueue
    };
};