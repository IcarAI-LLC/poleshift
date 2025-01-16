"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import * as d3 from "d3";
import { ProcessedKrakenUniqReport } from "src/types";

// Import the shadcn Tooltip components
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ---- Same color helper logic (unchanged) ---- //
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
        if (h < 0) h += 360;
    }

    return { h, s, l };
}

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

function getColorForDepth(baseColor: string, depth: number) {
    const { h, s, l } = hexToHsl(baseColor);
    if (depth > 1) {
        const reduceSteps = depth - 1;
        const newS = Math.max(s - reduceSteps * 0.015, 0);
        return hslToHex(h, newS, l);
    }
    return baseColor;
}

/**
 * Returns whether a label can fit on the arc.
 */
function canFitLabel(d: any, radius: number) {
    if (!d?.data?.name) {
        return false;
    }
    // Arc length = angle * radius (approx). We'll label at the mid radius.
    const rMid = ((d.y0 + d.y1) / 2) * radius;
    const angle = d.x1 - d.x0;
    const arcLength = angle * rMid;

    const label = d.data.name;
    const estimatedTextLength = label.length * 6;
    return arcLength >= estimatedTextLength;
}

/**
 * When using a textPath, reversing the path if the arc midpoint
 * is > 180° (π radians) keeps the text from flipping upside down.
 */
function computeLabelPath(d: any, labelArc: any) {
    // Copy x0/x1 so we can flip if needed
    const [startAngle, endAngle] = [d.x0, d.x1];
    // Temporarily clone `d` so labelArc sees the flipped angles
    const cloned = { ...d, x0: startAngle, x1: endAngle };
    return labelArc(cloned);
}

