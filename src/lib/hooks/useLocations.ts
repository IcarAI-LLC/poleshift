import { useContext, useCallback, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { SampleLocation } from '../types';

export function useLocations() {
    const { state, dispatch, services } = useContext(AppContext);
    const { data: dataService, sync: syncService } = services;

    // Get all locations from the state
    const allLocations = useMemo(() => {
        return state.data.locations || [];
    }, [state.data.locations]);

    // Get a location by ID
    const getLocationById = useCallback((locationId: string | null) => {
        if (!locationId) return null;
        return allLocations.find(location => location.id === locationId) || null;
    }, [allLocations]);

    // Get enabled locations
    const enabledLocations = useMemo(() => {
        return allLocations.filter(location => location.is_enabled);
    }, [allLocations]);

    // Get locations by IDs
    const getLocationsByIds = useCallback((locationIds: string[]) => {
        return allLocations.filter(location => locationIds.includes(location.id));
    }, [allLocations]);

    // Sync locations
    const syncLocations = useCallback(async () => {
        if (!state.auth.organization?.id) return;

        try {
            dispatch({ type: 'SET_SYNCING', payload: true });

            // Sync from remote
            await syncService.syncFromRemote('sample_locations', state.auth.organization.id);

            // Get updated locations from local storage
            const locations = await dataService.getLocations();

            // Update state with new locations
            dispatch({ type: 'SET_LOCATIONS', payload: locations });

            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to sync locations' });
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [state.auth.organization, syncService, dataService, dispatch]);

    // Update location
    const updateLocation = useCallback(async (locationId: string, updates: Partial<SampleLocation>) => {
        try {
            // Update locally first
            const location = getLocationById(locationId);
            if (!location) throw new Error('Location not found');

            const updatedLocation = { ...location, ...updates };

            // Save to local storage
            await dataService.storage.saveLocation(updatedLocation);

            // If online, sync to remote
            if (services.network.isOnline()) {
                await syncService.updateRemote('sample_locations', updatedLocation);
            } else {
                // Queue for later sync
                await services.operationQueue.enqueue({
                    type: 'update',
                    table: 'sample_locations',
                    data: updatedLocation
                });
            }

            // Update state
            dispatch({
                type: 'SET_LOCATIONS',
                payload: allLocations.map(loc =>
                    loc.id === locationId ? updatedLocation : loc
                )
            });
        } catch (error: any) {
            dispatch({
                type: 'SET_ERROR_MESSAGE',
                payload: error.message || 'Failed to update location'
            });
            throw error;
        }
    }, [
        getLocationById,
        dataService,
        services.network,
        services.operationQueue,
        syncService,
        dispatch,
        allLocations
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