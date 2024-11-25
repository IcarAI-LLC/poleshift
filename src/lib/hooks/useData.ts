// src/lib/hooks/useData.ts

import { useCallback } from 'react';
import { useAppState } from '../contexts/AppContext';
import { api } from '../api';
import { storage } from '../storage';
import { syncManager } from '../storage/sync';
import { SampleGroup } from '../types';

export function useData() {
    const { state, dispatch } = useAppState();
    const { data } = state;

    const createSampleGroup = useCallback(async (sampleGroup: Omit<SampleGroup, 'id'>) => {
        try {
            dispatch({ type: 'SET_SYNCING', payload: true });

            // Create locally first
            const newGroup: SampleGroup = {
                ...sampleGroup,
                id: crypto.randomUUID()
            };

            await storage.saveSampleGroup(newGroup);
            dispatch({ type: 'ADD_SAMPLE_GROUP', payload: newGroup });

            // If online, create on server
            if (navigator.onLine) {
                const serverGroup = await api.data.createSampleGroup(sampleGroup);
                await storage.saveSampleGroup(serverGroup);
                dispatch({ type: 'UPDATE_SAMPLE_GROUP', payload: serverGroup });
                return serverGroup;
            }

            // If offline, queue for sync
            await storage.addPendingOperation({
                type: 'insert',
                table: 'sample_group_metadata',
                data: newGroup,
                timestamp: Date.now()
            });

            return newGroup;
        } catch (error: any) {
            dispatch({ type: 'SET_DATA_ERROR', payload: error.message });
            throw error;
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [dispatch]);

    const updateSampleGroup = useCallback(async (id: string, updates: Partial<SampleGroup>) => {
        try {
            dispatch({ type: 'SET_SYNCING', payload: true });

            // Update locally first
            const currentGroup = await storage.getSampleGroup(id);
            if (!currentGroup) throw new Error('Sample group not found');

            const updatedGroup = { ...currentGroup, ...updates };
            await storage.saveSampleGroup(updatedGroup);
            dispatch({ type: 'UPDATE_SAMPLE_GROUP', payload: updatedGroup });

            // If online, update on server
            if (navigator.onLine) {
                const serverGroup = await api.data.updateSampleGroup(id, updates);
                await storage.saveSampleGroup(serverGroup);
                dispatch({ type: 'UPDATE_SAMPLE_GROUP', payload: serverGroup });
                return serverGroup;
            }

            // If offline, queue for sync
            await storage.addPendingOperation({
                type: 'update',
                table: 'sample_group_metadata',
                data: { id, updates },
                timestamp: Date.now()
            });

            return updatedGroup;
        } catch (error: any) {
            dispatch({ type: 'SET_DATA_ERROR', payload: error.message });
            throw error;
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [dispatch]);

    const deleteSampleGroup = useCallback(async (id: string) => {
        try {
            dispatch({ type: 'SET_SYNCING', payload: true });

            // Delete locally first
            await storage.deleteSampleGroup(id);
            dispatch({ type: 'DELETE_SAMPLE_GROUP', payload: id });

            // If online, delete on server
            if (navigator.onLine) {
                await api.data.deleteSampleGroup(id);
            } else {
                // If offline, queue for sync
                await storage.addPendingOperation({
                    type: 'delete',
                    table: 'sample_group_metadata',
                    data: { id },
                    timestamp: Date.now()
                });
            }
        } catch (error: any) {
            dispatch({ type: 'SET_DATA_ERROR', payload: error.message });
            throw error;
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [dispatch]);

    const syncData = useCallback(async () => {
        if (!state.auth.organization?.id) return;

        try {
            dispatch({ type: 'SET_SYNCING', payload: true });
            await syncManager.fullSync(state.auth.organization.id);
            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
        } catch (error: any) {
            dispatch({ type: 'SET_DATA_ERROR', payload: error.message });
            throw error;
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [dispatch, state.auth.organization?.id]);

    return {
        sampleGroups: data.sampleGroups,
        fileTree: data.fileTree,
        locations: data.locations,
        processingJobs: data.processingJobs,
        isSyncing: data.isSyncing,
        lastSynced: data.lastSynced,
        error: data.error,
        createSampleGroup,
        updateSampleGroup,
        deleteSampleGroup,
        syncData
    };
}