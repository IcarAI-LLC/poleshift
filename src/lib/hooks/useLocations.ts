import { useContext, useCallback, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useNetworkStatus } from './useNetworkStatus';
import type { SampleLocation } from '../types';

export function useLocations() {
    const { state, dispatch, services } = useContext(AppContext);
    const { data: dataService, sync: syncService } = services;
    const { isOnline } = useNetworkStatus();

    // Initialize locations
    useEffect(() => {
        let mounted = true;

        async function initializeLocations() {
            try {
                // First load from local storage (offline-first approach)
                const localLocations = await dataService.getAllSampleLocations();

                if (mounted && localLocations && localLocations.length > 0) {
                    dispatch({ type: 'SET_LOCATIONS', payload: localLocations });
                }

                // Then sync with remote if online
                if (mounted && isOnline) {
                    dispatch({ type: 'SET_SYNCING', payload: true });

                    try {
                        await syncService.syncFromRemote('sample_locations');
                        const remoteLocations = await dataService.getAllSampleLocations();

                        if (mounted && remoteLocations && remoteLocations.length > 0) {
                            dispatch({ type: 'SET_LOCATIONS', payload: remoteLocations });
                        }

                        if (mounted) {
                            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
                        }
                    } finally {
                        if (mounted) {
                            dispatch({ type: 'SET_SYNCING', payload: false });
                        }
                    }
                }
            } catch (error) {
                if (mounted) {
                    dispatch({ type: 'SET_DATA_ERROR', payload: 'Failed to load locations' });
                }
            }
        }

        initializeLocations();

        return () => {
            mounted = false;
        };
    }, [dispatch, dataService, isOnline, syncService]);

    // Memoized selectors
    const allLocations = useMemo(() => {
        return state.data.locations || [];
    }, [state.data.locations]);

    const enabledLocations = useMemo(() => {
        return allLocations.filter(location => location.is_enabled);
    }, [allLocations]);

    // Location retrieval functions
    const getLocationById = useCallback((locationId: string | null) => {
        if (!locationId) return null;
        return allLocations.find(location => location.id === locationId) || null;
    }, [allLocations]);

    const getLocationsByIds = useCallback((locationIds: string[]) => {
        return allLocations.filter(location => locationIds.includes(location.id));
    }, [allLocations]);

    // Sync locations
    const syncLocations = useCallback(async () => {
        if (!isOnline) return;

        try {
            dispatch({ type: 'SET_SYNCING', payload: true });

            await syncService.syncFromRemote('sample_locations');
            const locations = await dataService.getAllSampleLocations();

            dispatch({ type: 'SET_LOCATIONS', payload: locations });
            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
        } catch (error) {
            dispatch({ type: 'SET_DATA_ERROR', payload: 'Failed to sync locations' });
            throw error;
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [dispatch, syncService, dataService, isOnline]);

    // Update location
    const updateLocation = useCallback(async (
        locationId: string,
        updates: Partial<SampleLocation>
    ) => {
        try {
            const location = getLocationById(locationId);
            if (!location) throw new Error('Location not found');

            const updatedLocation = { ...location, ...updates };

            // Save locally first
            await dataService.storage.saveLocation(updatedLocation);

            // Handle remote sync
            if (isOnline) {
                await syncService.updateRemote('sample_locations', updatedLocation);
            } else {
                await services.operationQueue.enqueue({
                    type: 'update',
                    table: 'sample_locations',
                    data: updatedLocation
                });
            }

            // Update local state
            const updatedLocations = allLocations.map(loc =>
                loc.id === locationId ? updatedLocation : loc
            );
            dispatch({ type: 'SET_LOCATIONS', payload: updatedLocations });

        } catch (error: any) {
            console.error('Failed to update location:', error);
            dispatch({
                type: 'SET_DATA_ERROR',
                payload: error.message || 'Failed to update location'
            });
            throw error;
        }
    }, [
        allLocations,
        getLocationById,
        dataService.storage,
        isOnline,
        services.operationQueue,
        syncService,
        dispatch
    ]);

    return {
        allLocations,
        enabledLocations,
        getLocationById,
        getLocationsByIds,
        syncLocations,
        updateLocation,
    };
}