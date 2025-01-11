
import { Card, CardContent } from "@/components/ui/card";

interface SummaryCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    /**
     * Accepts any valid CSS color string, e.g., "#ff0000", "blue", etc.
     * Defaults to "inherit", meaning it won't override the existing text color.
     */
    color?: string;
}

export default function SummaryCard({
                                        title,
                                        value,
                                        subtitle,
                                        color = "inherit",
                                    }: SummaryCardProps) {
    // If `value` is numeric, format with commas
    const displayValue =
        typeof value === "number"
            ? new Intl.NumberFormat("en-US").format(value)
            : value;

    return (
        <Card className="m-2 flex flex-col">
            <CardContent className="flex flex-col justify-center m-2">
                <div>
                    {/* Title text (similar to MUI's "subtitle2") */}
                    <p className="mb-1 text-xs text-muted-foreground">{title}</p>

                    {/* Main Value (similar to MUI's "h5") */}
                    <h2
                        className="text-xl font-medium"
                        style={color !== "inherit" ? { color } : undefined}
                    >
                        {displayValue}
                    </h2>
                </div>

                {/* Optional subtitle */}
                {subtitle && (
                    <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                )}
            </CardContent>
        </Card>
    );
}
