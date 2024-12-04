// src/lib/stores/dataStore.ts

import { create } from 'zustand';
import { db } from '../powersync/db';
import type { FileNode, SampleLocation, SampleGroupMetadata, SampleMetadata } from '../types';
import { arrayToRecord } from '../utils/arrayToRecord';

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

    deleteNode: async (id: string) => {
        try {
            // First, recursively delete all child nodes
            const deleteChildren = async (nodeId: string) => {
                const children = await db.getAll(
                    `
                        SELECT id FROM file_nodes
                        WHERE parent_id = ?
                    `,
                    [nodeId]
                );

                for (const child of children) {
                    await deleteChildren(child.id);
                }

                await db.execute('DELETE FROM file_nodes WHERE id = ?', [nodeId]);
            };

            await deleteChildren(id);
            await get().fetchFileNodes();
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to delete node' });
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
