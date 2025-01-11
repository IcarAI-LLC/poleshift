
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
    BarChart,
    Bar,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { save as tauriSave } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export interface ChartRendererProps {
    chartData: any[];
    chartTitle: string;
    showAsIntraPercent: boolean;
    taxaColors: Record<string, string>;
    xAxisKey?: string;
}

export interface ChartRendererRef {
    exportImage: (format: "png" | "jpeg") => Promise<void>;
    exportPDF: () => Promise<void>;
}

export const ChartRenderer = forwardRef<ChartRendererRef, ChartRendererProps>(
    (
        { chartData, chartTitle, showAsIntraPercent, taxaColors, xAxisKey },
        ref
    ) => {
        const chartContainerRef = useRef<HTMLDivElement>(null);

        // Editable Title State
        const [editableTitle, setEditableTitle] = useState(chartTitle);
        const [isEditingTitle, setIsEditingTitle] = useState(false);

        // Editable Footer State
        const [editableFooterLine1, setEditableFooterLine1] = useState("Visualization made with Poleshift");
        const [isEditingFooter, setIsEditingFooter] = useState(false);

        // 1) Expose export methods via ref
        useImperativeHandle(ref, () => ({
            exportImage: async (format: "png" | "jpeg") => {
                if (!chartContainerRef.current) return;
                const canvas = await html2canvas(chartContainerRef.current);
                const base64 = canvas.toDataURL(`image/${format}`);
                const data = base64.split(",")[1];
                const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

                const filePath = await tauriSave({
                    filters: [{ name: "Image", extensions: [format] }],
                });
                if (filePath) {
                    await writeFile(filePath, bytes);
                    console.log(`Chart saved to: ${filePath}`);
                }
            },

            exportPDF: async () => {
                if (!chartContainerRef.current) return;
                const canvas = await html2canvas(chartContainerRef.current);
                const base64 = canvas.toDataURL("image/png");

                const pdf = new jsPDF({
                    orientation: "landscape",
                    unit: "pt",
                    format: "a4",
                });
                pdf.addImage(base64, "PNG", 0, 0, 840, 500);

                const arrayBuffer = pdf.output("arraybuffer");
                const bytes = new Uint8Array(arrayBuffer);

                const filePath = await tauriSave({
                    filters: [{ name: "PDF", extensions: ["pdf"] }],
                });
                if (filePath) {
                    await writeFile(filePath, bytes);
                    console.log(`PDF saved to: ${filePath}`);
                }
            },
        }));

        // 2) If container didn't specify xAxisKey, default to "location"
        const finalXAxisKey = xAxisKey ?? "location";

        // 3) Format helpers for Y-axis and tooltip
        const yAxisTickFormatter = (val: number) =>
            showAsIntraPercent ? `${(val * 100).toFixed(0)}%` : val.toLocaleString();

        const tooltipFormatter = (val: number) =>
            showAsIntraPercent
                ? `${(val * 100).toFixed(2)}%`
                : `${val.toLocaleString()} reads`;

        // 4) Custom X-axis tick with a 45° rotation + optional divider
        function CustomXAxisTick(props: any) {
            const { x, y, payload, index, visibleTicks } = props;
            const label = payload?.value ?? "";

            // If visibleTicks isn't defined, just render the label with rotation
            if (!visibleTicks) {
                return (
                    <g transform={`translate(${x}, ${y})`}>
                        <text
                            transform="rotate(-45)"
                            textAnchor="end"
                            fill="#ffffff"
                            dy={16}
                        >
                            {label}
                        </text>
                    </g>
                );
            }

            // Otherwise, preserve your divider logic
            const [locName] = label.split(" (");
            let drawDivider = false;
            if (index < visibleTicks.length - 1) {
                const nextLabel = visibleTicks[index + 1].value;
                const [nextLocName] = nextLabel.split(" (");
                if (nextLocName !== locName) {
                    drawDivider = true;
                }
            }

            return (
                <g transform={`translate(${x}, ${y})`}>
                    {/* The axis label (rotated) */}
                    <text
                        transform="rotate(-45)"
                        textAnchor="end"
                        fill="#ffffff"
                        dy={16}
                    >
                        {label}
                    </text>

                    {/* Optionally draw a small vertical line (divider) if next location differs */}
                    {drawDivider && (
                        <line
                            x1={50}
                            y1={-100}
                            x2={50}
                            y2={0}
                            stroke="#ffffff"
                            strokeWidth={2}
                        />
                    )}
                </g>
            );
        }

        // 5) Final render using shadcn UI card
        return (
            <Card className="bg-[#333333] text-white w-full">
                <CardHeader className="relative">
                    {/* Editable Title */}
                    {isEditingTitle ? (
                        <input
                            type="text"
                            value={editableTitle}
                            onChange={(e) => setEditableTitle(e.target.value)}
                            onBlur={() => setIsEditingTitle(false)}
                            autoFocus
                            className="w-full bg-transparent border-b border-gray-500 text-white text-xl font-semibold py-1"
                        />
                    ) : (
                        <CardTitle
                            onClick={() => setIsEditingTitle(true)}
                            className="cursor-pointer"
                        >
                            {editableTitle}
                        </CardTitle>
                    )}
                    <CardDescription>
                        {showAsIntraPercent ? "Intra-sample percentages" : `Filtered reads`}
                    </CardDescription>
                    {/* Optional Edit Button */}
                    {/* <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsEditingTitle(true)}
                        className="absolute top-4 right-4"
                    >
                        ✏️
                    </Button> */}
                </CardHeader>

                {/* We store the chart within this div so html2canvas can capture it. */}
                <div ref={chartContainerRef} className="p-4">
                    <CardContent className="h-[800px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={600}>
                            <BarChart
                                data={chartData}
                                stackOffset={showAsIntraPercent ? "expand" : undefined}
                                style={{ backgroundColor: "#333333" }}
                                margin={{ top: 20, right: 20, bottom: 200, left: 60 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#999999" />
                                <XAxis
                                    dataKey={finalXAxisKey}
                                    tick={<CustomXAxisTick />}
                                    interval={0}
                                    stroke="#ffffff"
                                />
                                <YAxis
                                    tickFormatter={yAxisTickFormatter}
                                    stroke="#ffffff"
                                    label={{
                                        value: showAsIntraPercent ? "Percentage" : "Reads",
                                        angle: -90,
                                        position: "insideLeft",
                                        dx: -20,
                                        fill: "#ffffff",
                                    }}
                                />
                                <Tooltip
                                    wrapperStyle={{ fill: "#333", backgroundColor: "#666" }}
                                    contentStyle={{ backgroundColor: "#333" }}
                                    formatter={tooltipFormatter}
                                    labelFormatter={(label: string) =>
                                        `${finalXAxisKey}: ${label}`
                                    }
                                />
                                <Legend
                                    wrapperStyle={{
                                        position: "relative",
                                        marginTop: 40,
                                        paddingRight: 20,
                                        color: "#ffffff",
                                    }}
                                />

                                {/* Render a Bar for every taxon, stacking them. */}
                                {Object.keys(taxaColors).map((taxon) =>
                                    taxon !== finalXAxisKey ? (
                                        <Bar
                                            key={taxon}
                                            dataKey={taxon}
                                            stackId="stack"
                                            fill={taxaColors[taxon]}
                                            radius={[4, 4, 4, 4]}
                                        />
                                    ) : null
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </div>

                <CardFooter className="flex flex-col gap-1">
                    {/* Editable Footer Line 1 */}
                    {isEditingFooter ? (
                        <input
                            type="text"
                            value={editableFooterLine1}
                            onChange={(e) => setEditableFooterLine1(e.target.value)}
                            onBlur={() => setIsEditingFooter(false)}
                            autoFocus
                            className="w-full bg-transparent border-b border-gray-500 text-sm text-white py-1"
                        />
                    ) : (
                        <p
                            className="text-sm cursor-pointer"
                            onClick={() => setIsEditingFooter(true)}
                        >
                            {editableFooterLine1}
                        </p>
                    )}
                </CardFooter>
            </Card>
        );
    }
);

ChartRenderer.displayName = "ChartRenderer";
