// src/components/KrakenVisualization/TaxonomyStarburst.tsx

import React, { useEffect, useRef, useMemo, useState } from 'react';
import Plotly from 'plotly.js-dist';
import { Box, Button, Typography } from '@mui/material';
import { ProcessedKrakenUniqReport } from '@/lib/types';
import { TaxonomicRank } from '@/lib/powersync/DrizzleSchema.ts'; // <-- Adjust path if needed
import useSettings from "@/lib/hooks/useSettings"; // to get optional max rank

interface TaxonomyStarburstProps {
    data: ProcessedKrakenUniqReport[];
    width?: number;
    height?: number;
}

// Neutral beige for top-level nodes
const topLevelBeige = '#f5f5dc';

// Base colors for second-level nodes
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
        const newS = Math.max(s - (reduceSteps * 0.015), 0);
        return hslToHex(h, newS, l);
    } else {
        return baseColor;
    }
};

interface NodeInfo {
    node: ProcessedKrakenUniqReport;
    depth: number;
    path: string[];
}

const TaxonomyStarburst: React.FC<TaxonomyStarburstProps> = ({
                                                                 data,
                                                                 width = 800,
                                                                 height = 800
                                                             }) => {
    const plotRef = useRef<HTMLDivElement | null>(null);
    const [currentRootId, setCurrentRootId] = useState<string | undefined>(undefined);
    const [parentMap, setParentMap] = useState<Record<string, string>>({});

    // Load user settings for max rank only
    const { userSettings } = useSettings();
    const userSetting = userSettings || null;
    const maxRankSetting = userSetting?.taxonomic_starburst_max_rank as TaxonomicRank | undefined;

    // Build the hierarchy and parent map
    useEffect(() => {
        const map: Record<string, string> = {};
        data.forEach(node => {
            if (node.parent_id) {
                map[node.id] = node.parent_id;
            }
        });
        setParentMap(map);
    }, [data]);

    const getNodeHierarchyInfo = (nodes: ProcessedKrakenUniqReport[]): NodeInfo[] => {
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const result: NodeInfo[] = [];

        const processNode = (
            node: ProcessedKrakenUniqReport,
            currentDepth: number,
            currentPath: string[]
        ) => {
            result.push({
                node,
                depth: currentDepth,
                path: [...currentPath, node.id]
            });

            // Find all children
            nodes.forEach(potentialChild => {
                if (potentialChild.parent_id === node.id) {
                    processNode(potentialChild, currentDepth + 1, [...currentPath, node.id]);
                }
            });
        };

        // Root nodes: no parent or parent not in dataset
        const rootNodes = nodes.filter(
            node => !node.parent_id || !nodeMap.has(node.parent_id)
        );

        rootNodes.forEach(root => processNode(root, 0, []));
        return result;
    };

    // Process the data for plotly
    const processDataForPlotly = (nodes: ProcessedKrakenUniqReport[]) => {
        // 1) Filter out nodes that have ranks not in the enum:
        let filteredNodes = nodes.filter(node =>
            Object.values(TaxonomicRank).includes(node.rank as TaxonomicRank)
        );

        // 2) Enforce ONLY max rank (remove any "min" logic)
        // Create a small rank-order map for reference
        const rankOrderMap: Record<TaxonomicRank, number> = {
            [TaxonomicRank.Root]: 0,
            [TaxonomicRank.Domain]: 1,
            [TaxonomicRank.Supergroup]: 2,
            [TaxonomicRank.Division]: 3,
            [TaxonomicRank.Subdivision]: 4,
            [TaxonomicRank.Class]: 5,
            [TaxonomicRank.Order]: 6,
            [TaxonomicRank.Family]: 7,
            [TaxonomicRank.Genus]: 8,
            [TaxonomicRank.Species]: 9,
            [TaxonomicRank.Assembly]: 10,
            [TaxonomicRank.Sequence]: 11,
        };

        if (maxRankSetting) {
            filteredNodes = filteredNodes.filter(node => {
                const nodeRankEnum = node.rank as TaxonomicRank;
                const nodeVal = rankOrderMap[nodeRankEnum];
                const maxVal = rankOrderMap[maxRankSetting];
                return nodeVal <= maxVal;
            });
        }

        const hierarchyInfo = getNodeHierarchyInfo(filteredNodes);

        const labels: string[] = [];
        const parents: string[] = [];
        const values: number[] = [];
        const ids: string[] = [];
        // [tax_id, rank, percentage, reads, coverage, e_score]
        const customdata: Array<[number, string, number, number, number, number]> = [];
        const colors: string[] = [];

        let secondLevelColorIndex = 0;

        hierarchyInfo.forEach(({ node, depth }) => {
            labels.push(node.tax_name);
            parents.push(node.parent_id || '');
            values.push(node.reads);
            ids.push(node.id);

            customdata.push([
                node.tax_id,
                node.rank,
                node.percentage,
                node.reads,
                node.coverage,
                node.e_score
            ]);

            // Color logic
            let nodeColor: string;
            if (depth === 0) {
                nodeColor = topLevelBeige;
            } else if (depth === 1) {
                nodeColor = baseColors[secondLevelColorIndex % baseColors.length];
                secondLevelColorIndex++;
            } else {
                const parentIndex = hierarchyInfo.findIndex(info =>
                    info.node.id === node.parent_id
                );
                const parentColor = colors[parentIndex];
                nodeColor = getColorForDepth(parentColor || topLevelBeige, depth);
            }
            colors.push(nodeColor);
        });

        return { labels, parents, values, ids, customdata, colors };
    };

    const processedData = useMemo(() => {
        if (!data || data.length === 0) return null;

        // If we have a current root, filter to show only that subtree
        let dataToProcess = data;
        if (currentRootId) {
            const getSubtreeNodes = (rootId: string): Set<string> => {
                const subtreeNodes = new Set([rootId]);
                let found = true;
                while (found) {
                    found = false;
                    data.forEach(node => {
                        if (
                            node.parent_id &&
                            subtreeNodes.has(node.parent_id) &&
                            !subtreeNodes.has(node.id)
                        ) {
                            subtreeNodes.add(node.id);
                            found = true;
                        }
                    });
                }
                return subtreeNodes;
            };
            const subtree = getSubtreeNodes(currentRootId);
            dataToProcess = data.filter(node => subtree.has(node.id));
        }

        return processDataForPlotly(dataToProcess);
    }, [data, currentRootId, maxRankSetting]);

    const isRootClickable = (rootId: string | undefined) => {
        return !!rootId && !!parentMap[rootId];
    };

    // Draw the plot
    const drawPlot = async () => {
        if (!plotRef.current || !processedData) return;

        const data: Partial<Plotly.PlotData>[] = [
            {
                type: 'sunburst',
                labels: processedData.labels,
                parents: processedData.parents,
                ids: processedData.ids,
                values: processedData.values,
                customdata: processedData.customdata,
                hovertemplate: `
          <b>%{label}</b><br>
          Tax ID: %{customdata[0]}<br>
          Rank: %{customdata[1]}<br>
          Percentage: %{customdata[2]}%<br>
          Reads: %{customdata[3]}<br>
          Coverage: %{customdata[4]}<br>
          E-score: %{customdata[5]}<br>
          <extra></extra>`,
                marker: {
                    colors: processedData.colors,
                    line: { color: '#ffffff', width: 0 },
                },
                branchvalues: 'total',
                textinfo: 'label',
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
                // If we have a parent, bubble up
                if (currentRootId && parentMap[currentRootId]) {
                    setCurrentRootId(parentMap[currentRootId]);
                }
            } else {
                setCurrentRootId(clickedId);
            }
        });

        gd.on('plotly_hover', (event: any) => {
            const point = event.points?.[0];
            if (!point || !plotRef.current) return;

            const hoveredId = point.id;
            let cursorStyle = 'default';

            if (hoveredId !== currentRootId) {
                cursorStyle = 'pointer';
            } else if (isRootClickable(currentRootId)) {
                cursorStyle = 'pointer';
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
        console.debug(processedData);
        drawPlot();
    }, [processedData, width, height]);

    const handleReset = () => {
        setCurrentRootId(undefined);
    };

    if (!data || data.length === 0) {
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
