import {
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    AreaChart,
    Area,
    ResponsiveContainer,
} from "recharts";

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from "@/components/ui/card";

interface DistributionData {
    taxon: string;
    percentage: number; // e.g. 50 => 50%
    reads: number;
    taxReads: number;
    kmers: number;
    dup: number;       // e.g. 5 => 5%
    cov: number;       // e.g. 12 => 12%
}

interface DistributionChartProps {
    data?: DistributionData[];
    title: string;
}

// Helper to format large numbers with commas
function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-US").format(num);
}

// Helper to format a numeric value as "XX.XX%"
function formatPercentage(num: number): string {
    return `${num.toFixed(2)}%`;
}

export default function DistributionChart({
                                              data = [],
                                              title,
                                          }: DistributionChartProps) {
    // If no data, show an empty card
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <Card className="bg-black text-white">
                <CardHeader>
                    <CardTitle>{title.charAt(0).toUpperCase() + title.slice(1)}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center">No data available for visualization</p>
                </CardContent>
            </Card>
        );
    }

    // 1) Sort by percentage descending
    const sortedData = [...data].sort(
        (a, b) => (b.percentage || 0) - (a.percentage || 0)
    );
    // 2) Take the top 20
    let top20Data = sortedData.slice(0, 20);

    // (If your data is not already in 0..100 for percentage/cov/dup, do the scaling here)
    top20Data = top20Data.map((entry) => ({
        ...entry,
        cov: entry.cov * 100, // 0.12 => 12.0
    }));
    // Compute basic stats (on the "percentage" field).
    const percentages = top20Data.map((d) => d.percentage);
    const minPercentage = Math.min(...percentages);
    const maxPercentage = Math.max(...percentages);
    const avgPercentage =
        percentages.reduce((acc, val) => acc + val, 0) / percentages.length;

    // Handle single data point for area rendering
    const singleDataPoint = top20Data.length === 1;

    return (
        <Card className="bg-black text-white">
            <CardHeader>
                <CardTitle>{title.charAt(0).toUpperCase() + title.slice(1)}</CardTitle>
            </CardHeader>
            <CardContent>
                <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                        <AreaChart
                            data={top20Data}
                            margin={{ top: 20, right: 20, bottom: 80, left: 20 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="#333333"
                            />
                            <XAxis
                                dataKey="taxon"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tick={{ fill: "#ffffff", fontSize: 12 }}
                                angle={-45}
                                textAnchor="end"
                                interval={0} // show all labels
                            />
                            {/* Left Y-axis (linear) for % and coverage (0–100 range) */}
                            <YAxis
                                yAxisId="left"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#ffffff" }}
                                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
                            />
                            {/* Right Y-axis (log) for duplication */}
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#ffffff" }}
                                scale="log"
                                // If duplication can be zero, we must avoid log(0) – so pick a small positive domain start
                                domain={[0.1, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.1))]}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "rgba(0,0,0,0.8)",
                                    border: "1px solid #ffffff",
                                }}
                                labelStyle={{ color: "#ffffff" }}
                                formatter={(value: number, name: string) => {
                                    if (name === "dup") return `${formatNumber(value)}x`;
                                    if (name === "percentage" || name === "cov") return formatPercentage(value);
                                }}
                                labelFormatter={(label: string, payload: any) => {
                                    if (!payload || !payload.length) return label;
                                    // For multi-axis charts, `payload` includes an object for each area
                                    // so we can find the actual data row from any of them
                                    const entry = payload[0]?.payload;
                                    return [
                                        entry.taxon,
                                        `Tax Reads: ${formatNumber(entry.taxReads)}`,
                                        `Percentage: ${formatPercentage(entry.percentage)}`,
                                        `Coverage: ${formatPercentage(entry.cov)}`,
                                        `Duplication: ${entry.dup}x`,
                                    ].join(" • ");
                                }}
                            />
                            {/*
                Stack coverage & percentage (both on yAxisId="left").
                They share stackId="1".
              */}
                            <Area
                                yAxisId="left"
                                type={singleDataPoint ? "linear" : "monotone"}
                                dataKey="percentage"
                                stackId="1"
                                stroke="#2196f3"
                                fill="#2196f3"
                                fillOpacity={0.5}
                            />
                            <Area
                                yAxisId="left"
                                type={singleDataPoint ? "linear" : "monotone"}
                                dataKey="cov"
                                stackId="1"
                                stroke="#4caf50"
                                fill="#4caf50"
                                fillOpacity={0.5}
                            />
                            {/* Duplication is on a separate axis with a log scale (no stackId) */}
                            <Area
                                yAxisId="right"
                                type={singleDataPoint ? "linear" : "monotone"}
                                dataKey="dup"
                                stroke="#ff9800"
                                fill="#ff9800"
                                fillOpacity={0.5}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
            <CardFooter>
                <div className="flex items-center gap-4 text-sm">
                    <div>
                        <span className="font-medium">Min:</span>{" "}
                        {formatPercentage(minPercentage)}
                    </div>
                    <div>
                        <span className="font-medium">Max:</span>{" "}
                        {formatPercentage(maxPercentage)}
                    </div>
                    <div>
                        <span className="font-medium">Avg:</span>{" "}
                        {formatPercentage(avgPercentage)}
                    </div>
                    <span className="text-muted-foreground">
            (Top 20 by percentage)
          </span>
                </div>
            </CardFooter>
        </Card>
    );
}
