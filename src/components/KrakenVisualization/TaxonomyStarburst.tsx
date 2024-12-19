import React, { useEffect, useRef, useMemo, useState } from 'react';
import Plotly from 'plotly.js-dist';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { useHierarchyTree, TaxonomyHierarchyNode, TaxonomyNode } from '../../lib/hooks/useHierarchyTree';

interface TaxonomyStarburstProps {
    nodes: TaxonomyNode[];
    width?: number;
    height?: number;
}

// Neutral beige for top-level nodes
const topLevelBeige = '#f5f5dc';

// Base colors for second-level nodes:
const baseColors = [
    '#ff6d55',
    '#ffec4d',
    '#ffae21',
    '#2fffdc',
    '#ff66ae',
    '#b4ceff',
    '#ffbf89'
];

// Convert HEX to HSL
const hexToHsl = (hex: string) => {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number;
    let s: number;
    const l = (max + min) / 2;

    if (max === min) {
        h = 0;
        s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d) % 6;
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
                break;
        }
        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }

    return { h, s, l };
};

// Convert HSL back to HEX
const hslToHex = (h: number, s: number, l: number) => {
    const hueToRgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    h /= 360;
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // Achromatic (gray)
    } else {
        const q = l < 0.5 ? (l * (1 + s)) : (l + s - l * s);
        const p = 2 * l - q;
        r = hueToRgb(p, q, h + 1/3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1/3);
    }

    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return "#" + toHex(r) + toHex(g) + toHex(b);
};

// Reduce saturation as depth increases
const getColorForDepth = (baseColor: string, depth: number) => {
    const { h, s, l } = hexToHsl(baseColor);
    if (depth > 1) {
        const reduceSteps = depth - 1;
        const newS = Math.max(s - (reduceSteps * 0.05), 0);
        return hslToHex(h, newS, l);
    } else {
        return baseColor;
    }
};

