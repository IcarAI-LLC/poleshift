import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface TaxonomyNode {
    name: string;
    tax_id: number;
    rank: string;
    percentage: number;
    reads: number;
    depth: number;
}

export interface TaxonomyHierarchyNode {
    name: string;
    tax_id: number;
    rank: string;
    percentage: number;
    reads: number;
    depth: number;
    children?: TaxonomyHierarchyNode[];
}

interface HierarchyStats {
    total_nodes: number;
    [key: string]: number;
}

interface UseHierarchyTreeResult {
    hierarchyData: TaxonomyHierarchyNode[];
    stats: HierarchyStats;
    loading: boolean;
    error: string | null;
}

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

export const useHierarchyTree = (nodes: TaxonomyNode[]): UseHierarchyTreeResult => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hierarchyData, setHierarchyData] = useState<TaxonomyHierarchyNode[]>([]);
    const [stats, setStats] = useState<HierarchyStats>({ total_nodes: 0 });

    useEffect(() => {
        const buildHierarchy = async () => {
            if (!nodes?.length) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Transform nodes to match Rust structure
                const transformedNodes = validateAndTransformNodes(nodes);

                // Build hierarchy using Rust
                const hierarchy = await invoke<TaxonomyHierarchyNode[]>('build_taxonomy_hierarchy', {
                    nodes: transformedNodes
                });

                // Validate the hierarchy
                const isValid = await invoke<boolean>('validate_taxonomy_hierarchy', {
                    nodes: hierarchy
                });

                if (!isValid) {
                    throw new Error('Invalid hierarchy structure detected');
                }

                // Get hierarchy statistics
                const hierarchyStats = await invoke<HierarchyStats>('get_hierarchy_stats', {
                    nodes: hierarchy
                });

                setHierarchyData(hierarchy);
                setStats(hierarchyStats);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to build hierarchy';
                console.error('Error building hierarchy:', err);
                console.error('Original nodes:', nodes);
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        buildHierarchy();
    }, [nodes]);

    return {
        hierarchyData,
        stats,
        loading,
        error,
    };
};