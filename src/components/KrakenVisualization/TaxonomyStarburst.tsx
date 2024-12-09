import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist';
import { Box, Button, Typography } from '@mui/material';

interface TaxonomyNode {
    name: string;
    tax_id: number;
    rank: string;
    percentage: number;
    reads: number;
    taxReads: number;
    depth: number;
    kmers: number;
    dup: number;
    cov: number;
}

interface CustomLayout extends Partial<Plotly.Layout> {
    sunburstcolorway?: string[];
}

const nivoColors = [
    '#e8c1a0', '#f47560', '#f1e15b', '#e8a838', '#61cdbb',
    '#97e3d5', '#83bcb6', '#f471af', '#cbd5e8', '#e8c1a0'
];

const processNodes = (nodes: TaxonomyNode[]) => {
    if (!nodes || nodes.length === 0) {
        throw new Error("No nodes provided");
    }

    const rootNode = nodes.find(node =>
        node.name === "Life" || node.name === "Root"
    );

    if (!rootNode) {
        throw new Error("No root node found");
    }

    const labels: string[] = [];
    const parents: string[] = [];
    const values: number[] = [];
    const ids: string[] = [];
    const ranks: string[] = [];

    nodes.forEach(node => {
        const nodeId = `${node.name}-${node.tax_id}`;
        labels.push(node.name);
        values.push(node.taxReads);
        ids.push(nodeId);
        ranks.push(node.rank);

        if (node === rootNode) {
            parents.push("");
        } else {
            const potentialParents = nodes.filter(n => n.depth === node.depth - 1);
            const parent = potentialParents[potentialParents.length - 1];
            parents.push(parent ? `${parent.name}-${parent.tax_id}` : "");
        }
    });

    return { labels, parents, values, ids, ranks };
};

const TaxonomyStarburst: React.FC<{
    nodes: TaxonomyNode[];
    width?: number;
    height?: number;
}> = ({ nodes, width = 800, height = 800 }) => {
    const plotRef = useRef<HTMLDivElement | null>(null);
    const [overlayText, setOverlayText] = useState<string>('Life');

    const initializePlot = (div: HTMLDivElement) => {
        const processedData = processNodes(nodes);

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
        if (div) {
            initializePlot(div);
        }

        return () => {
            if (div) {
                Plotly.purge(div);
            }
        };
    }, [nodes, width, height]);

    return (
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="100vh"
        >
            <Box
                sx={{
                    position: 'relative',
                    width: width,
                    height: height,
                }}
            >
                <div ref={plotRef} style={{ width: '100%', height: '100%' }} />
                {overlayText && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            bgcolor: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            px: 2,
                            py: 1,
                            borderRadius: 1,
                            textAlign: 'center',
                        }}
                    >
                        <Typography variant="h6">{overlayText}</Typography>
                    </Box>
                )}
                <Button
                    onClick={() => {
                        setOverlayText('Life');
                        const div = plotRef.current;
                        if (div) {
                            initializePlot(div); // Reinitialize the plot
                        }
                    }}
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
