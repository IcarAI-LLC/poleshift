import { useEffect } from 'react';
import { useNetworkStore } from '../stores';

export function useNetworkStatus() {
    const {
        isOnline,
        connectionStrength,
        lastChecked,
        setOnlineStatus,
        setConnectionStrength,
        updateLastChecked,
        waitForConnection
    } = useNetworkStore();

    useEffect(() => {
        // Setup network listeners
        const handleOnline = () => {
            setOnlineStatus(true);
            updateLastChecked();
        };

        const handleOffline = () => {
            setOnlineStatus(false);
            setConnectionStrength('none');
            updateLastChecked();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup listeners
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setOnlineStatus, setConnectionStrength, updateLastChecked]);

    return {
        isOnline,
        connectionStrength,
        lastChecked,
        waitForConnection
    };
}