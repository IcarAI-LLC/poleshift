// src/lib/hooks/useData.ts

import { useCallback, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { usePowerSync } from '@powersync/react';
import type { FileNode, SampleGroupMetadata } from '../types';

// Helper to build a record by ID from an array of rows
function arrayToRecord<T extends { id: string }>(arr: T[]): Record<string, T> {
    const record: Record<string, T> = {};
    for (const item of arr) {
        record[item.id] = item;
    }
    return record;
}

export const useData = () => {
    const db =usePowerSync();
    // Fetch reactive data using useQuery
    const {
        data: locations = [],
        isLoading: locationsLoading,
        error: locationsError
    } = useQuery('SELECT * FROM sample_locations WHERE is_enabled = 1 ORDER BY label ASC');

    const {
        data: fileNodesArray = [],
        isLoading: fileNodesLoading,
        error: fileNodesError
    } = useQuery('SELECT * FROM file_nodes ORDER BY created_at DESC');

    const {
        data: sampleGroupsArray = [],
        isLoading: sampleGroupsLoading,
        error: sampleGroupsError
    } = useQuery('SELECT * FROM sample_group_metadata ORDER BY created_at DESC');

    const {
        data: sampleMetadataArray = [],
        isLoading: sampleMetadataLoading,
        error: sampleMetadataError
    } = useQuery('SELECT * FROM sample_metadata ORDER BY created_at DESC');

    // Convert arrays to records for easier lookups
    const fileNodes = useMemo(() => arrayToRecord(fileNodesArray), [fileNodesArray]);
    const sampleGroups = useMemo(() => arrayToRecord(sampleGroupsArray), [sampleGroupsArray]);
    const sampleMetadata = useMemo(() => arrayToRecord(sampleMetadataArray), [sampleMetadataArray]);

    // Determine if any queries are loading or have errors
    const loading = locationsLoading || fileNodesLoading || sampleGroupsLoading || sampleMetadataLoading;
    const error = locationsError || fileNodesError || sampleGroupsError || sampleMetadataError || null;

    // CRUD operations using db.execute()
    const setError = useCallback((err: string | null) => {
        // With no external store, you may handle errors by logging or local state
        // For now, we simply log.
        if (err) {
            console.error(err);
        }
    }, []);

    const addFileNode = useCallback(async (node: FileNode) => {
        try {
            await db.execute(
                `
          INSERT INTO file_nodes
          (id, org_id, parent_id, name, type, created_at, updated_at, version,
           sample_group_id, droppable)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
                [
                    node.id,
                    node.org_id,
                    node.parent_id === null ? null : node.parent_id,
                    node.name,
                    node.type,
                    node.created_at,
                    node.updated_at,
                    node.version,
                    node.sample_group_id,
                    node.droppable ? 1 : 0,
                ]
            );
        } catch (err: any) {
            setError(err.message || 'Failed to add file node');
            throw err;
        }
    }, [setError]);

    const updateFileNode = useCallback(async (id: string, updates: Partial<FileNode>) => {
        try {
            const setClause = Object.keys(updates)
                .map((key) => `${key} = ?`)
                .join(', ');

            const values = Object.values(updates).map((value) => {
                if (value === null) return null;
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value;
            });

            await db.execute(
                `
          UPDATE file_nodes
          SET ${setClause}
          WHERE id = ?
        `,
                [...values, id]
            );
        } catch (err: any) {
            setError(err.message || 'Failed to update file node');
            throw err;
        }
    }, [setError]);

    const deleteNode = useCallback(async (id: string) => {
        try {
            // First, retrieve the node's sample_group_id, if any
            const nodeResult = await db.get('SELECT sample_group_id FROM file_nodes WHERE id = ?', [id]);
            console.debug('nodeResult', nodeResult);
            // @ts-ignore
            const sampleGroupId = nodeResult.sample_group_id;
            // If there's a sample_group_id associated with the node, delete the corresponding sample group
            if (sampleGroupId) {
                console.debug('Deleting sample group', sampleGroupId);
                db.execute('DELETE FROM sample_group_metadata WHERE id = ?', [sampleGroupId]);
            }

            console.debug('sampleGroupId', sampleGroupId);
            // Delete the file node
            db.execute('DELETE FROM file_nodes WHERE id = ?', [id]);


        } catch (err: any) {
            setError(err.message || 'Failed to delete node');
            throw err;
        }
    }, [setError]);

    const updateSampleGroup = useCallback(async (id: string, updates: Partial<SampleGroupMetadata>) => {
        try {
            const setClause = Object.keys(updates)
                .map((key) => `${key} = ?`)
                .join(', ');

            const values = Object.values(updates);

            await db.execute(
                `
          UPDATE sample_group_metadata
          SET ${setClause}
          WHERE id = ?
        `,
                [...values, id]
            );
        } catch (err: any) {
            setError(err.message || 'Failed to update sample group');
            throw err;
        }
    }, [setError]);

    const createSampleGroup = useCallback(
        async (sampleGroupData: SampleGroupMetadata, fileNodeData: FileNode) => {
            try {
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

                await addFileNode(fileNodeData);
            } catch (err: any) {
                setError(err.message || 'Failed to create sample group');
                throw err;
            }
        },
        [addFileNode, setError]
    );

    const moveNode = useCallback(
        async (nodeId: string, newParentId: string | null) => {
            try {
                await updateFileNode(nodeId, { parent_id: newParentId });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to move the node');
                throw err;
            }
        },
        [updateFileNode, setError]
    );

    const updateFileTree = useCallback(
        async (updatedTreeData: FileNode[]) => {
            try {
                await db.execute('DELETE FROM file_nodes');
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

                    if (node.children && node.children.length > 0) {
                        for (const child of node.children) {
                            await insertNode(child, id);
                        }
                    }
                };

                for (const node of updatedTreeData) {
                    await insertNode(node, null);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to update file tree');
                throw err;
            }
        },
        [setError]
    );

    // Utility functions
    const getEnabledLocations = useCallback(() => {
        return locations.filter((location) => location.is_enabled);
    }, [locations]);

    const getSampleGroupsByLocation = useCallback(
        (locationId: string) => {
            return Object.values(sampleGroups).filter((group) => group.loc_id === locationId);
        },
        [sampleGroups]
    );

    const getLocationById = useCallback((id: string | null) => {
        if (!id) return null;
        return locations.find((location) => location.id === id) || null;
    }, [locations]);

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

    // Build file tree
    const fileTree = useMemo(() => {
        const nodesById = { ...fileNodes };
        const tree: FileNode[] = [];

        for (const nodeId in nodesById) {
            nodesById[nodeId].children = [];
        }

        for (const nodeId in nodesById) {
            const node = nodesById[nodeId];
            if (node.parent_id) {
                const parent = nodesById[node.parent_id];
                if (parent) {
                    parent.children?.push(node);
                }
            } else {
                tree.push(node);
            }
        }

        return tree;
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

        // Actions
        addFileNode,
        updateFileNode,
        deleteNode,
        updateSampleGroup,
        createSampleGroup,
        updateFileTree,
        moveNode,
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