// ---- MAIN COMPONENT ---- //
export default function TaxonomySunburstD3({
                                               data,
                                           }: {
    data: ProcessedKrakenUniqReport[];
}) {
    const svgRef = useRef<SVGSVGElement | null>(null);

    // Keep track of the “current root” for zooming
    const [currentRootId, setCurrentRootId] = useState<string | undefined>();

    // ---- NEW: track tooltip info in React state ---- //
    const [tooltipData, setTooltipData] = useState<{
        content: string;
        x: number;
        y: number;
    } | null>(null);

    // ---- Same color logic
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

    const childrenMap = useMemo(() => {
        const tmp: Record<string, ProcessedKrakenUniqReport[]> = {};
        data.forEach((n) => {
            tmp[n.id] = [];
        });
        data.forEach((n) => {
            if (n.parent_id && tmp[n.parent_id]) {
                tmp[n.parent_id].push(n);
            }
        });
        return tmp;
    }, [data]);

    // Build an actual hierarchical structure for d3.hierarchy
    const buildHierarchy = useCallback(() => {
        // Quick map from id => node
        const nodeById: Record<string, ProcessedKrakenUniqReport> = {};
        data.forEach((d) => {
            nodeById[d.id] = d;
        });

        // Identify root(s)
        let roots: ProcessedKrakenUniqReport[] = [];
        if (currentRootId && nodeById[currentRootId]) {
            roots = [nodeById[currentRootId]];
        } else {
            // Forest roots => no parent or missing parent's node
            roots = data.filter((d) => !d.parent_id || !nodeById[d.parent_id]);
        }

        function buildNode(node: ProcessedKrakenUniqReport): any {
            const kids = childrenMap[node.id] || [];
            return {
                name: node.tax_name,
                id: node.id,
                value: node.tax_reads, // or coverage, e_score, etc.
                coverage: node.coverage,
                duplication: node.duplication,
                e_score: node.e_score,
                percentage: node.percentage,
                rank: node.rank,
                tax_id: node.tax_id,
                nodeData: node,
                children: kids.map((c) => buildNode(c)),
            };
        }

        if (roots.length > 1) {
            return {
                name: "dummyRoot",
                children: roots.map((r) => buildNode(r)),
            };
        } else if (roots.length === 1) {
            return buildNode(roots[0]);
        }
        return null;
    }, [data, currentRootId, childrenMap]);

    // D3 code
    useEffect(() => {
        const hierarchyData = buildHierarchy();
        if (!hierarchyData) return;

        if (svgRef.current) {
            d3.select(svgRef.current).selectAll("*").remove();
        }

        const size = 700;
        const radius = size / 24;

        const root = d3
            .hierarchy(hierarchyData as any)
            .sum((d: any) => d.value)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        d3.partition().size([2 * Math.PI, root.height + 1])(root);

        root.each((d: any) => {
            d.current = d;
        });

        // Assign color
        const nodeColors: Record<string, string> = {};
        let secondLevelColorIndex = 0;
        root.descendants().forEach((d: any) => {
            const depth = d.depth;
            const id = d.data.id;
            if (!id) return;

            if (depth === 0) {
                nodeColors[id] = topLevelBeige;
            } else if (depth === 1) {
                nodeColors[id] = baseColors[secondLevelColorIndex % baseColors.length];
                secondLevelColorIndex++;
            } else {
                const parentId = d.parent?.data?.id;
                const parentColor = parentId ? nodeColors[parentId] : topLevelBeige;
                nodeColors[id] = getColorForDepth(parentColor, depth);
            }
        });

        // Main arc
        const arc = d3
            .arc()
            .startAngle((d: any) => d.x0)
            .endAngle((d: any) => d.x1)
            .padAngle((d: any) => Math.min((d.x1 - d.x0) / 2, 0.01))
            .padRadius(radius * 0.1)
            .innerRadius((d: any) => d.y0 * radius)
            .outerRadius((d: any) => Math.max(d.y0 * radius, d.y1 * radius - 1));

        // Label arc => used for textPath
        const labelArc = d3
            .arc()
            .innerRadius((d: any) => ((d.y0 + d.y1) / 2) * radius)
            .outerRadius((d: any) => ((d.y0 + d.y1) / 2) * radius)
            .startAngle((d: any) => d.x0)
            .endAngle((d: any) => d.x1)
            .padAngle((d: any) => Math.min((d.x1 - d.x0) / 2, 0.005));

        const svg = d3
            .select(svgRef.current)
            .attr("viewBox", [-size / 2, -size / 2, size, size])
            .style("font", "10px sans-serif");

        // Each node => a <g>
        const node = svg
            .selectAll("g.node")
            .data(root.descendants())
            .join("g")
            .attr("class", "node");

        // Arc path
        node
            .append("path")
            .attr("class", "sunburst-arc")
            .attr("id", (d: any) => `arc-${d.data.id}`)
            .attr("fill", (d: any) => nodeColors[d.data.id] || "#ccc")
            .attr("d", (d: any) => arc(d.current))
            .style("cursor", (d: any) => (d.children ? "pointer" : "default"))
            .on("click", (event, p: any) => {
                clicked(event, p, root, svg, node, arc, radius, labelArc);
            })
            // ---- NEW: Track mouse over/out to drive shadcn tooltip state ----
            .on("mouseenter", (event, d: any) => {
                // Build the “ancestors / Reads: value” text
               d
                    .ancestors()
                    .map((a: any) => a.data.name)
                    .reverse()
                    .join("/");
                const content = `${d.data.name}\n Taxonomic Rank: ${d.data.rank}\n Reads:${d.value}\n Percentage: ${d.data.percentage}\n Coverage: ${d.data.coverage}\n Duplication: ${d.data.duplication}\n E-Score: ${d.data.e_score}\n Taxonomy ID: ${d.data.tax_id}\n`;

                // Use clientX/Y or pageX/Y or offsetX/Y as you prefer
                setTooltipData({
                    content,
                    x: event.clientX,
                    y: event.clientY,
                });
            })
            .on("mousemove", (event) => {
                // Keep position updated as the user moves
                setTooltipData((old) =>
                    old
                        ? {
                            ...old,
                            x: event.clientX,
                            y: event.clientY,
                        }
                        : null
                );
            })
            .on("mouseleave", () => {
                // Hide the tooltip
                setTooltipData(null);
            });

        // ---- Remove the old native tooltip code ----
        // path.append("title").text(...);

        // We only create label arcs/paths if it fits
        node
            .filter((d: any) => canFitLabel(d.current, radius))
            .append("path")
            .attr("id", (d: any) => `label-arc-${d.data.id}`)
            .attr("fill", "none")
            .attr("stroke", "none")
            .attr("pointer-events", "none")
            .attr("d", (d: any) => computeLabelPath(d.current, labelArc));

        // Attach the textPath itself
        node
            .filter((d: any) => canFitLabel(d.current, radius))
            .append("text")
            .attr("dy", "0.0em") // vertical offset along the arc
            .append("textPath")
            .attr("href", (d: any) => `#label-arc-${d.data.id}`)
            // Center the text along the arc:
            .attr("startOffset", "75%")
            .attr("text-anchor", "middle")
            .attr("pointer-events", "none")
            .text((d: any) => d.data.name);

        // Center circle => bubble up
        svg
            .append("circle")
            .datum(root)
            .attr("r", radius / 3)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("click", (_event, p) => {
                if (p.parent && p.parent.data && p.parent.data.id) {
                    setCurrentRootId(p.parent.data.id);
                } else {
                    setCurrentRootId(undefined);
                }
            });

        // ----------- ZOOM / CLICK HANDLER -----------
        function clicked(
            event: any,
            p: any,
            root: any,
            svg: any,
            node: any,
            arc: any,
            radius: number,
            labelArc: any
        ) {
            // If clicked arc has children, set as new root
            if (p.children) {
                setCurrentRootId(p.data.id);
            }

            root.each((d: any) => {
                d.target = {
                    x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                    x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                    y0: Math.max(0, d.y0 - p.depth),
                    y1: Math.max(0, d.y1 - p.depth),
                };
            });

            const t = svg.transition().duration(event.altKey ? 7500 : 100);

            // Transition each arc
            node
                .selectAll("path.sunburst-arc")
                .transition(t)
                .tween("data", function (d: any) {
                    const i = d3.interpolate(d.current, d.target);
                    return (t: any) => {
                        d.current = i(t);
                    };
                })
                .attrTween("d", function (d: any) {
                    return () => arc(d.current);
                });

            // Transition label arcs and text
            node
                .selectAll("path[id^='label-arc-']")
                .transition(t)
                .attrTween("d", function (d: any) {
                    return () => computeLabelPath(d.current, labelArc);
                });

            node
                .selectAll("textPath")
                .transition(t)
                .attrTween("href", function (d: any) {
                    return () => `#label-arc-${d.data.id}`;
                });

            // Fade text in/out if it no longer fits
            node
                .selectAll("text")
                .transition(t)
                .attrTween("opacity", function (d: any) {
                    return () => (canFitLabel(d.current, radius) ? "1" : "0");
                });
        }
    }, [buildHierarchy]);

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
        <div className="relative flex flex-col items-center justify-center">
            <div className="relative w-[1000px] h-[800px]">
                <svg ref={svgRef} width="100%" height="100%" />
                <button
                    onClick={handleReset}
                    className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded"
                >
                    Reset
                </button>

                {/* --- SHADCN TOOLTIP RENDERING --- */}
                {tooltipData && (
                    <Tooltip open={true}>
                        <TooltipTrigger asChild>
                            {/*
                A small absolutely-positioned div near the mouse pointer,
                so the shadcn Tooltip knows where to anchor.
              */}
                            <div
                                style={{
                                    position: "fixed",
                                    top: tooltipData.y-10,
                                    left: tooltipData.x,
                                    width: 0,
                                    height: 0,
                                    transform: "translate(-50%, -50%)",
                                }}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <pre>{tooltipData.content}</pre>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    );
}
