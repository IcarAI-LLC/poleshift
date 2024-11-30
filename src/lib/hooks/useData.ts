import { useContext, useCallback, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useNetworkStatus } from './useNetworkStatus';
import type { SampleGroupMetadata, FileNode } from '../types';
import { arrayToRecord } from '../utils/arrayToRecord';

export function useData() {
    const { state, dispatch, services } = useContext(AppContext);
    const { data: dataService, sync: syncService } = services;
    const { isOnline } = useNetworkStatus();

    // Initialization Effect
    useEffect(() => {
        let mounted = true;

        async function initializeData() {
            try {
                // Load local data first (offline-first approach)
                const [localFileTree, localSampleGroups] = await Promise.all([
                    dataService.getAllFileNodes(),
                    dataService.getAllSampleGroups()
                ]);

                if (!mounted) return;

                // Update state with local data
                if (localFileTree) {
                    dispatch({ type: 'SET_FILE_TREE', payload: localFileTree });
                }

                if (localSampleGroups) {
                    const sampleGroupsRecord = arrayToRecord(localSampleGroups);
                    dispatch({ type: 'SET_SAMPLE_GROUPS', payload: sampleGroupsRecord });
                }

                // If online, sync with remote server
                if (isOnline && mounted && state.auth.organization?.id) {
                    dispatch({ type: 'SET_SYNCING', payload: true });

                    try {
                        await Promise.all([
                            syncService.syncFromRemote('file_nodes', state.auth.organization.id),
                            syncService.syncFromRemote('sample_group_metadata', state.auth.organization.id)
                        ]);

                        if (!mounted) return;

                        // Reload data after sync
                        const [syncedFileTree, syncedSampleGroups] = await Promise.all([
                            dataService.getAllFileNodes(),
                            dataService.getAllSampleGroups()
                        ]);

                        if (!mounted) return;

                        if (syncedFileTree) {
                            dispatch({ type: 'SET_FILE_TREE', payload: syncedFileTree });
                        }

                        if (syncedSampleGroups) {
                            const syncedSampleGroupsRecord = arrayToRecord(syncedSampleGroups);
                            dispatch({ type: 'SET_SAMPLE_GROUPS', payload: syncedSampleGroupsRecord });
                        }

                        dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
                    } finally {
                        if (mounted) {
                            dispatch({ type: 'SET_SYNCING', payload: false });
                        }
                    }
                }
            } catch (error) {
                if (mounted) {
                    dispatch({ type: 'SET_DATA_ERROR', payload: 'Failed to load data' });
                }
            }
        }

        initializeData();

        return () => {
            mounted = false;
        };
    }, [dispatch, dataService, isOnline, syncService, state.auth.organization?.id]);

    const createSampleGroup = useCallback(async (data: Partial<SampleGroupMetadata>) => {
        try {
            await dataService.createSampleGroup(data);
            dispatch({ type: 'ADD_SAMPLE_GROUP', payload: data as SampleGroupMetadata });
        } catch (error) {
            dispatch({ type: 'SET_DATA_ERROR', payload: 'Failed to create sample group' });
            throw error;
        }
    }, [dataService, dispatch]);

    const updateFileTree = useCallback(async (updatedTree: FileNode[]) => {
        try {
            await dataService.updateFileTree(updatedTree);
            dispatch({ type: 'SET_FILE_TREE', payload: updatedTree });
        } catch (error) {
            dispatch({ type: 'SET_DATA_ERROR', payload: 'Failed to update file tree' });
            throw error;
        }
    }, [dataService, dispatch]);

    const deleteNode = useCallback(async (nodeId: string) => {
        try {
            await dataService.deleteNode(nodeId);

            const removeNodeFromTree = (nodes: FileNode[]): FileNode[] => {
                return nodes.filter(node => {
                    if (node.id === nodeId) return false;
                    if (node.children) {
                        node.children = removeNodeFromTree(node.children);
                    }
                    return true;
                });
            };

            const updatedTree = removeNodeFromTree([...state.data.fileTree]);
            dispatch({ type: 'SET_FILE_TREE', payload: updatedTree });
        } catch (error) {
            dispatch({ type: 'SET_DATA_ERROR', payload: 'Failed to delete node' });
            throw error;
        }
    }, [dataService, state.data.fileTree, dispatch]);

    const syncData = useCallback(async () => {
        if (!state.auth.organization?.id || !isOnline) return;

        try {
            dispatch({ type: 'SET_SYNCING', payload: true });

            await syncService.syncToRemote();
            await Promise.all([
                syncService.syncFromRemote('file_nodes'),
                syncService.syncFromRemote('sample_group_metadata')
            ]);

            const [syncedFileTree, syncedSampleGroups] = await Promise.all([
                dataService.getAllFileNodes(),
                dataService.getAllSampleGroups()
            ]);

            if (syncedFileTree) {
                dispatch({ type: 'SET_FILE_TREE', payload: syncedFileTree });
            }

            if (syncedSampleGroups) {
                const syncedSampleGroupsRecord = arrayToRecord(syncedSampleGroups);
                dispatch({ type: 'SET_SAMPLE_GROUPS', payload: syncedSampleGroupsRecord });
            }

            dispatch({ type: 'SET_LAST_SYNCED', payload: Date.now() });
        } catch (error) {
            dispatch({ type: 'SET_DATA_ERROR', payload: 'Sync failed' });
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, [isOnline, syncService, dataService, dispatch, state.auth.organization?.id]);

    const updateSampleGroup = useCallback(async (
        id: string,
        updates: Partial<SampleGroupMetadata>
    ) => {
        try {
            await dataService.updateSampleGroup(id, updates);
            const allSampleGroups = await dataService.getAllSampleGroups();
            const updatedGroup = allSampleGroups.find(group => group.id === id);

            if (updatedGroup) {
                dispatch({ type: 'UPDATE_SAMPLE_GROUP', payload: updatedGroup });
            } else {
                dispatch({ type: 'SET_DATA_ERROR', payload: 'Updated sample group not found' });
            }
        } catch (error) {
            console.error('Failed to update sample group:', error);
            dispatch({ type: 'SET_DATA_ERROR', payload: 'Failed to update sample group' });
            throw error;
        }
    }, [dataService, dispatch]);

    return {
        fileTree: state.data.fileTree,
        sampleGroups: state.data.sampleGroups,
        locations: state.data.locations,
        isSyncing: state.data.isSyncing,
        error: state.data.error,
        createSampleGroup,
        updateFileTree,
        deleteNode,
        syncData,
        updateSampleGroup,
        getAllFileNodes: dataService.getAllFileNodes.bind(dataService),
        getAllSampleGroups: dataService.getAllSampleGroups.bind(dataService),
    };
}