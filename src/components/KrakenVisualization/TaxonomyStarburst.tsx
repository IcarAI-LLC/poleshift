import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Plotly from "plotly.js-dist";

// ShadCN UI
import { Button } from "@/components/ui/button"; // Adjust path as needed

import useSettings from "@/hooks/useSettings.ts";
import { ProcessedKrakenUniqReport } from "src/types";
import { TaxonomicRank } from "@/lib/powersync/DrizzleSchema";

interface TaxonomyStarburstProps {
    data: ProcessedKrakenUniqReport[];
    width?: number;
    height?: number;
}

const topLevelBeige = "#f5f5dc";

const baseColors = [
    "#ff6d55",
    "#ffec4d",
    "#ffae21",
    "#2fffdc",
    "#ff66ae",
    "#b4ceff",
    "#ffbf89",
];

// Convert HEX to HSL
function hexToHsl(hex: string) {
    let h: number, s: number;
    hex = hex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
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
        if (h < 0) {
            h += 360;
        }
    }

    return { h, s, l };
}

// Convert HSL to HEX
function hslToHex(h: number, s: number, l: number) {
    const hueToRgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    h /= 360;
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // Achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hueToRgb(p, q, h + 1 / 3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1 / 3);
    }

    const toHex = (x: number) => {
        const hexVal = Math.round(x * 255).toString(16);
        return hexVal.length === 1 ? "0" + hexVal : hexVal;
    };

    return "#" + toHex(r) + toHex(g) + toHex(b);
}

// Decrease saturation as depth increases
function getColorForDepth(baseColor: string, depth: number) {
    const { h, s, l } = hexToHsl(baseColor);
    if (depth > 1) {
        // tweak multiplier as needed
        const reduceSteps = depth - 1;
        const newS = Math.max(s - reduceSteps * 0.015, 0);
        return hslToHex(h, newS, l);
    }
    return baseColor;
}

interface NodeInfo {
    node: ProcessedKrakenUniqReport;
    depth: number;
    parentId?: string;
}

