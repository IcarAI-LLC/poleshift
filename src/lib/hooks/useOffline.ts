// src/lib/hooks/useOffline.ts

import { useCallback, useEffect, useState } from 'react';
import { storage } from '../storage';
import { syncManager } from '../storage/sync';

export function useOffline() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    const checkPendingChanges = useCallback(async () => {
        const operations = await storage.getPendingOperations();
        setHasPendingChanges(operations.length > 0);
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (hasPendingChanges) {
                syncManager.syncPendingOperations();
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        checkPendingChanges();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [hasPendingChanges, checkPendingChanges]);

    return {
        isOnline,
        hasPendingChanges,
        checkPendingChanges
    };
}