import { useCallback, useEffect, useMemo } from 'react';
import { useAppState } from '../contexts/AppContext';
import { api } from '../api';
import type { ResearchLocation } from '../types';
import { storage } from '../storage';

export interface LocationsHookResult {
    locations: ResearchLocation[];
    allLocations: ResearchLocation[];
    getLocationById: (id: string | null) => ResearchLocation | null;
    getLocationByCharId: (charId: string) => ResearchLocation | null;
    isLoading: boolean;
    error: string | null;
    synchronizeLocations: () => Promise<void>;
}

export function useLocations(): LocationsHookResult {
    const { state, dispatch } = useAppState();
    const { locations } = state.data;

    const synchronizeLocations = useCallback(async () => {
        if (state.data.isSyncing) return;

        dispatch({ type: 'SET_SYNCING', payload: true });

        try {
            const serverLocations = await api.data.getLocations();
            await storage.saveLocations(serverLocations);

            dispatch({
                type: 'SET_LOCATIONS',
                payload: serverLocations
            });

            dispatch({
                type: 'SET_LAST_SYNCED',
                payload: Date.now()
            });
        } catch (error) {
            console.error('Error syncing locations:', error);
            dispatch({
                type: 'SET_DATA_ERROR',
                payload: 'Failed to sync locations'
            });

            const cachedLocations = await storage.getLocations();
            if (cachedLocations.length > 0) {
                dispatch({
                    type: 'SET_LOCATIONS',
                    payload: cachedLocations
                });
            }
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [dispatch, state.data.isSyncing]);

    // Initial sync on mount and when coming back online
    useEffect(() => {
        const handleOnline = () => {
            synchronizeLocations();
        };

        // Initial sync
        if (locations.length === 0) {
            synchronizeLocations();
        }

        // Listen for online events
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [synchronizeLocations, locations.length]);

    const getLocationById = useCallback((id: string | null) => {
        if (!id) return null;
        return locations.find(location => location.id === id) ?? null;
    }, [locations]);

    const getEnabledLocations = useMemo(() =>
            locations.filter(location => location.is_enabled),
        [locations]
    );

    const locationsByCharId = useMemo(() =>
            locations.reduce<Record<string, ResearchLocation>>((acc, location) => {
                acc[location.char_id] = location;
                return acc;
            }, {}),
        [locations]
    );

    const getLocationByCharId = useCallback((charId: string) =>
            locationsByCharId[charId] ?? null,
        [locationsByCharId]
    );

    return {
        locations: getEnabledLocations,
        allLocations: locations,
        getLocationById,
        getLocationByCharId,
        synchronizeLocations,
        isLoading: state.data.isSyncing,
        error: state.data.error
    };
}