import React, { useEffect, useRef, useMemo } from 'react';
import Plotly from 'plotly.js-dist';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import {useHierarchyTree, TaxonomyHierarchyNode, TaxonomyNode} from '../../lib/hooks/useHierarchyTree.ts';

interface TaxonomyStarburstProps {
    nodes: TaxonomyNode[];
    width?: number;
    height?: number;
}

const nivoColors = [
    '#e8c1a0', '#f47560', '#f1e15b', '#e8a838', '#61cdbb',
    '#97e3d5', '#83bcb6', '#f471af', '#cbd5e8', '#e8c1a0'
];

interface CustomLayout extends Partial<Plotly.Layout> {
    sunburstcolorway?: string[];
}

const TaxonomyStarburst: React.FC<TaxonomyStarburstProps> = ({ nodes, width = 800, height = 800 }) => {
    const plotRef = useRef<HTMLDivElement | null>(null);

    // Utilize the useHierarchyTree hook
    //@ts-ignore
    const { hierarchyData, stats, loading, error } = useHierarchyTree(nodes);

    // Function to process hierarchical data for Plotly
    const processHierarchyData = (hierarchy: TaxonomyHierarchyNode[]) => {
        const labels: string[] = [];
        const parents: string[] = [];
        const values: number[] = [];
        const ids: string[] = [];
        const ranks: string[] = [];

        const traverse = (node: TaxonomyHierarchyNode, parentId: string = '') => {
            const nodeId = `${node.name}-${node.tax_id}`;
            labels.push(node.name);
            parents.push(parentId);
            values.push(node.reads); // Assuming 'reads' corresponds to 'taxReads'
            ids.push(nodeId);
            ranks.push(node.rank);

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => traverse(child, nodeId));
            }
        };

        hierarchy.forEach(root => traverse(root));

        return { labels, parents, values, ids, ranks };
    };

    const processedData = useMemo(() => {
        if (!hierarchyData || hierarchyData.length === 0) {
            return null;
        }
        return processHierarchyData(hierarchyData);
    }, [hierarchyData]);

    const initializePlot = (div: HTMLDivElement) => {
        if (!processedData) {
            return;
        }

        const data: Partial<Plotly.PlotData>[] = [
            {
                type: 'sunburst',
                labels: processedData.labels,
                parents: processedData.parents,
                values: processedData.values,
                ids: processedData.ids,
                customdata: processedData.ranks,
                textinfo: 'label',
                marker: {
                    colors: nivoColors,
                    line: {
                        color: '#ffffff',
                        width: 0,
                    },
                },
                hovertemplate: `
                    <b>%{label}</b> (%{customdata})<br>
                    %{value:,.0f} reads<br>
                    <extra></extra>
                `,
            },
        ];

        const layout: CustomLayout = {
            margin: { l: 0, r: 0, b: 0, t: 0 },
            width,
            height,
            showlegend: false,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
        };

        const config: Partial<Plotly.Config> = {
            responsive: true,
            displayModeBar: false,
        };

        Plotly.newPlot(div, data, layout, config);
    };

    useEffect(() => {
        const div = plotRef.current;
        if (div && processedData) {
            initializePlot(div);
        }

        return () => {
            if (div) {
                Plotly.purge(div);
            }
        };
    }, [processedData, width, height]);

    const handleReset = () => {
        const div = plotRef.current;
        if (div && processedData) {
            initializePlot(div); // Reinitialize the plot
        }
    };

    if (loading) {
        return (
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                height="100vh"
            >
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                height="100vh"
            >
                <Typography color="error">Error: {error}</Typography>
            </Box>
        );
    }

    if (!hierarchyData || hierarchyData.length === 0) {
        return (
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                height="100vh"
            >
                <Typography color="text.secondary">No hierarchy data available</Typography>
            </Box>
        );
    }

    return (
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="80vh"
        >
            <Box
                sx={{
                    position: 'relative',
                    width: width,
                    height: height,
                }}
            >
                <div ref={plotRef} style={{ width: '100%', height: '100%' }} />
                <Button
                    onClick={handleReset}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' },
                    }}
                >
                    Reset
                </Button>
            </Box>
        </Box>
    );
};

export default TaxonomyStarburst;
