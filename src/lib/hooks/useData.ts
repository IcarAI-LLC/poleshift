// src/lib/hooks/useData.ts

import { useCallback, useEffect, useMemo } from 'react';
import { useDataStore } from '../stores/dataStore';
import type { FileNode, SampleGroupMetadata } from '../types';
import { db } from '../powersync/db';

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
        setError,
    } = useDataStore();

    // Initial data loading
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                await Promise.all([
                    fetchLocations(),
                    fetchFileNodes(),
                    fetchSampleGroups(),
                    fetchSampleMetadata(),
                ]);
            } catch (error) {
                setError(
                    error instanceof Error ? error.message : 'Failed to load initial data'
                );
            }
        };

        loadInitialData();
    }, [fetchLocations, fetchFileNodes, fetchSampleGroups, fetchSampleMetadata, setError]);

    // Create Sample Group
    const createSampleGroup = useCallback(
        async (sampleGroupData: SampleGroupMetadata, fileNodeData: FileNode) => {
            try {
                // Insert new sample group into the database
                await db.execute(
                    `
                        INSERT INTO sample_group_metadata (
                            id, created_at, org_id, user_id, human_readable_sample_id,
                            collection_date, storage_folder, collection_datetime_utc,
                            loc_id, latitude_recorded, longitude_recorded, notes, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        sampleGroupData.id,
                        sampleGroupData.created_at,
                        sampleGroupData.org_id,
                        sampleGroupData.user_id,
                        sampleGroupData.human_readable_sample_id,
                        sampleGroupData.collection_date,
                        sampleGroupData.storage_folder,
                        sampleGroupData.collection_datetime_utc,
                        sampleGroupData.loc_id,
                        sampleGroupData.latitude_recorded,
                        sampleGroupData.longitude_recorded,
                        sampleGroupData.notes,
                        sampleGroupData.updated_at,
                    ]
                );

                // Add corresponding file node
                await addFileNode(fileNodeData);

                // Refresh sample groups and file nodes
                await Promise.all([fetchSampleGroups(), fetchFileNodes()]);
            } catch (error) {
                setError(
                    error instanceof Error ? error.message : 'Failed to create sample group'
                );
                throw error;
            }
        },
        [addFileNode, fetchSampleGroups, fetchFileNodes, setError]
    );

    // Move Node Function
    const moveNode = useCallback(
        async (nodeId: string, newParentId: string | null) => {
            try {
                await updateFileNode(nodeId, { parent_id: newParentId });
                await fetchFileNodes(); // Refresh the file nodes to reflect changes
            } catch (error) {
                setError(
                    error instanceof Error ? error.message : 'Failed to move the node'
                );
                throw error;
            }
        },
        [updateFileNode, fetchFileNodes, setError]
    );

    // Update File Tree
    const updateFileTree = useCallback(
        async (updatedTreeData: FileNode[]) => {
            try {
                // Clear existing file_nodes in the database
                await db.execute('DELETE FROM file_nodes');

                // Function to recursively insert nodes
                const insertNode = async (node: FileNode, parentId: string | null) => {
                    const {
                        id,
                        org_id,
                        name,
                        type,
                        created_at,
                        updated_at,
                        version,
                        sample_group_id,
                        droppable,
                    } = node;

                    await db.execute(
                        `
              INSERT INTO file_nodes (
                id, org_id, parent_id, name, type, created_at, updated_at,
                version, sample_group_id, droppable
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                        [
                            id,
                            org_id,
                            parentId,
                            name,
                            type,
                            created_at,
                            updated_at,
                            version,
                            sample_group_id,
                            droppable ? 1 : 0,
                        ]
                    );

                    // Recursively insert children
                    if (node.children && node.children.length > 0) {
                        for (const child of node.children) {
                            await insertNode(child, id);
                        }
                    }
                };

                // Insert all nodes starting from the root
                for (const node of updatedTreeData) {
                    await insertNode(node, null);
                }

                // Refresh file nodes
                await fetchFileNodes();
            } catch (error) {
                setError(
                    error instanceof Error ? error.message : 'Failed to update file tree'
                );
                throw error;
            }
        },
        [fetchFileNodes, setError]
    );

    // Transform fileNodes into a tree structure
    const fileTree = useMemo(() => {
        const nodesById = { ...fileNodes };
        const tree: FileNode[] = [];

        // Initialize children arrays
        for (const nodeId in nodesById) {
            nodesById[nodeId].children = [];
        }

        // Build the tree
        for (const nodeId in nodesById) {
            const node = nodesById[nodeId];
            if (node.parent_id) {
                const parent = nodesById[node.parent_id];
                if (parent) {
                    parent.children?.push(node);
                }
            } else {
                // Root nodes
                tree.push(node);
            }
        }

        return tree;
    }, [fileNodes]);

    // Enhanced file node operations
    const handleAddFileNode = useCallback(
        async (node: FileNode) => {
            try {
                await addFileNode(node);
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Failed to add file node');
                throw error;
            }
        },
        [addFileNode, setError]
    );

    const handleUpdateFileNode = useCallback(
        async (id: string, updates: Partial<FileNode>) => {
            console.log(updates);
            try {
                await updateFileNode(id, updates);
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Failed to update file node');
                throw error;
            }
        },
        [updateFileNode, setError]
    );

    const handleDeleteNode = useCallback(
        async (id: string) => {
            try {
                await deleteNode(id);
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Failed to delete node');
                throw error;
            }
        },
        [deleteNode, setError]
    );

    // Enhanced sample group operations
    const handleUpdateSampleGroup = useCallback(
        async (id: string, updates: Partial<SampleGroupMetadata>) => {
            try {
                await updateSampleGroup(id, updates);
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Failed to update sample group');
                throw error;
            }
        },
        [updateSampleGroup, setError]
    );

    // Utility functions
    const getEnabledLocations = useCallback(() => {
        return locations.filter((location) => location.is_enabled);
    }, [locations]);

    const getSampleGroupsByLocation = useCallback(
        (locationId: string) => {
            return Object.values(sampleGroups).filter(
                (group) => group.loc_id === locationId
            );
        },
        [sampleGroups]
    );

    const getNodeChildren = useCallback(
        (nodeId: string): FileNode[] => {
            return Object.values(fileNodes).filter((node) => node.parent_id === nodeId);
        },
        [fileNodes]
    );

    const getNodePath = useCallback(
        (nodeId: string): FileNode[] => {
            const path: FileNode[] = [];
            let currentNode = fileNodes[nodeId];

            while (currentNode) {
                path.unshift(currentNode);
                currentNode = currentNode.parent_id ? fileNodes[currentNode.parent_id] : undefined;
            }

            return path;
        },
        [fileNodes]
    );

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
        createSampleGroup,
        updateFileTree,
        moveNode, // Include moveNode

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
        totalFiles: Object.keys(fileNodes).length,

        // File tree
        fileTree,
    };
};

export default useData;
