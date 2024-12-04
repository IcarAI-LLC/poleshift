//src/lib/init.ts

import { db, setupPowerSync } from './powersync/db';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { useDataStore } from './stores/dataStore';
import { useProcessStore } from './stores/processStore';
import { useNetworkStore } from './stores/networkStore';

// src/lib/init.ts

export async function initializeApp() {
    try {
        // Initialize stores
        const authStore = useAuthStore.getState();
        const networkStore = useNetworkStore.getState();

        // Initialize auth
        await authStore.initializeAuth();

        // Initialize network monitoring
        await networkStore.initialize();


        // Set up sync listeners
        db.registerListener({
            onConfigure: () => {
                console.log('PowerSync configured');
            },
            onConnect: () => {
                console.log('PowerSync connected');
            },
            onDisconnect: () => {
                console.log('PowerSync disconnected');
            },
            onError: (error) => {
                console.error('PowerSync error:', error);
            },
            onCrudOperation: (operation) => {
                console.log('PowerSync CRUD operation:', operation);
            }
        });

        return true;
    } catch (error) {
        console.error('Error initializing app:', error);
        throw error;
    }
}


export async function cleanupApp() {
    try {
        // Disconnect from PowerSync
        await db.disconnect();

        // Reset stores
        useAuthStore.setState({ user: null, userProfile: null, organization: null });
        useUIStore.setState({ selectedLeftItem: null, selectedRightItem: null });
        useDataStore.setState({ locations: [], fileNodes: {}, sampleGroups: {} });
        useProcessStore.setState({ processStatuses: {}, processedData: {} });
        useNetworkStore.setState({ isOnline: navigator.onLine });

        return true;
    } catch (error) {
        console.error('Error cleaning up app:', error);
        throw error;
    }
}