// useNetworkStatus.ts

import { useEffect, useCallback, useState } from 'react';
import { networkService } from '../services/EnhancedNetworkService';

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOnline(navigator.onLine);
        };

        networkService.addOnlineListener(updateOnlineStatus);
        networkService.addOfflineListener(updateOnlineStatus);

        // Initialize network service
        networkService.initialize();

        // Cleanup listeners on unmount
        return () => {
            networkService.removeOnlineListener(updateOnlineStatus);
            networkService.removeOfflineListener(updateOnlineStatus);
            networkService.destroy();
        };
    }, []);

    const waitForConnection = useCallback(
        async (timeout: number = 30000, interval: number = 1000): Promise<boolean> => {
            const startTime = Date.now();

            while (Date.now() - startTime < timeout) {
                if (await networkService.hasActiveConnection()) {
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, interval));
            }

            return false;
        },
        []
    );

    return {
        isOnline,
        waitForConnection,
    };
}
