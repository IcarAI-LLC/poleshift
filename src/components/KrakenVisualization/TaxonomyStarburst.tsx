
import {
    useEffect,
    useRef,
    useMemo,
    useState,
    useCallback,
} from "react";
import Plotly from "plotly.js-dist";

// ShadCN UI
import { Button } from "@/components/ui/button"; // Adjust path as needed

// Tailwind classes for containers instead of Box
// For text, just use <p> or <span> with tailwind classes
// Instead of MUI’s `Typography`:

import useSettings from "@/hooks/useSettings.ts";
import { ProcessedKrakenUniqReport } from "src/types";
import { TaxonomicRank } from "@/lib/powersync/DrizzleSchema"; // Adjust path if needed

interface TaxonomyStarburstProps {
    data: ProcessedKrakenUniqReport[];
    width?: number;
    height?: number;
}

// A neutral color for top-level nodes
const topLevelBeige = "#f5f5dc";

// Base colors for second-level nodes
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
        const reduceSteps = depth - 1;
        const newS = Math.max(s - reduceSteps * 0.015, 0);
        return hslToHex(h, newS, l);
    }
    return baseColor;
}

interface NodeInfo {
    node: ProcessedKrakenUniqReport;
    depth: number;
    path: string[];
}

export default function TaxonomyStarburst({
                                              data,
                                              width = 800,
                                              height = 800,
                                          }: TaxonomyStarburstProps) {
    const plotRef = useRef<HTMLDivElement | null>(null);
    const [currentRootId, setCurrentRootId] = useState<string | undefined>(
        undefined
    );
    const [parentMap, setParentMap] = useState<Record<string, string>>({});

    // User settings for max rank
    const { userSettings } = useSettings();
    const userSetting = userSettings || null;
    const maxRankSetting = userSetting?.taxonomic_starburst_max_rank as
        | TaxonomicRank
        | undefined;

    // Build parent map
    useEffect(() => {
        const map: Record<string, string> = {};
        data.forEach((node) => {
            if (node.parent_id) {
                map[node.id] = node.parent_id;
            }
        });
        setParentMap(map);
    }, [data]);

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

    // Gather hierarchical info
    const getNodeHierarchyInfo = useCallback(
        (nodes: ProcessedKrakenUniqReport[]): NodeInfo[] => {
            const nodeMap = new Map(nodes.map((node) => [node.id, node]));
            const result: NodeInfo[] = [];

            const processNode = (
                node: ProcessedKrakenUniqReport,
                currentDepth: number,
                currentPath: string[]
            ) => {
                result.push({
                    node,
                    depth: currentDepth,
                    path: [...currentPath, node.id],
                });

                // Find all children
                nodes.forEach((potentialChild) => {
                    if (potentialChild.parent_id === node.id) {
                        processNode(potentialChild, currentDepth + 1, [
                            ...currentPath,
                            node.id,
                        ]);
                    }
                });
            };

            // Root nodes
            const rootNodes = nodes.filter(
                (n) => !n.parent_id || !nodeMap.has(n.parent_id)
            );
            rootNodes.forEach((root) => processNode(root, 0, []));
            return result;
        },
        []
    );

    // Core data processing for Plotly
    const processDataForPlotly = useCallback(
        (nodes: ProcessedKrakenUniqReport[]) => {
            // 1) Filter out nodes not in the TaxonomicRank enum
            let filteredNodes = nodes.filter((node) =>
                Object.values(TaxonomicRank).includes(node.rank as TaxonomicRank)
            );

            // 2) If user sets a max rank, filter out deeper ranks
            if (maxRankSetting) {
                filteredNodes = filteredNodes.filter((node) => {
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
            const customdata: Array<[number, string, number, number, number, number]> =
                [];
            const colors: string[] = [];

            let secondLevelColorIndex = 0;

            hierarchyInfo.forEach(({ node, depth }) => {
                labels.push(node.tax_name);
                parents.push(node.parent_id || "");
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

                // Color logic
                let nodeColor: string;
                if (depth === 0) {
                    nodeColor = topLevelBeige;
                } else if (depth === 1) {
                    nodeColor = baseColors[secondLevelColorIndex % baseColors.length];
                    secondLevelColorIndex++;
                } else {
                    const parentIndex = hierarchyInfo.findIndex(
                        (info) => info.node.id === node.parent_id
                    );
                    const parentColor = parentIndex >= 0 ? colors[parentIndex] : topLevelBeige;
                    nodeColor = getColorForDepth(parentColor, depth);
                }
                colors.push(nodeColor);
            });

            return { labels, parents, values, ids, customdata, colors };
        },
        [maxRankSetting, rankOrderMap, getNodeHierarchyInfo]
    );

    // Possibly filter to a subtree if user clicks to re-root
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return null;

        let dataToProcess = data;
        if (currentRootId) {
            // Collect only the subtree
            const getSubtreeNodes = (rootId: string): Set<string> => {
                const subtree = new Set([rootId]);
                let found = true;
                while (found) {
                    found = false;
                    data.forEach((node) => {
                        if (node.parent_id && subtree.has(node.parent_id) && !subtree.has(node.id)) {
                            subtree.add(node.id);
                            found = true;
                        }
                    });
                }
                return subtree;
            };
            const subtreeSet = getSubtreeNodes(currentRootId);
            dataToProcess = data.filter((node) => subtreeSet.has(node.id));
        }
        return processDataForPlotly(dataToProcess);
    }, [data, currentRootId, processDataForPlotly]);

    // Is the root itself clickable to bubble up?
    const isRootClickable = useCallback(
        (rootId: string | undefined) => {
            return !!rootId && !!parentMap[rootId];
        },
        [parentMap]
    );

    // Plot the chart
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
                    line: { color: "#ffffff", width: 0 },
                    pattern: {
                        solidity: 1
                    }
                },
                branchvalues: "total",
                textinfo: "label",
            },
        ];

        const layout: Partial<Plotly.Layout> = {
            margin: { l: 0, r: 0, b: 0, t: 0 },
            width,
            height,
            showlegend: false,
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
                // Bubble up
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
    }, [processedData, width, height]); // re-draw if data or size changes

    // Reset the re-root to the global root
    function handleReset() {
        setCurrentRootId(undefined);
    }

    // If no data
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
                <div
                    ref={plotRef}
                    className="w-full h-full"
                />
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
