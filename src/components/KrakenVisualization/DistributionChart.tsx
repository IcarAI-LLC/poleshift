
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
    percentage: number;
    reads: number;
    taxReads: number;
    kmers: number;
    dup: number;
    cov: number;
}

interface DistributionChartProps {
    data?: DistributionData[];
    title: string;
}

// A small helper to format large numbers with commas
function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-US").format(num);
}

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
    const sortedData = [...data].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    // 2) Take the top 20
    const top20Data = sortedData.slice(0, 20);

    // Compute basic stats for the footer
    const percentages = top20Data.map((d) => d.percentage);
    const minPercentage = Math.min(...percentages);
    const maxPercentage = Math.max(...percentages);
    const avgPercentage =
        percentages.reduce((acc, val) => acc + val, 0) / percentages.length;

    // If there's only one data point, we can still show a filled area by:
    // - using type="monotone" or "linear"
    // - domain includes some room for the top
    // - Recharts draws a dot, and the fill area extends down to 0
    // => By default, Recharts will fill the area if there's a domain > 0
    const singleDataPoint = top20Data.length === 1;

    return (
        <Card className="bg-black text-white">
            <CardHeader>
                <CardTitle>{title.charAt(0).toUpperCase() + title.slice(1)}</CardTitle>
            </CardHeader>
            <CardContent>
                <div style={{ width: "100%", height: 400 }}>
                    <ResponsiveContainer>
                        <AreaChart
                            data={top20Data}
                            margin={{ top: 20, right: 20, bottom: 160, left: 20 }}
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
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#ffffff" }}
                                // domain ensures some headroom
                                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "rgba(0,0,0,0.8)",
                                    border: "1px solid #ffffff",
                                }}
                                labelStyle={{ color: "#ffffff" }}
                                formatter={(value: number, name: string) =>
                                    name === "percentage" ? formatPercentage(value) : value
                                }
                                labelFormatter={(label: string, payload: any) => {
                                    // Combine relevant data in the tooltip
                                    if (!payload || !payload.length) return label;
                                    const entry = payload[0]?.payload;
                                    return [
                                        `${entry.taxon}`,
                                        `Reads: ${formatNumber(entry.reads)}`,
                                        `Tax Reads: ${formatNumber(entry.taxReads)}`,
                                        `Percentage: ${formatPercentage(entry.percentage)}`,
                                    ].join(" • ");
                                }}
                            />
                            <Area
                                type={singleDataPoint ? "linear" : "monotone"}
                                dataKey="percentage"
                                stroke="#2196f3"
                                fill="#2196f3"
                                fillOpacity={0.4}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
            <CardFooter>
                {/* Show min, max, average percentages in the footer */}
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
                    <span className="text-muted-foreground">(Top 20 by percentage)</span>
                </div>
            </CardFooter>
        </Card>
    );
}
