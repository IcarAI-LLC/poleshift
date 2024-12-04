// src/lib/stores/dataStore.ts

import { create } from 'zustand';
import { db } from '../powersync/db';
import type { FileNode, SampleLocation, SampleGroupMetadata, SampleMetadata } from '../types';
import { arrayToRecord } from '../utils/arrayToRecord';
import { supabaseConnector } from '../powersync/SupabaseConnector';
import { useAuthStore } from '../stores/authStore';

interface DataState {
    // Data
    locations: SampleLocation[];
    fileNodes: Record<string, FileNode>;
    sampleGroups: Record<string, SampleGroupMetadata>;
    sampleMetadata: Record<string, SampleMetadata>;
    error: string | null;
    loading: boolean;

    // Actions
    fetchLocations: () => Promise<void>;
    fetchFileNodes: () => Promise<void>;
    fetchSampleGroups: () => Promise<void>;
    fetchSampleMetadata: () => Promise<void>;
    addFileNode: (node: FileNode) => Promise<void>;
    updateFileNode: (id: string, updates: Partial<FileNode>) => Promise<void>;
    deleteNode: (id: string) => Promise<void>;
    updateSampleGroup: (id: string, updates: Partial<SampleGroupMetadata>) => Promise<void>;
    getLocationById: (id: string | null) => SampleLocation | null;
    setError: (error: string | null) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
    locations: [],
    fileNodes: {},
    sampleGroups: {},
    sampleMetadata: {},
    error: null,
    loading: false,

    fetchLocations: async () => {
        try {
            const locations = await db.getAll(`
                SELECT * FROM sample_locations
                WHERE is_enabled = 1
                ORDER BY label ASC
            `);

            set({ locations });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch locations' });
        }
    },

    fetchFileNodes: async () => {
        try {
            const nodes = await db.getAll(`
                SELECT * FROM file_nodes
                ORDER BY created_at DESC
            `);

            set({ fileNodes: arrayToRecord(nodes) });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch file nodes' });
        }
    },

    fetchSampleGroups: async () => {
        try {
            const groups = await db.getAll(`
                SELECT * FROM sample_group_metadata
                ORDER BY created_at DESC
            `);

            set({ sampleGroups: arrayToRecord(groups) });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch sample groups' });
        }
    },

    fetchSampleMetadata: async () => {
        try {
            const metadata = await db.getAll(`
                SELECT * FROM sample_metadata
                ORDER BY created_at DESC
            `);

            set({ sampleMetadata: arrayToRecord(metadata) });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to fetch sample metadata' });
        }
    },

    addFileNode: async (node: FileNode) => {
        try {
            const {
                id,
                org_id,
                parent_id,
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
                    INSERT INTO file_nodes
                    (id, org_id, parent_id, name, type, created_at, updated_at, version,
                     sample_group_id, droppable)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    id,
                    org_id,
                    parent_id,
                    name,
                    type,
                    created_at,
                    updated_at,
                    version,
                    sample_group_id,
                    droppable ? 1 : 0,
                ]
            );

            await get().fetchFileNodes();
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to add file node' });
            throw error;
        }
    },

    updateFileNode: async (id: string, updates: Partial<FileNode>) => {
        try {
            const setClause = Object.keys(updates)
                .map((key) => `${key} = ?`)
                .join(', ');

            const values = Object.values(updates).map((value) =>
                typeof value === 'object' ? JSON.stringify(value) : value
            );

            await db.execute(
                `
                    UPDATE file_nodes
                    SET ${setClause}
                    WHERE id = ?
                `,
                [...values, id]
            );

            await get().fetchFileNodes();
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to update file node' });
            throw error;
        }
    },

    // In dataStore.ts, enhance the deleteNode function:
    deleteNode: async (id: string) => {
        try {
            // Get the node to check its type
            const node = await db.get(
                `SELECT * FROM file_nodes WHERE id = ?`,
                [id]
            );

            if (!node) {
                throw new Error('Node not found');
            }

            // If it's a sample group, we need to do additional cleanup
            if (node.type === 'sampleGroup') {
                // Get storage client and organization info
                const storage = supabaseConnector.client.storage;
                const organization = useAuthStore.getState().organization;

                if (!organization) {
                    throw new Error('No organization found');
                }

                // 1. Delete from sample_group_metadata
                await db.execute(
                    `DELETE FROM sample_group_metadata WHERE id = ?`,
                    [node.sample_group_id]
                );

                // 2. Delete from processed_data
                await db.execute(
                    `DELETE FROM processed_data WHERE sample_id = ?`,
                    [node.sample_group_id]
                );

                // 3. Delete files from storage buckets
                try {
                    // Delete from raw-data bucket
                    const { data: rawFiles, error: rawError } = await storage
                        .from('raw-data')
                        .list(`${organization.org_short_id}/${node.sample_group_id}`);

                    if (rawError) throw rawError;

                    if (rawFiles?.length) {
                        await storage
                            .from('raw-data')
                            .remove(rawFiles.map(file =>
                                `${organization.org_short_id}/${node.sample_group_id}/${file.name}`
                            ));
                    }

                    // Delete from processed-data bucket
                    const { data: processedFiles, error: processedError } = await storage
                        .from('processed-data')
                        .list(`${organization.org_short_id}/${node.sample_group_id}`);

                    if (processedError) throw processedError;

                    if (processedFiles?.length) {
                        await storage
                            .from('processed-data')
                            .remove(processedFiles.map(file =>
                                `${organization.org_short_id}/${node.sample_group_id}/${file.name}`
                            ));
                    }
                } catch (storageError) {
                    console.error('Storage deletion error:', storageError);
                    // Continue with local deletion even if storage deletion fails
                }
            }

            // Delete from file_nodes (this remains the same)
            const deleteChildren = async (nodeId: string) => {
                const children = await db.getAll(
                    `SELECT id FROM file_nodes WHERE parent_id = ?`,
                    [nodeId]
                );

                for (const child of children) {
                    await deleteChildren(child.id);
                }

                await db.execute('DELETE FROM file_nodes WHERE id = ?', [nodeId]);
            };

            await deleteChildren(id);
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    },

    updateSampleGroup: async (id: string, updates: Partial<SampleGroupMetadata>) => {
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

            await get().fetchSampleGroups();
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to update sample group',
            });
            throw error;
        }
    },

    getLocationById: (id: string | null) => {
        if (!id) return null;
        return get().locations.find((location) => location.id === id) || null;
    },

    setError: (error: string | null) => set({ error }),
}));
