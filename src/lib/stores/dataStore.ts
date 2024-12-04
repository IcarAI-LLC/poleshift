import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
    FileNode,
    SampleGroupMetadata,
    SampleLocation,
    SampleMetadata
} from '../types';
import { supabase } from '../supabase/client';
import { storage } from '../services';

interface DataState {
    fileTree: FileNode[];
    sampleGroups: Record<string, SampleGroupMetadata>;
    locations: SampleLocation[];
    isSyncing: boolean;
    lastSynced: number | null;
    error: string | null;
}

interface DataActions {
    createSampleGroup: (data: Partial<SampleGroupMetadata>) => Promise<SampleGroupMetadata>;
    updateSampleGroup: (id: string, updates: Partial<SampleGroupMetadata>) => Promise<void>;
    deleteSampleGroup: (id: string) => Promise<void>;
    createFileNode: (data: Partial<FileNode>) => Promise<FileNode>;
    updateFileTree: (updatedTree: FileNode[]) => Promise<void>;
    deleteNode: (nodeId: string) => Promise<void>;
    getAllFileNodes: () => Promise<FileNode[]>;
    getAllSampleGroups: () => Promise<SampleGroupMetadata[]>;
    getAllLocations: () => Promise<SampleLocation[]>;
    setSyncing: (isSyncing: boolean) => void;
    setError: (error: string | null) => void;
    syncData: () => Promise<void>;
}

const initialState: DataState = {
    fileTree: [],
    sampleGroups: {},
    locations: [],
    isSyncing: false,
    lastSynced: null,
    error: null,
};

export const useDataStore = create<DataState & DataActions>()(
    devtools(
        persist(
            (set, get) => ({
                ...initialState,

                setSyncing: (isSyncing) => set({ isSyncing }),

                setError: (error) => set({ error }),

                createSampleGroup: async (data) => {
                    try {
                        const newSampleGroup: SampleGroupMetadata = {
                            ...data as SampleGroupMetadata,
                            id: data.id || uuidv4(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        await storage.saveSampleGroup(newSampleGroup);

                        set((state) => ({
                            sampleGroups: {
                                ...state.sampleGroups,
                                [newSampleGroup.id]: newSampleGroup
                            }
                        }));

                        return newSampleGroup;
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                updateSampleGroup: async (id, updates) => {
                    try {
                        const existing = await storage.getSampleGroup(id);
                        if (!existing) throw new Error('Sample group not found');

                        const updatedGroup = {
                            ...existing,
                            ...updates,
                            updated_at: new Date().toISOString()
                        };

                        await storage.saveSampleGroup(updatedGroup);

                        set((state) => ({
                            sampleGroups: {
                                ...state.sampleGroups,
                                [id]: updatedGroup
                            }
                        }));
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                deleteSampleGroup: async (id) => {
                    try {
                        await storage.deleteSampleGroup(id);

                        set((state) => {
                            const { [id]: deleted, ...remainingSampleGroups } = state.sampleGroups;
                            return { sampleGroups: remainingSampleGroups };
                        });
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                createFileNode: async (data) => {
                    try {
                        const newNode: FileNode = {
                            ...data as FileNode,
                            id: data.id || uuidv4(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        await storage.saveFileNode(newNode);

                        set((state) => ({
                            fileTree: [...state.fileTree, newNode]
                        }));

                        return newNode;
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                updateFileTree: async (updatedTree) => {
                    try {
                        const timestamp = new Date().toISOString();
                        const updatedNodes = updatedTree.map(node => ({
                            ...node,
                            updated_at: timestamp
                        }));

                        await Promise.all(updatedNodes.map(node => storage.saveFileNode(node)));

                        set({ fileTree: updatedNodes });
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                deleteNode: async (nodeId) => {
                    try {
                        await storage.deleteNode(nodeId);

                        set((state) => ({
                            fileTree: state.fileTree.filter(node => node.id !== nodeId)
                        }));
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                getAllFileNodes: async () => {
                    try {
                        const nodes = await storage.getAllFileNodes();
                        set({ fileTree: nodes });
                        return nodes;
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                getAllSampleGroups: async () => {
                    try {
                        const groups = await storage.getAllSampleGroups();
                        const groupsRecord = groups.reduce((acc, group) => {
                            acc[group.id] = group;
                            return acc;
                        }, {} as Record<string, SampleGroupMetadata>);

                        set({ sampleGroups: groupsRecord });
                        return groups;
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                getAllLocations: async () => {
                    try {
                        const locations = await storage.getAllLocations();
                        set({ locations });
                        return locations;
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    }
                },

                syncData: async () => {
                    try {
                        set({ isSyncing: true });

                        // Sync with remote
                        const { data: fileNodesData } = await supabase
                            .from('file_nodes')
                            .select('*');

                        const { data: sampleGroupsData } = await supabase
                            .from('sample_group_metadata')
                            .select('*');

                        const { data: locationsData } = await supabase
                            .from('sample_locations')
                            .select('*');

                        if (fileNodesData) {
                            await Promise.all(fileNodesData.map(node => storage.saveFileNode(node)));
                            set({ fileTree: fileNodesData });
                        }

                        if (sampleGroupsData) {
                            const groupsRecord = sampleGroupsData.reduce((acc, group) => {
                                acc[group.id] = group;
                                return acc;
                            }, {} as Record<string, SampleGroupMetadata>);

                            await Promise.all(sampleGroupsData.map(group => storage.saveSampleGroup(group)));
                            set({ sampleGroups: groupsRecord });
                        }

                        if (locationsData) {
                            await Promise.all(locationsData.map(location => storage.saveLocation(location)));
                            set({ locations: locationsData });
                        }

                        set({
                            lastSynced: Date.now(),
                            error: null
                        });
                    } catch (error: any) {
                        set({ error: error.message });
                        throw error;
                    } finally {
                        set({ isSyncing: false });
                    }
                }
            }),
            {
                name: 'data-storage',
                partialize: (state) => ({
                    fileTree: state.fileTree,
                    sampleGroups: state.sampleGroups,
                    locations: state.locations,
                    lastSynced: state.lastSynced
                })
            }
        )
    )
);