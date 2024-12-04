import { useCallback, useEffect } from 'react';
import { useDataStore } from '../stores/dataStore';
import type { FileNode, SampleLocation, SampleGroupMetadata } from '../types';

export const useData = () => {
    const {
        locations,
        fileNodes,
        sampleGroups,
        sampleMetadata,
        error,
        loading,
        fetchLocations,
        fetchFileNodes,
        fetchSampleGroups,
        fetchSampleMetadata,
        addFileNode,
        updateFileNode,
        deleteNode,
        updateSampleGroup,
        getLocationById,
        setError
    } = useDataStore();

    // Initial data loading
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                await Promise.all([
                    fetchLocations(),
                    fetchFileNodes(),
                    fetchSampleGroups(),
                    fetchSampleMetadata()
                ]);
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Failed to load initial data');
            }
        };

        loadInitialData();
    }, [fetchLocations, fetchFileNodes, fetchSampleGroups, fetchSampleMetadata, setError]);

    // Enhanced file node operations
    const handleAddFileNode = useCallback(async (node: FileNode) => {
        try {
            await addFileNode(node);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to add file node');
            throw error;
        }
    }, [addFileNode, setError]);

    const handleUpdateFileNode = useCallback(async (id: string, updates: Partial<FileNode>) => {
        try {
            await updateFileNode(id, updates);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to update file node');
            throw error;
        }
    }, [updateFileNode, setError]);

    const handleDeleteNode = useCallback(async (id: string) => {
        try {
            await deleteNode(id);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to delete node');
            throw error;
        }
    }, [deleteNode, setError]);

    // Enhanced sample group operations
    const handleUpdateSampleGroup = useCallback(async (
        id: string,
        updates: Partial<SampleGroupMetadata>
    ) => {
        try {
            await updateSampleGroup(id, updates);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to update sample group');
            throw error;
        }
    }, [updateSampleGroup, setError]);

    // Utility functions
    const getEnabledLocations = useCallback(() => {
        return locations.filter(location => location.is_enabled);
    }, [locations]);

    const getSampleGroupsByLocation = useCallback((locationId: string) => {
        return Object.values(sampleGroups).filter(group => group.loc_id === locationId);
    }, [sampleGroups]);

    const getNodeChildren = useCallback((nodeId: string): FileNode[] => {
        return Object.values(fileNodes).filter(node => node.parent_id === nodeId);
    }, [fileNodes]);

    const getNodePath = useCallback((nodeId: string): FileNode[] => {
        const path: FileNode[] = [];
        let currentNode = fileNodes[nodeId];

        while (currentNode) {
            path.unshift(currentNode);
            currentNode = currentNode.parent_id ? fileNodes[currentNode.parent_id] : null;
        }

        return path;
    }, [fileNodes]);

    return {
        // State
        locations,
        fileNodes,
        sampleGroups,
        sampleMetadata,
        error,
        loading,
        enabledLocations: getEnabledLocations(),

        // Enhanced actions
        addFileNode: handleAddFileNode,
        updateFileNode: handleUpdateFileNode,
        deleteNode: handleDeleteNode,
        updateSampleGroup: handleUpdateSampleGroup,

        // Base actions
        fetchLocations,
        fetchFileNodes,
        fetchSampleGroups,
        fetchSampleMetadata,
        setError,

        // Utility functions
        getLocationById,
        getSampleGroupsByLocation,
        getNodeChildren,
        getNodePath,

        // Computed properties
        totalLocations: locations.length,
        totalSampleGroups: Object.keys(sampleGroups).length,
        totalFiles: Object.keys(fileNodes).length
    };
};

export default useData;