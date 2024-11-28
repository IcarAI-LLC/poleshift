// lib/hooks/useData.ts
import { useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { SampleGroupMetadata, FileNode } from '../types';

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

    const updateFileTree = useCallback(async (updatedTree: FileNode[]) => {
        try {
            await dataService.updateFileTree(updatedTree);
            dispatch({ type: 'SET_FILE_TREE', payload: updatedTree });
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to update file tree' });
            throw error;
        }
    }, [dataService, dispatch]);

    const deleteNode = useCallback(async (nodeId: string) => {
        try {
            // Delete from local storage first
            await dataService.deleteNode(nodeId);

            // Update file tree state by removing the node
            const removeNodeFromTree = (nodes: FileNode[]): FileNode[] => {
                return nodes.filter(node => {
                    if (node.id === nodeId) {
                        return false;
                    }
                    if (node.children) {
                        node.children = removeNodeFromTree(node.children);
                    }
                    return true;
                });
            };

            const updatedTree = removeNodeFromTree([...state.data.fileTree]);
            dispatch({ type: 'SET_FILE_TREE', payload: updatedTree });

            // If online, sync with remote
            if (services.network.isOnline()) {
                await syncService.deleteRemote('file_nodes', nodeId);
            } else {
                // Queue for later sync
                await services.operationQueue.enqueue({
                    type: 'delete',
                    table: 'file_nodes',
                    data: { id: nodeId }
                });
            }
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to delete node' });
            throw error;
        }
    }, [dataService, syncService, services.network, services.operationQueue, state.data.fileTree, dispatch]);

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

    const updateSampleGroup = useCallback(async (id: string, updates: Partial<SampleGroupMetadata>) => {
        try {
            // Get the existing sample group
            const existingSampleGroup = state.data.sampleGroups[id];
            if (!existingSampleGroup) {
                throw new Error('Sample group not found');
            }

            // Create updated sample group
            const updatedSampleGroup = {
                ...existingSampleGroup,
                ...updates,
                updated_at: new Date().toISOString()
            };

            // Save to storage and handle sync
            await dataService.updateSampleGroup(id, updatedSampleGroup);

            // Update local state
            dispatch({
                type: 'UPDATE_SAMPLE_GROUP',
                payload: updatedSampleGroup
            });
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to update sample group' });
            throw error;
        }
    }, [state.data.sampleGroups, dataService, dispatch]);

    // Return existing functions plus updateSampleGroup
    return {
        fileTree: state.data.fileTree,
        sampleGroups: state.data.sampleGroups,
        locations: state.data.locations,
        isSyncing: state.data.isSyncing,
        error: state.data.error,  // Add this line
        createSampleGroup,
        updateSampleGroup,  // Add this
        updateFileTree,
        deleteNode,
        syncData
    };
}