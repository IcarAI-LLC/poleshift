import {forwardRef, useImperativeHandle, useRef, useState} from "react";
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
    chartData: Record<string, any>[];
    chartTitle: string;
    showAsIntraPercent: boolean;
    taxaColors: Record<string, string>;
    /**
     * If you want to override the x-axis key, pass it in.
     * Otherwise we default to "locationCharId".
     */
    xAxisKey?: string;
}

export interface ChartRendererRef {
    exportImage: (format: "png" | "jpeg") => Promise<void>;
    exportPDF: () => Promise<void>;
}

// 1) A small custom legend that displays char_id => full location name
function LocationLegend({ data }: { data: Record<string, any>[] }) {
    // Build a map of { [char_id]: fullName }
    const locationMap = new Map<string, string>();
    data.forEach((row) => {
        const charId = row.locationCharId; // Or whatever you named the field
        const fullName = row.locationName;
        if (charId && fullName && !locationMap.has(charId)) {
            locationMap.set(charId, fullName);
        }
    });

    // If none found, return null
    if (locationMap.size === 0) return null;

    return (
        <div className="mt-4">
            <p className="font-semibold mb-2">Location Legend:</p>
            <ul className="text-sm space-y-1">
                {[...locationMap.entries()].map(([charId, fullName]) => (
                    <li key={charId}>
                        <strong>{charId}:</strong> {fullName}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export const ChartRenderer = forwardRef<ChartRendererRef, ChartRendererProps>(
    ({ chartData, chartTitle, showAsIntraPercent, taxaColors, xAxisKey }, ref) => {
        const chartContainerRef = useRef<HTMLDivElement>(null);

        // Editable Title
        const [editableTitle, setEditableTitle] = useState(chartTitle);
        const [isEditingTitle, setIsEditingTitle] = useState(false);

        // Editable Footer
        const [editableFooterLine1, setEditableFooterLine1] = useState(
            "Visualization made with Poleshift"
        );
        const [isEditingFooter, setIsEditingFooter] = useState(false);

        // 2) Expose export methods
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

        // 3) Default X-axis key if not provided
        const finalXAxisKey = xAxisKey ?? "locationCharId";

        function measureTextWidth(text: string, fontSize = 12, fontFamily = "sans-serif") {
            if (typeof document === "undefined") {
                return text.length * fontSize * 0.6;
            }
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) return 0;
            context.font = `${fontSize}px ${fontFamily}`;
            return context.measureText(text).width;
        }

        function CustomXAxisTick(props: any) {
            const { x, y, payload } = props;

            // Vertical line below the axis
            const verticalLineHeight = 50;

            // Angle in degrees
            const angleDegrees = 55;
            const angleRadians = (Math.PI / 180) * angleDegrees;

            // The text you want to display
            const textValue = payload?.value ?? "";

            // Adjust these to match your styling
            const fontSize = 16.5;
            const fontFamily = "Inter";

            // 1) Measure your text in the browser:
            const textWidth = measureTextWidth(textValue, fontSize, fontFamily);

            // 2) The diagonal line is the same length as the text
            const angledEndX = textWidth * Math.cos(angleRadians);
            const angledEndY = textWidth * Math.sin(angleRadians);

            return (
                <g transform={`translate(${x}, ${y})`}>
                    {/* 1) Short vertical tick line */}
                    <line x1={0} y1={0} x2={0} y2={verticalLineHeight} stroke="#fff" />

                    {/* 2) The diagonal line, exactly the width of the text */}
                    <line
                        x1={0}
                        y1={verticalLineHeight}
                        x2={angledEndX}
                        y2={verticalLineHeight + angledEndY}
                        stroke="#fff"
                    />

                    {/* 3) Rotate the group so our text is angled.
          We want the baseline to be at the "end" of the vertical line,
          so we translate to (0, verticalLineHeight) first. */}
                    <g
                        transform={`
          translate(0, ${verticalLineHeight})
          rotate(${angleDegrees})
        `}
                    >
                        {/* 4) We shift the foreignObject up (negative y)
              so that the text is rendered above the line, not below it.
              Depending on your exact needs, tweak this offset. */}
                        <foreignObject
                            x={0}
                            y={-fontSize * 1.2} // Shift the text up by ~1.2 lines
                            width={textWidth}
                            height={fontSize * 3} // Enough height to prevent clipping
                        >
                            <div style={{ width: textWidth }}>
                                {/* 5) Use your shadcn or Tailwind classes here */}
                                <p className="text-sm text-white overflow-visible text-nowrap">
                                    {textValue}
                                </p>
                            </div>
                        </foreignObject>
                    </g>
                </g>
            );
        }

        // 4) Format helpers
        const yAxisTickFormatter = (val: number) =>
            showAsIntraPercent ? `${(val * 100).toFixed(0)}%` : val.toLocaleString();

        const tooltipFormatter = (val: number) =>
            showAsIntraPercent
                ? `${(val * 100).toFixed(2)}%`
                : `${val.toLocaleString()} reads`;

        // 5) Render
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
                        {showAsIntraPercent ? "Intra-sample percentages" : "Filtered reads"}
                    </CardDescription>
                </CardHeader>

                {/* Chart Container for export */}
                <div ref={chartContainerRef} className="p-4">
                    <CardContent>
                        <ResponsiveContainer width="100%" height="100%" minHeight={900}>
                            <BarChart
                                data={chartData}
                                stackOffset={showAsIntraPercent ? "expand" : undefined}
                                style={{backgroundColor: "#333333"}}
                                margin={{top: 20, right: 120, bottom: 250, left: 60}}
                            >
                                <Legend verticalAlign={"top"} iconType={"wye"} align={"center"}/>
                                <CartesianGrid strokeDasharray="3 3" stroke="#999999"/>

                                {/* 2) Use the custom tick component here */}
                                <XAxis
                                    dataKey={finalXAxisKey}
                                    stroke="#ffffff"
                                    tick={<CustomXAxisTick/>}
                                    // You can remove angle and tickMargin if you're handling it all in the custom tick
                                    interval={0}
                                    height={150}
                                />

                                {/* ... the rest of your chart setup ... */}
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
                                    wrapperStyle={{fill: "#333", backgroundColor: "#666"}}
                                    contentStyle={{backgroundColor: "#333"}}
                                    formatter={tooltipFormatter}
                                    labelFormatter={(label: string) => `${finalXAxisKey}: ${label}`}
                                />

                                {/* Render a Bar for each taxon */}
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

                        <LocationLegend data={chartData}/>
                    </CardContent>
                </div>

                <CardFooter className="flex flex-col gap-1">
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
