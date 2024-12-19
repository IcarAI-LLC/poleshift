// src/lib/stores/hierarchyStore.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TaxonomyNode, TaxonomyHierarchyNode } from '../hooks/useHierarchyTree';

interface HierarchyStats {
    total_nodes: number;
    [key: string]: number;
}

interface PlotlyHierarchyData {
    labels: string[];
    parents: string[];
    values: number[];
    ids: string[];
    ranks: string[];
}

interface CachedHierarchy {
    hierarchyData: TaxonomyHierarchyNode[];
    stats: HierarchyStats;
    plotlyData: PlotlyHierarchyData;
    timestamp: number;
}

interface HierarchyState {
    cache: Record<string, CachedHierarchy>;
    loading: boolean;
    error: string | null;
    // Actions
    buildHierarchy: (nodes: TaxonomyNode[]) => Promise<{
        hierarchyData: TaxonomyHierarchyNode[];
        stats: HierarchyStats;
        plotlyData: PlotlyHierarchyData;
    }>;
    clearCache: () => void;
    setError: (error: string | null) => void;
}

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

const validateAndTransformNodes = (nodes: TaxonomyNode[]): TaxonomyHierarchyNode[] => {
    return nodes.map(node => ({
        name: node.name,
        tax_id: node.tax_id,
        rank: node.rank,
        percentage: node.percentage,
        reads: node.reads,
        depth: node.depth,
        children: []
    }));
};

// Generate a cache key from nodes array
const generateCacheKey = (nodes: TaxonomyNode[]): string => {
    return nodes
        .map(node => `${node.tax_id}-${node.reads}-${node.percentage}`)
        .join('|');
};

// Check if cache entry is still valid
const isCacheValid = (timestamp: number): boolean => {
    return Date.now() - timestamp < CACHE_EXPIRATION;
};

// Process hierarchy data for Plotly visualization
const processHierarchyData = (hierarchy: TaxonomyHierarchyNode[]): PlotlyHierarchyData => {
    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];
    const ids: string[] = [];
    const ranks: string[] = [];

    const traverse = (node: TaxonomyHierarchyNode, parentId: string = '') => {
        const nodeId = `${node.name}-${node.tax_id}`;
        labels.push(node.name);
        parents.push(parentId);
        values.push(node.reads);
        ids.push(nodeId);
        ranks.push(node.rank);

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => traverse(child, nodeId));
        }
    };

    hierarchy.forEach(root => traverse(root));

    return { labels, parents, values, ids, ranks };
};

export const useHierarchyStore = create<HierarchyState>((set, get) => ({
    cache: {},
    loading: false,
    error: null,

    buildHierarchy: async (nodes: TaxonomyNode[]) => {
        try {
            set({ loading: true, error: null });

            // Generate cache key
            const cacheKey = generateCacheKey(nodes);
            const cachedData = get().cache[cacheKey];

            // Return cached data if valid
            if (cachedData && isCacheValid(cachedData.timestamp)) {
                set({ loading: false });
                const { hierarchyData, stats, plotlyData } = cachedData;
                return { hierarchyData, stats, plotlyData };
            }

            // Transform nodes to match Rust structure
            const transformedNodes = validateAndTransformNodes(nodes);

            // Build hierarchy using Rust
            const hierarchyData = await invoke<TaxonomyHierarchyNode[]>(
                'build_taxonomy_hierarchy',
                { nodes: transformedNodes }
            );

            // Validate the hierarchy
            const isValid = await invoke<boolean>(
                'validate_taxonomy_hierarchy',
                { nodes: hierarchyData }
            );

            if (!isValid) {
                throw new Error('Invalid hierarchy structure detected');
            }

            // Get hierarchy statistics
            const stats = await invoke<HierarchyStats>(
                'get_hierarchy_stats',
                { nodes: hierarchyData }
            );

            // Process data for Plotly visualization
            const plotlyData = processHierarchyData(hierarchyData);

            // Cache the results with a guaranteed plotlyData field
            set(state => ({
                cache: {
                    ...state.cache,
                    [cacheKey]: {
                        hierarchyData,
                        stats,
                        plotlyData,
                        timestamp: Date.now()
                    }
                },
                loading: false
            }));

            return { hierarchyData, stats, plotlyData };

        } catch (err) {
            console.log(err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to build hierarchy';
            console.error('Error building hierarchy:', err);
            set({ error: errorMessage, loading: false });

            // Throw the error instead of returning incomplete data
            throw err;
        }
    },

    clearCache: () => {
        set({ cache: {} });
    },

    setError: (error: string | null) => {
        set({ error });
    }
}));