export default function TaxonomyStarburst({
                                              data,
                                              width = 800,
                                              height = 800,
                                          }: TaxonomyStarburstProps) {
    const plotRef = useRef<HTMLDivElement | null>(null);
    const [currentRootId, setCurrentRootId] = useState<string | undefined>();
    const [parentMap, setParentMap] = useState<Record<string, string>>({});

    // User settings for max rank
    const { userSettings } = useSettings();
    const userSetting = userSettings || null;
    const maxRankSetting = userSetting?.taxonomic_starburst_max_rank as
        | TaxonomicRank
        | undefined;

    // Quick rank order map
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

    /**
     * Build a parent -> children map for quick lookups.
     * Also build the parentMap for upward traversal.
     */
    const [childrenMap, setChildrenMap] = useState<
        Record<string, ProcessedKrakenUniqReport[]>
    >({});

    useEffect(() => {
        if (!data || data.length === 0) return;

        const tmpParentMap: Record<string, string> = {};
        const tmpChildrenMap: Record<string, ProcessedKrakenUniqReport[]> = {};

        // Initialize arrays for all possible ids so you don't need checks
        data.forEach((node) => {
            if (node.parent_id) {
                tmpParentMap[node.id] = node.parent_id;
            }
            tmpChildrenMap[node.id] = [];
        });

        // Fill children
        data.forEach((node) => {
            if (node.parent_id && tmpChildrenMap[node.parent_id]) {
                tmpChildrenMap[node.parent_id].push(node);
            }
        });

        setParentMap(tmpParentMap);
        setChildrenMap(tmpChildrenMap);
    }, [data]);

    /**
     * Build a NodeInfo array from a root node down via DFS or BFS
     */
    const buildHierarchyFromRoot = useCallback(
        (root: ProcessedKrakenUniqReport): NodeInfo[] => {
            const result: NodeInfo[] = [];
            const stack: Array<{ node: ProcessedKrakenUniqReport; depth: number }> = [
                { node: root, depth: 0 },
            ];

            while (stack.length > 0) {
                const { node, depth } = stack.pop()!;
                result.push({ node, depth, parentId: node.parent_id || undefined });

                // push children to stack
                if (childrenMap[node.id]) {
                    for (const child of childrenMap[node.id]) {
                        stack.push({ node: child, depth: depth + 1 });
                    }
                }
            }
            return result;
        },
        [childrenMap]
    );

    /**
     * Filter nodes by rank and build NodeInfo for the entire forest (all roots),
     * or for a particular subtree if `currentRootId` is defined.
     */
    const buildFilteredHierarchy = useCallback((): NodeInfo[] => {
        // 1) Keep only nodes whose rank is in the enum
        let filtered = data.filter((n) =>
            Object.values(TaxonomicRank).includes(n.rank as TaxonomicRank)
        );

        // 2) If user sets a max rank, filter deeper ranks
        if (maxRankSetting) {
            filtered = filtered.filter((n) => {
                const nodeRankEnum = n.rank as TaxonomicRank;
                return rankOrderMap[nodeRankEnum] <= rankOrderMap[maxRankSetting];
            });
        }

        // Create a quick map so we can find the root node(s)
        const nodeMap: Record<string, ProcessedKrakenUniqReport> = {};
        filtered.forEach((node) => {
            nodeMap[node.id] = node;
        });

        // If we have a currentRootId, just build the subtree from that root
        if (currentRootId && nodeMap[currentRootId]) {
            return buildHierarchyFromRoot(nodeMap[currentRootId]);
        }

        // Otherwise, build from all "forest" roots (i.e. no valid parent)
        const forestRoots: ProcessedKrakenUniqReport[] = [];
        filtered.forEach((node) => {
            // If it has no parent OR its parent is not in the nodeMap => root
            if (!node.parent_id || !nodeMap[node.parent_id]) {
                forestRoots.push(node);
            }
        });

        const allNodes: NodeInfo[] = [];
        forestRoots.forEach((root) => {
            allNodes.push(...buildHierarchyFromRoot(root));
        });

        return allNodes;
    }, [
        data,
        maxRankSetting,
        currentRootId,
        rankOrderMap,
        buildHierarchyFromRoot,
    ]);

    /**
     * Take NodeInfo array and transform into Plotly sunburst data
     */
    const processDataForPlotly = useCallback((nodeInfos: NodeInfo[]) => {
        const labels: string[] = [];
        const parents: string[] = [];
        const values: number[] = [];
        const ids: string[] = [];
        const customdata: Array<[number, string, number, number, number, number]> =
            [];
        const colors: string[] = [];

        // Keep track of color assigned to each node’s index
        let secondLevelColorIndex = 0;

        // A helper to find an index quickly by ID
        const idToIndex: Record<string, number> = {};

        nodeInfos.forEach((info, i) => {
            const { node, parentId } = info;
            labels.push(node.tax_name);
            parents.push(parentId || "");
            values.push(node.reads);
            ids.push(node.id);
            customdata.push([
                node.tax_id,
                node.rank,
                node.percentage,
                node.reads,
                node.coverage,
                node.e_score,
            ]);
            idToIndex[node.id] = i;
        });

        // Now assign colors with a second pass to be sure parentIndex is known
        nodeInfos.forEach((info) => {
            const { depth, parentId } = info;
            let nodeColor = topLevelBeige;

            if (depth === 1) {
                // second-level child
                nodeColor = baseColors[secondLevelColorIndex % baseColors.length];
                secondLevelColorIndex += 1;
            } else if (depth > 1) {
                const parentIndex = idToIndex[parentId ?? ""];
                const parentColor = parentIndex >= 0 ? colors[parentIndex] : topLevelBeige;
                nodeColor = getColorForDepth(parentColor, depth);
            }

            colors.push(nodeColor);
        });

        return { labels, parents, values, ids, customdata, colors };
    }, []);

    // Build the final Plotly data
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return null;
        const nodeInfos = buildFilteredHierarchy();
        return processDataForPlotly(nodeInfos);
    }, [data, buildFilteredHierarchy, processDataForPlotly]);

    // Check if the root is clickable (i.e. can bubble up)
    const isRootClickable = useCallback(
        (rootId: string | undefined) => {
            return !!rootId && !!parentMap[rootId];
        },
        [parentMap]
    );

    // Plotly draw
    async function drawPlot() {
        if (!plotRef.current || !processedData) return;

        const chartData: Partial<Plotly.PlotData>[] = [
            {
                type: "sunburst",
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
                    line: { width: 0 },
                    pattern: {
                        solidity: 1,
                    },
                },
                branchvalues: "total",
                textinfo: "label",
            },
        ];

        const layout: Partial<Plotly.Layout> = {
            margin: { l: 0, r: 0, b: 0, t: 0 },
            width,
            height,
            paper_bgcolor: "rgba(0,0,0,0)",
        };

        const config: Partial<Plotly.Config> = {
            responsive: true,
            displayModeBar: false,
        };

        const gd = await Plotly.react(plotRef.current, chartData, layout, config);

        // Remove existing listeners
        gd.removeAllListeners("plotly_sunburstclick");
        gd.removeAllListeners("plotly_hover");
        gd.removeAllListeners("plotly_unhover");

        gd.on("plotly_sunburstclick", (event: any) => {
            const point = event.points?.[0];
            if (!point || !point.id) return;

            const clickedId = point.id;
            if (clickedId === currentRootId && isRootClickable(currentRootId)) {
                // bubble up
                if (currentRootId && parentMap[currentRootId]) {
                    setCurrentRootId(parentMap[currentRootId]);
                }
            } else {
                setCurrentRootId(clickedId);
            }
        });

        gd.on("plotly_hover", (event: any) => {
            const point = event.points?.[0];
            if (!point || !plotRef.current) return;

            const hoveredId = point.id;
            let cursorStyle = "default";

            if (hoveredId !== currentRootId) {
                cursorStyle = "pointer";
            } else if (isRootClickable(currentRootId)) {
                cursorStyle = "pointer";
            }
            plotRef.current.style.cursor = cursorStyle;
        });

        gd.on("plotly_unhover", () => {
            if (plotRef.current) {
                plotRef.current.style.cursor = "default";
            }
        });
    }

    useEffect(() => {
        drawPlot();
    }, [processedData, width, height]);

    function handleReset() {
        setCurrentRootId(undefined);
    }

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <p className="text-gray-500">No hierarchy data available</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="relative" style={{ width, height }}>
                <div ref={plotRef} className="w-full h-full" />
                <Button
                    onClick={handleReset}
                    className="absolute top-4 right-4 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    Reset
                </Button>
            </div>
        </div>
    );
}
