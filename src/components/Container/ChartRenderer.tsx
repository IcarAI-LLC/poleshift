// file: ChartRenderer.tsx

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { save as tauriSave } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export interface ChartRendererProps {
    chartData: any[];
    chartTitle: string;
    showAsIntraPercent: boolean;
    taxaColors: Record<string, string>;
    xAxisKey?: string;
}

export interface ChartRendererRef {
    exportImage: (format: 'png' | 'jpeg') => Promise<void>;
    exportPDF: () => Promise<void>;
}

export const ChartRenderer = forwardRef<ChartRendererRef, ChartRendererProps>(
    ({ chartData, chartTitle, showAsIntraPercent, taxaColors, xAxisKey }, ref) => {
        const chartContainerRef = useRef<HTMLDivElement>(null);

        // 1) Expose export methods via ref
        useImperativeHandle(ref, () => ({
            exportImage: async (format: 'png' | 'jpeg') => {
                if (!chartContainerRef.current) return;
                const canvas = await html2canvas(chartContainerRef.current);
                const base64 = canvas.toDataURL(`image/${format}`);
                const data = base64.split(',')[1];
                const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

                const filePath = await tauriSave({
                    filters: [{ name: 'Image', extensions: [format] }]
                });
                if (filePath) {
                    await writeFile(filePath, bytes);
                    console.log(`Chart saved to: ${filePath}`);
                }
            },

            exportPDF: async () => {
                if (!chartContainerRef.current) return;
                const canvas = await html2canvas(chartContainerRef.current);
                const base64 = canvas.toDataURL('image/png');

                const pdf = new jsPDF({
                    orientation: 'l',
                    unit: 'pt',
                    format: 'a4'
                });
                pdf.addImage(base64, 'PNG', 0, 0, 840, 500);

                const arrayBuffer = pdf.output('arraybuffer');
                const bytes = new Uint8Array(arrayBuffer);

                const filePath = await tauriSave({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                });
                if (filePath) {
                    await writeFile(filePath, bytes);
                    console.log(`PDF saved to: ${filePath}`);
                }
            }
        }));

        // 2) If container didn't specify xAxisKey, default to "location"
        const finalXAxisKey = xAxisKey ?? 'location';

        // 3) Format helpers for Y-axis and tooltip
        const yAxisTickFormatter = (val: number) =>
            showAsIntraPercent ? `${(val * 100).toFixed(0)}%` : val.toLocaleString();

        const tooltipFormatter = (val: number) =>
            showAsIntraPercent
                ? `${(val * 100).toFixed(2)}%`
                : `${val.toLocaleString()} reads`;

        // Custom X-axis tick with a 45° rotation
        function CustomXAxisTick(props: any) {
            const { x, y, payload, index, visibleTicks } = props;
            const label = payload?.value ?? '';

            // If visibleTicks isn't defined, just render the label with rotation
            if (!visibleTicks) {
                return (
                    <g transform={`translate(${x}, ${y})`}>
                        <text
                            transform="rotate(-45)"
                            textAnchor="end"
                            fill="#ffffff"
                            dy={16} // Adjust as needed to move text downward
                        >
                            {label}
                        </text>
                    </g>
                );
            }

            // Otherwise, preserve your divider logic
            const [locName] = label.split(' (');
            let drawDivider = false;
            if (index < visibleTicks.length - 1) {
                const nextLabel = visibleTicks[index + 1].value;
                const [nextLocName] = nextLabel.split(' (');
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
                            x1={50}   // shift horizontally as needed
                            y1={-100} // how tall: top of the chart area
                            x2={50}
                            y2={0}
                            stroke="#ffffff"
                            strokeWidth={2}
                        />
                    )}
                </g>
            );
        }

        // 5) Final render
        return (
            <Box
                ref={chartContainerRef}
                sx={{
                    flex: 1,
                    height: 800,
                    backgroundColor: '#333333',
                    color: '#ffffff',
                    p: 3
                }}
            >
                <Typography variant="h5" textAlign="center" mb={2}>
                    {chartTitle}
                </Typography>

                <ResponsiveContainer width="100%" height="90%" minHeight={600}>
                    <BarChart
                        data={chartData}
                        stackOffset={showAsIntraPercent ? 'expand' : undefined}
                        style={{ backgroundColor: '#333333' }}
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
                                value: showAsIntraPercent ? 'Percentage' : 'Reads',
                                angle: -90,
                                position: 'insideLeft',
                                dx: -20,
                                fill: '#ffffff'
                            }}
                        />
                        <Tooltip
                            wrapperStyle={{ fill: '#333', backgroundColor: '#666' }}
                            contentStyle={{ backgroundColor: '#333' }}
                            formatter={tooltipFormatter}
                            labelFormatter={(label: string) => `${finalXAxisKey}: ${label}`}
                        />
                        {/* Move Legend further down */}
                        <Legend
                            wrapperStyle={{
                                position: 'relative',
                                marginTop: 40,
                                paddingRight: 20,
                                color: '#ffffff'
                            }}
                        />


                        {/* Render a Bar for every taxon, stacking them by default. */}
                        {Object.keys(taxaColors).map((taxon) =>
                            taxon !== finalXAxisKey ? (
                                <Bar
                                    key={taxon}
                                    dataKey={taxon}
                                    stackId="stack"
                                    fill={taxaColors[taxon]}
                                />
                            ) : null
                        )}
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        );
    }
);

ChartRenderer.displayName = 'ChartRenderer';
