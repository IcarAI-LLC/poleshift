// useNetworkStatus.ts

import { useEffect, useCallback, useState } from 'react';
import { networkService } from '../services/EnhancedNetworkService';

/**
 * Custom hook to track the network status of the client. It provides functionality to check if the client is online
 * and a method to wait for a network connection to become active.
 *
 * @return {Object} An object containing:
 * - `isOnline`: A boolean representing whether the client is currently online.
 * - `waitForConnection`: A function that returns a promise resolving to a boolean indicating if a connection was
 *   established within the given timeout period.
 */
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
