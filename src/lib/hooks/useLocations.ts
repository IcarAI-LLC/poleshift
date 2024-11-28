//lib/hooks/useLocations
import { useContext, useCallback, useMemo, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { SampleLocation } from '../types';

export function useLocations() {
    const { state, dispatch, services } = useContext(AppContext);
    const { data: dataService, sync: syncService } = services;

    // Initialize locations
    useEffect(() => {
        let mounted = true;

        async function initializeLocations() {
            try {

                // First try to load from IndexedDB
                const localLocations = await dataService.storage.getAllLocations();

                if (mounted && localLocations && localLocations.length > 0) {
                    // Immediately dispatch local locations
                    dispatch({ type: 'SET_LOCATIONS', payload: localLocations });
                }

                // Then sync with remote if online
                if (mounted && services.network.isOnline()) {
                    await syncService.syncFromRemote('sample_locations');
                    const remoteLocations = await dataService.storage.getAllLocations();

                    if (mounted && remoteLocations && remoteLocations.length > 0) {
                        dispatch({ type: 'SET_LOCATIONS', payload: remoteLocations });
                    }
                }
            } catch (error) {
                if (mounted) {
                    dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to load locations' });
                }
            }
        }

        // Run initialization
        initializeLocations();

        return () => {
            mounted = false;
        };
    }, [dispatch, dataService.storage, services.network, syncService]);

    // Get locations from state with additional logging
    const allLocations = useMemo(() => {
        return state.data.locations || [];
    }, [state.data.locations]);

    // Get enabled locations
    const enabledLocations = useMemo(() => {
        return allLocations.filter(location => location.is_enabled);
    }, [allLocations]);

    // Get a location by ID
    const getLocationById = useCallback((locationId: string | null) => {
        if (!locationId) return null;
        return allLocations.find(location => location.id === locationId) || null;
    }, [allLocations]);

    // Get locations by IDs
    const getLocationsByIds = useCallback((locationIds: string[]) => {
        return allLocations.filter(location => locationIds.includes(location.id));
    }, [allLocations]);

    // Sync locations
    const syncLocations = useCallback(async () => {
        try {
            dispatch({ type: 'SET_SYNCING', payload: true });
            await syncService.syncFromRemote('sample_locations');
            const locations = await dataService.storage.getAllLocations();
            dispatch({ type: 'SET_LOCATIONS', payload: locations });
            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to sync locations' });
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [dispatch, syncService, dataService.storage]);

    // Update location
    const updateLocation = useCallback(async (
        locationId: string,
        updates: Partial<SampleLocation>
    ) => {
        try {
            const location = getLocationById(locationId);
            if (!location) throw new Error('Location not found');

            const updatedLocation = { ...location, ...updates };
            await dataService.storage.saveLocation(updatedLocation);

            if (services.network.isOnline()) {
                await syncService.updateRemote('sample_locations', updatedLocation);
            } else {
                await services.operationQueue.enqueue({
                    type: 'update',
                    table: 'sample_locations',
                    data: updatedLocation
                });
            }

            // Update state with the new locations
            const updatedLocations = allLocations.map(loc =>
                loc.id === locationId ? updatedLocation : loc
            );
            dispatch({ type: 'SET_LOCATIONS', payload: updatedLocations });

        } catch (error: any) {
            console.error('Failed to update location:', error);
            dispatch({
                type: 'SET_ERROR_MESSAGE',
                payload: error.message || 'Failed to update location'
            });
            throw error;
        }
    }, [allLocations, getLocationById, dataService.storage, services.network, services.operationQueue, syncService, dispatch]);

    return {
        allLocations,
        enabledLocations,
        getLocationById,
        getLocationsByIds,
        syncLocations,
        updateLocation,
    };
}