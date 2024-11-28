// lib/hooks/useData.ts
import { useContext, useCallback, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import type { SampleGroupMetadata, FileNode } from '../types';
import { arrayToRecord } from '../utils/arrayToRecord'; // Import the utility function

export function useData() {
    const { state, dispatch, services } = useContext(AppContext);
    const { data: dataService, sync: syncService } = services;

    // Initialization Effect
    useEffect(() => {
        let mounted = true;

        async function initializeData() {
            try {
                console.log("Starting data initialization");

                // Load fileTree from local storage
                const localFileTree = await dataService.getAllFileNodes();
                console.log("Local fileTree:", localFileTree);
                if (mounted && localFileTree) {
                    dispatch({ type: 'SET_FILE_TREE', payload: localFileTree });
                }

                // Load sampleGroups from local storage
                const localSampleGroups = await dataService.getAllSampleGroups();
                console.log("Local sampleGroups:", localSampleGroups);
                if (mounted && localSampleGroups) {
                    // Convert array to record before dispatching
                    const sampleGroupsRecord = arrayToRecord(localSampleGroups);
                    dispatch({ type: 'SET_SAMPLE_GROUPS', payload: sampleGroupsRecord });
                }

                // If online, sync data with remote server
                if (mounted && services.network.isOnline()) {
                    console.log("Syncing data with remote server");
                    await syncService.syncFromRemote('file_nodes', state.auth.organization?.id);
                    await syncService.syncFromRemote('sample_group_metadata', state.auth.organization?.id);

                    // Reload data after sync
                    const syncedFileTree = await dataService.getAllFileNodes();
                    const syncedSampleGroups = await dataService.getAllSampleGroups();

                    if (mounted && syncedFileTree) {
                        dispatch({ type: 'SET_FILE_TREE', payload: syncedFileTree });
                    }

                    if (mounted && syncedSampleGroups) {
                        // Convert array to record before dispatching
                        const syncedSampleGroupsRecord = arrayToRecord(syncedSampleGroups);
                        dispatch({ type: 'SET_SAMPLE_GROUPS', payload: syncedSampleGroupsRecord });
                    }
                }
            } catch (error) {
                console.error('Failed to initialize data:', error);
                if (mounted) {
                    dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to load data' });
                }
            }
        }

        initializeData();

        return () => {
            mounted = false;
        };
    }, [
        dispatch,
        dataService,
        services.network,
        syncService,
        state.auth.organization?.id
    ]);

    // Existing functions (createSampleGroup, updateFileTree, etc.)
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
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to delete node' });
            throw error;
        }
    }, [dataService, state.data.fileTree, dispatch]);

    const syncData = useCallback(async () => {
        if (!state.auth.organization?.id) return;

        try {
            dispatch({ type: 'SET_SYNCING', payload: true });
            await syncService.syncToRemote();
            await syncService.syncFromRemote('file_nodes');
            await syncService.syncFromRemote('sample_group_metadata');

            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
        } catch (error) {
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Sync failed' });
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [syncService, dispatch]);

    // New Function: updateSampleGroup
    const updateSampleGroup = useCallback(async (
        id: string,
        updates: Partial<SampleGroupMetadata>
    ) => {
        try {
            // Update the sample group using the DataService
            await dataService.updateSampleGroup(id, updates);

            // Fetch the updated sample group to ensure state is up-to-date
            const allSampleGroups = await dataService.getAllSampleGroups();
            const updatedGroup = allSampleGroups.find(group => group.id === id);

            if (updatedGroup) {
                dispatch({ type: 'UPDATE_SAMPLE_GROUP', payload: updatedGroup });
            } else {
                // Handle the case where the updated group is not found
                dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Updated sample group not found' });
            }
        } catch (error) {
            console.error('Failed to update sample group:', error);
            dispatch({ type: 'SET_ERROR_MESSAGE', payload: 'Failed to update sample group' });
            throw error;
        }
    }, [dataService, dispatch]);

    // Return existing functions plus any new state properties
    return {
        fileTree: state.data.fileTree,
        sampleGroups: state.data.sampleGroups,
        locations: state.data.locations,
        isSyncing: state.data.isSyncing,
        error: state.data.error,  // Ensure this is included
        createSampleGroup,
        updateFileTree,
        deleteNode,
        syncData,
        updateSampleGroup, // Expose the new function
        // Optionally, you can expose the new methods if needed
        getAllFileNodes: dataService.getAllFileNodes.bind(dataService),
        getAllSampleGroups: dataService.getAllSampleGroups.bind(dataService),
    };
}