const TaxonomyStarburst: React.FC<TaxonomyStarburstProps> = ({ nodes, width = 800, height = 800 }) => {
    const plotRef = useRef<HTMLDivElement | null>(null);
    const { hierarchyData, loading, error } = useHierarchyTree(nodes);

    // State for the current root of the sunburst
    const [currentRootId, setCurrentRootId] = useState<string | undefined>(undefined);

    const [parentMap, setParentMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!hierarchyData || hierarchyData.length === 0) return;

        const map: Record<string, string> = {};

        const buildParentMap = (node: TaxonomyHierarchyNode, parentId: string) => {
            const nodeId = `${node.name}-${node.tax_id}`;
            if (parentId) {
                map[nodeId] = parentId;
            }
            if (node.children) {
                node.children.forEach(child => buildParentMap(child, nodeId));
            }
        };

        hierarchyData.forEach(root => buildParentMap(root, ''));
        setParentMap(map);
    }, [hierarchyData]);

    const findNodeById = (hierarchy: TaxonomyHierarchyNode[], targetId: string): TaxonomyHierarchyNode | null => {
        for (const node of hierarchy) {
            const nodeId = `${node.name}-${node.tax_id}`;
            if (nodeId === targetId) {
                return node;
            }
            if (node.children && node.children.length > 0) {
                const found = findNodeById(node.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };

    const getActiveHierarchy = () => {
        if (!hierarchyData || hierarchyData.length === 0) return [];
        if (!currentRootId) return hierarchyData;
        const found = findNodeById(hierarchyData, currentRootId);
        return found ? [found] : [];
    };

    const processHierarchyData = (hierarchy: TaxonomyHierarchyNode[]) => {
        const labels: string[] = [];
        const parents: string[] = [];
        const values: number[] = [];
        const ids: string[] = [];
        const ranks: string[] = [];
        const depths: number[] = [];
        const colors: string[] = [];

        let secondLevelColorIndex = 0;

        const traverse = (node: TaxonomyHierarchyNode, parentId = '', depth = 0, baseColor?: string) => {
            const nodeId = `${node.name}-${node.tax_id}`;
            labels.push(node.name);
            parents.push(parentId);
            values.push(node.reads);
            ids.push(nodeId);
            ranks.push(node.rank);
            depths.push(depth);

            let nodeColor: string;
            let currentBaseColor = baseColor;

            if (depth === 0) {
                nodeColor = topLevelBeige;
                currentBaseColor = undefined;
            } else if (depth === 1) {
                const colorIndex = secondLevelColorIndex % baseColors.length;
                nodeColor = baseColors[colorIndex];
                secondLevelColorIndex++;
                currentBaseColor = nodeColor;
            } else {
                if (!currentBaseColor) {
                    currentBaseColor = topLevelBeige;
                }
                nodeColor = getColorForDepth(currentBaseColor, depth);
            }

            colors.push(nodeColor);

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => traverse(child, nodeId, depth + 1, currentBaseColor));
            }
        };

        hierarchy.forEach(root => traverse(root));
        return { labels, parents, values, ids, ranks, depths, colors };
    };

    const processedData = useMemo(() => {
        const activeHierarchy = getActiveHierarchy();
        if (activeHierarchy.length === 0) return null;
        return processHierarchyData(activeHierarchy);
    }, [hierarchyData, currentRootId]);

    const isRootClickable = (rootId: string | undefined) => {
        // The root is clickable if it has a parent (i.e., not the original top-level root)
        return !!rootId && !!parentMap[rootId];
    };

    const drawPlot = async () => {
        if (!plotRef.current || !processedData) return;

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
                    colors: processedData.colors,
                    line: { color: '#ffffff', width: 0 },
                },
                hovertemplate: `
                    <b>%{label}</b> (%{customdata})<br>
                    %{value:,.0f} reads<br>
                    <extra></extra>
                `,
                branchvalues: "total",
            },
        ];

        const layout: Partial<Plotly.Layout> = {
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

        const gd = await Plotly.react(plotRef.current, data, layout, config);

        // Remove existing listeners to avoid duplicates
        gd.removeAllListeners('plotly_sunburstclick');
        gd.removeAllListeners('plotly_hover');
        gd.removeAllListeners('plotly_unhover');

        gd.on('plotly_sunburstclick', (event: any) => {
            const point = event.points?.[0];
            if (!point || !point.id) return;

            const clickedId = point.id;
            if (clickedId === currentRootId) {
                // Clicked the current root. If it has a parent, go up.
                if (currentRootId && parentMap[currentRootId]) {
                    setCurrentRootId(parentMap[currentRootId]);
                }
            } else {
                // Just re-root at the clicked node
                setCurrentRootId(clickedId);
            }
        });

        // Change cursor on hover if node is clickable
        gd.on('plotly_hover', (event: any) => {
            const point = event.points?.[0];
            if (!point || !plotRef.current) return;
            const hoveredId = point.id;
            let cursorStyle = 'default';

            // If hovered node is not the current root, it's always clickable (moves down)
            if (hoveredId !== currentRootId) {
                cursorStyle = 'pointer';
            } else {
                // Hovered the current root
                // If it has a parent, we can go up, so it's clickable
                if (isRootClickable(currentRootId)) {
                    cursorStyle = 'pointer';
                }
            }

            plotRef.current.style.cursor = cursorStyle;
        });

        gd.on('plotly_unhover', () => {
            if (plotRef.current) {
                plotRef.current.style.cursor = 'default';
            }
        });
    };

    useEffect(() => {
        drawPlot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processedData, width, height]);

    const handleReset = () => {
        setCurrentRootId(undefined);
    };

    if (loading) {
        return (
            <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
                <Typography color="error">Error: {error}</Typography>
            </Box>
        );
    }

    if (!hierarchyData || hierarchyData.length === 0) {
        return (
            <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
                <Typography color="text.secondary">No hierarchy data available</Typography>
            </Box>
        );
    }

    return (
        <Box display="flex" alignItems="center" justifyContent="center" height="80vh">
            <Box sx={{ position: 'relative', width, height }}>
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
