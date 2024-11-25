import { useCallback, useMemo } from 'react';
import { useAppState } from '../contexts/AppContext';
import { api } from '../api';
import type { Location } from '../types/location.ts'; // Use explicit type import
import { storage } from '../storage';

export interface LocationsHookResult {
    locations: Location[];
    allLocations: Location[];
    getLocationById: (id: string | null) => Location | null;
    getLocationByCharId: (charId: string) => Location | null;
    isLoading: boolean;
    error: string | null;
}

export function useLocations(): LocationsHookResult {
    const { state, dispatch } = useAppState();
    const { locations } = state.data;

    const synchronizeLocations = useCallback(async () => {
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
    }, [dispatch]);


    const getLocationById = useCallback((id: string | null) => {
        if (!id) return null;
        return locations.find(location => location.id === id) ?? null;
    }, [locations]);

    const getEnabledLocations = useMemo(() =>
            locations.filter(location => location.is_enabled),
        [locations]
    );

    const locationsByCharId = useMemo(() =>
            locations.reduce<Record<string, Location>>((acc, location) => {
                acc[location.char_id] = location;
                return acc;
            }, {}),
        [locations]
    );

    return {
        locations: getEnabledLocations,
        allLocations: locations,
        getLocationById,
        getLocationByCharId: useCallback((charId: string) =>
                locationsByCharId[charId] ?? null,
            [locationsByCharId]
        ),
        isLoading: state.data.isSyncing,
        error: state.data.error
    };
}