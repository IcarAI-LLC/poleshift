// src/lib/hooks/useData.ts

import { useCallback, useEffect } from 'react';
import { useAppState } from '../contexts/AppContext';
import { api } from '../api';
import { storage } from '../storage';
import { syncManager } from '../storage/sync';
import { SampleGroup } from '../types';
import { FileTreeService } from '../services/FileTreeService';
import { useAuth } from './useAuth';
import {fileTree} from "../api/fileTree.ts";

const POLLING_INTERVAL = 30000; // Poll every 30 seconds (adjust as needed)

export function useData() {
    const { state, dispatch } = useAppState();
    const { data } = state;
    const { organization } = useAuth();

    // Inside useData hook
    const refreshFileTree = useCallback(async () => {
        console.log("HERE!");
        if (!organization?.id) {
            return;
        }
        let fileNodes;
        if(window.navigator.onLine) {
            fileNodes = await fileTree.getFileNodes(organization.id);
            console.log("File nodes from supabase fetched: ", fileNodes)
        }
        else {
            fileNodes = await storage.getFileNodesByOrg(organization.id);
        }
        const treeItems = FileTreeService.getTreeItems(fileNodes);
        dispatch({ type: 'SET_FILE_TREE', payload: treeItems });
    }, [dispatch, organization?.id]);

    const createSampleGroup = useCallback(
        async (sampleGroup: SampleGroup) => {
            try {
                dispatch({ type: 'SET_SYNCING', payload: true });

                // Create locally first
                const newGroup: SampleGroup = {
                    ...sampleGroup,
                    id: crypto.randomUUID(),
                };

                await storage.saveSampleGroup(newGroup);
                dispatch({ type: 'ADD_SAMPLE_GROUP', payload: newGroup });

                // Create the sample group node in the file tree
                await FileTreeService.createSampleGroupNode(newGroup);

                // Refresh the file tree data
                await refreshFileTree();

                // If online, create on server
                if (navigator.onLine) {
                    const serverGroup = await api.data.createSampleGroup(sampleGroup);
                    await storage.saveSampleGroup(serverGroup);
                    dispatch({ type: 'UPDATE_SAMPLE_GROUP', payload: serverGroup });

                    // Create sample group node on server
                    await FileTreeService.createSampleGroupNode(serverGroup);

                    // Refresh the file tree data
                    await refreshFileTree();

                    return serverGroup;
                }

                // If offline, queue for sync
                await storage.addPendingOperation({
                    type: 'insert',
                    table: 'sample_group_metadata',
                    data: newGroup,
                    timestamp: Date.now(),
                });

                return newGroup;
            } catch (error: any) {
                dispatch({ type: 'SET_DATA_ERROR', payload: error.message });
                throw error;
            } finally {
                dispatch({ type: 'SET_SYNCING', payload: false });
            }
        },
        [dispatch, refreshFileTree]
    );

    const updateSampleGroup = useCallback(
        async (id: string, updates: Partial<SampleGroup>) => {
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
                    timestamp: Date.now(),
                });

                return updatedGroup;
            } catch (error: any) {
                dispatch({ type: 'SET_DATA_ERROR', payload: error.message });
                throw error;
            } finally {
                dispatch({ type: 'SET_SYNCING', payload: false });
            }
        },
        [dispatch]
    );

    const deleteSampleGroup = useCallback(
        async (id: string) => {
            try {
                dispatch({ type: 'SET_SYNCING', payload: true });

                // Delete locally first
                await storage.deleteSampleGroup(id);
                dispatch({ type: 'DELETE_SAMPLE_GROUP', payload: id });
                // Delete from file tree
                await FileTreeService.deleteNode(id);
                await storage.deleteFileNode(id);
                // Refresh the file tree data
                await refreshFileTree();

                // If online, delete on server
                if (navigator.onLine) {
                    await api.data.deleteSampleGroup(id);
                } else {
                    // If offline, queue for sync
                    await storage.addPendingOperation({
                        type: 'delete',
                        table: 'sample_group_metadata',
                        data: { id },
                        timestamp: Date.now(),
                    });
                }
            } catch (error: any) {
                dispatch({ type: 'SET_DATA_ERROR', payload: error.message });
                throw error;
            } finally {
                dispatch({ type: 'SET_SYNCING', payload: false });
            }
        },
        [dispatch, refreshFileTree]
    );

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

    // Add this useEffect to poll for changes
    useEffect(() => {
        if (!organization?.id) return;

        const interval = setInterval(() => {
            syncData();
        }, POLLING_INTERVAL);

        // Clean up on unmount or when organization ID changes
        return () => clearInterval(interval);
    }, [syncData, organization?.id]);

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
        syncData,
    };
}
