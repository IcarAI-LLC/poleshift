import { useCallback, useMemo } from 'react';
import { useDataStore } from '../stores';
import type { FileNode, SampleLocation } from '../types';

export function useData() {
    const {
        fileTree,
        sampleGroups,
        locations,
        isSyncing,
        error,
        createSampleGroup,
        updateSampleGroup,
        deleteSampleGroup,
        createFileNode,
        updateFileTree,
        deleteNode,
        getAllFileNodes,
        getAllSampleGroups,
        getAllLocations,
        syncData
    } = useDataStore();

    // Additional utility function to remove a node from tree
    const removeNodeFromTree = useCallback((nodes: FileNode[], nodeId: string): FileNode[] => {
        return nodes.filter(node => {
            if (node.id === nodeId) return false;
            if (node.children) {
                node.children = removeNodeFromTree(node.children, nodeId);
            }
            return true;
        });
    }, []);

    // Location-specific utility functions
    const getLocationById = useCallback((locationId: string | null): SampleLocation | null => {
        if (!locationId) return null;
        return locations.find(location => location.id === locationId) || null;
    }, [locations]);

    const getLocationsByIds = useCallback((locationIds: string[]): SampleLocation[] => {
        return locations.filter(location => locationIds.includes(location.id));
    }, [locations]);

    // Memoize enabled locations
    const enabledLocations = useMemo(() => {
        return locations.filter(location => location.is_enabled);
    }, [locations]);

    return {
        fileTree,
        sampleGroups,
        locations,
        enabledLocations,
        isSyncing,
        error,
        createSampleGroup,
        updateSampleGroup,
        deleteSampleGroup,
        createFileNode,
        updateFileTree,
        deleteNode,
        getAllFileNodes,
        getAllSampleGroups,
        getAllLocations,
        syncData,
        removeNodeFromTree,
        getLocationById,
        getLocationsByIds
    };
}