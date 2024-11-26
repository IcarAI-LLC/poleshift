// lib/hooks/useData.ts
import { useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { SampleGroupMetadata } from '../types';

export function useData() {
    const { state, dispatch, services } = useContext(AppContext);
    const { data: dataService, sync: syncService } = services;

    const createSampleGroup = useCallback(async (data: Partial<SampleGroupMetadata>) => {
        try {
            await dataService.createSampleGroup(data);
            dispatch({ type: 'ADD_SAMPLE_GROUP', payload: data as SampleGroupMetadata });
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to create sample group' });
            throw error;
        }
    }, [dataService, dispatch]);

    const syncData = useCallback(async () => {
        if (!state.auth.organization?.id) return;

        try {
            dispatch({ type: 'SET_SYNCING', payload: true });
            await syncService.syncToRemote();
            await syncService.syncFromRemote('file_nodes', state.auth.organization.id);
            await syncService.syncFromRemote('sample_metadata', state.auth.organization.id);
            await syncService.syncFromRemote('sample_group_metadata', state.auth.organization.id);
            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Sync failed' });
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [state.auth.organization, syncService, dispatch]);

    return {
        fileTree: state.data.fileTree,
        sampleGroups: state.data.sampleGroups,
        locations: state.data.locations,
        isSyncing: state.data.isSyncing,
        createSampleGroup,
        syncData
    };
}