// src/lib/hooks/useData.ts

import { useCallback, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { usePowerSync } from '@powersync/react';
import {FileNodes, SampleGroupMetadata} from '../types';

import {toCompilableQuery, wrapPowerSyncWithDrizzle} from "@powersync/drizzle-driver";
import {
    DrizzleSchema, file_nodes, FileNodeType, sample_group_metadata, sample_locations
} from "../powersync/DrizzleSchema.ts";
import { eq } from 'drizzle-orm';

export type FileNodeWithChildren = FileNodes & {
    children: FileNodeWithChildren[];
    type: FileNodeType;
};

// Helper to build a record by ID from an array of rows
function arrayToRecord<T extends { id: string }>(arr: T[]): Record<string, T> {
    const record: Record<string, T> = {};
    for (const item of arr) {
        record[item.id] = item;
    }
    return record;
}

export const useData = () => {
    // Fetch database and drizzle database wrapper
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db,{schema: DrizzleSchema})

    // Fetch reactive data using useQuery
    const locationsQuery = drizzleDB.select()
        .from(sample_locations)
        .where(eq(sample_locations.is_enabled, 1))
    const compiledLocationsQuery = toCompilableQuery(locationsQuery);
    const fileNodesQuery = drizzleDB.select()
        .from(file_nodes)
        .orderBy(file_nodes.created_at);
    const compiledFileNodesQuery = toCompilableQuery(fileNodesQuery);
    const sampleGroupsQuery = drizzleDB.select()
        .from(sample_group_metadata)
        .orderBy(sample_group_metadata.created_at);
    const compiledSampleGroupsQuery = toCompilableQuery(sampleGroupsQuery);


    const {
        data: locations = [],
        isLoading: locationsLoading,
        error: locationsError
    } = useQuery(compiledLocationsQuery);
    const {
        data: fileNodesArray = [],
        isLoading: fileNodesLoading,
        error: fileNodesError
    } = useQuery(compiledFileNodesQuery);

    const {
        data: sampleGroupsArray = [],
        isLoading: sampleGroupsLoading,
        error: sampleGroupsError
    } = useQuery(compiledSampleGroupsQuery);

    // Convert arrays to records for easier lookups
    const fileNodes = useMemo(() => arrayToRecord(fileNodesArray), [fileNodesArray]);
    const sampleGroups = useMemo(() => arrayToRecord(sampleGroupsArray), [sampleGroupsArray]);

    // Determine if any queries are loading or have errors
    const loading = locationsLoading || fileNodesLoading || sampleGroupsLoading;
    const error = locationsError || fileNodesError || sampleGroupsError || null;

    // CRUD operations using db.execute()
    const setError = useCallback((err: string | null) => {
        if (err) {
            console.error(err);
        }
    }, []);

    const addFileNode = useCallback(async (node: FileNodes) => {
        let canDrop: number;
        if (node.droppable){
            canDrop = 1;
        }else{
            canDrop = 0;
        }
        try {
            await drizzleDB.insert(file_nodes).values(
                {
                    id: node.id,
                    org_id: node.org_id,
                    parent_id: node.parent_id,
                    name: node.name,
                    type: node.type,
                    created_at: node.created_at,
                    updated_at: node.updated_at,
                    version: node.version,
                    sample_group_id: node.sample_group_id,
                    droppable: canDrop,
                }
            );
        } catch (err: any) {
            setError(err.message || 'Failed to add file node');
            throw err;
        }
    }, [setError]);

    const updateFileNode = useCallback(async (id: string, updates: Partial<FileNodeWithChildren>) => {
        try {
            const { children, ...validUpdates } = updates;
            await drizzleDB
                .update(file_nodes)
                .set(validUpdates)
                .where(eq(file_nodes.id, id))
                .run();
        } catch (err: any) {
            setError(err.message || 'Failed to update file node');
            throw err;
        }
    }, [setError]);


    const deleteNode = useCallback(async (id: string) => {
        try {
            // 1. Fetch the node to see if it’s a folder and/or has a sample group
            const [nodeResult] = await drizzleDB
                .select({
                    type: file_nodes.type,
                    sampleGroupId: file_nodes.sample_group_id,
                })
                .from(file_nodes)
                .where(eq(file_nodes.id, id));

            // If the node doesn't exist, just return
            if (!nodeResult) return;

            // 2. If it's a folder, recursively delete its children first
            if (nodeResult.type === FileNodeType.Folder && nodeResult.sampleGroupId === null) {
                const childNodes = await drizzleDB
                    .select({ id: file_nodes.id })
                    .from(file_nodes)
                    .where(eq(file_nodes.parent_id, id));

                for (const child of childNodes) {
                    await deleteNode(child.id); // Recursively delete each child
                }
            }

            // 3. If there's a sample group, delete it
            if (nodeResult.sampleGroupId) {
                console.debug('Deleting sample group', nodeResult.sampleGroupId);
                await drizzleDB
                    .delete(sample_group_metadata)
                    .where(eq(sample_group_metadata.id, nodeResult.sampleGroupId))
                    .run();
            }

            // 4. Finally, delete the node itself
            await drizzleDB.delete(file_nodes).where(eq(file_nodes.id, id)).run();

        } catch (err: any) {
            setError(err.message || 'Failed to delete node');
            throw err;
        }
    }, [setError]);

    const updateSampleGroup = useCallback(async (id: string, updates: Partial<SampleGroupMetadata>) => {
        try {
            await drizzleDB
                .update(sample_group_metadata)
                .set(updates)
                .where(eq(sample_group_metadata.id, id))
                .run();
        } catch (err: any) {
            setError(err.message || 'Failed to update sample group');
            throw err;
        }
    }, [setError]);

    const createSampleGroup = useCallback(
        async (sampleGroupData: SampleGroupMetadata, fileNodeData: FileNodes) => {
            try {
                await drizzleDB
                    .insert(sample_group_metadata)
                    .values(sampleGroupData).run();
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
        (nodeId: string) => {
            return Object.values(fileNodes).filter((node) => node.parent_id === nodeId);
        },
        [fileNodes]
    );

    const fileTree = useMemo(() => {
        // 2. Clone fileNodes into a new record of FileNodeWithChildren
        const nodesById: Record<string, FileNodeWithChildren> = {};

        for (const nodeId in fileNodes) {
            const node = fileNodes[nodeId];
            // Spread node so we don’t modify the DB version
            nodesById[nodeId] = { ...node, children: [], type: node.type as FileNodeType };
        }

        // 3. Build the tree
        const tree: FileNodeWithChildren[] = [];

        for (const nodeId in nodesById) {
            const node = nodesById[nodeId];
            if (node.parent_id) {
                const parent = nodesById[node.parent_id];
                if (parent) {
                    parent.children.push(node);
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
        error,
        loading,
        enabledLocations: getEnabledLocations(),

        // Actions
        addFileNode,
        updateFileNode,
        deleteNode,
        updateSampleGroup,
        createSampleGroup,
        moveNode,
        setError,

        // Utility functions
        getLocationById,
        getSampleGroupsByLocation,
        getNodeChildren,

        // Computed properties
        totalLocations: locations.length,
        totalSampleGroups: Object.keys(sampleGroups).length,
        totalFiles: Object.keys(fileNodes).length,

        // File tree
        fileTree,
    };
};

export default useData;
