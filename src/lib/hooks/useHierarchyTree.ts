// src/lib/hooks/useHierarchyTree.ts

import { useState, useEffect } from 'react';
import { useHierarchyStore } from '../stores/hierarchyStore';

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

interface PlotlyHierarchyData {
    labels: string[];
    parents: string[];
    values: number[];
    ids: string[];
    ranks: string[];
}

interface UseHierarchyTreeResult {
    hierarchyData: TaxonomyHierarchyNode[];
    stats: HierarchyStats;
    plotlyData: PlotlyHierarchyData | null;
    loading: boolean;
    error: string | null;
}

export const useHierarchyTree = (nodes: TaxonomyNode[]): UseHierarchyTreeResult => {
    const buildHierarchy = useHierarchyStore(state => state.buildHierarchy);
    const storeLoading = useHierarchyStore(state => state.loading);
    const storeError = useHierarchyStore(state => state.error);

    const [hierarchyData, setHierarchyData] = useState<TaxonomyHierarchyNode[]>([]);
    const [stats, setStats] = useState<HierarchyStats>({ total_nodes: 0 });
    const [plotlyData, setPlotlyData] = useState<PlotlyHierarchyData | null>(null);

    useEffect(() => {
        const initializeHierarchy = async () => {
            if (!nodes?.length) return;

            try {
                const { hierarchyData: newHierarchy, stats: newStats, plotlyData: newPlotlyData } = await buildHierarchy(nodes);
                setHierarchyData(newHierarchy);
                setStats(newStats);
                setPlotlyData(newPlotlyData);
            } catch (error) {
                console.error('Failed to initialize hierarchy:', error);
            }
        };

        initializeHierarchy();
    }, [nodes, buildHierarchy]);

    return {
        hierarchyData,
        stats,
        plotlyData,
        loading: storeLoading,
        error: storeError,
    };
};