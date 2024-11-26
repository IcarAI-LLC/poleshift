// lib/hooks/useOffline.ts
//@ts-ignore
import { useState, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';

export function useOffline() {
    //@ts-ignore
    const { state, services } = useContext(AppContext);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const checkPendingChanges = async () => {
            const operations = await services.data.storage.getPendingOperations();
            setHasPendingChanges(operations.length > 0);
        };

        checkPendingChanges();
    }, [services.data.storage]);

    return {
        isOnline,
        hasPendingChanges
    };
}