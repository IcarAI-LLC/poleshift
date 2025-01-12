// If you’re using shadcn UI or Radix, adjust these accordingly:
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from "@/components/ui/tooltip";
import { useResourceDownloadContext } from "@/stores/ResourceDownloadContext";
import { Download } from "lucide-react";

export function ResourceDownloadIndicator() {
    const { isDownloading, downloads } = useResourceDownloadContext();

    // If no downloads are in progress, don’t render anything at all
    if (!isDownloading) {
        return null;
    }

    // Optionally, compute an overall total:
    const totalBytes = downloads.reduce((sum, d) => sum + (d.total || 0), 0);
    const totalProgress = downloads.reduce((sum, d) => sum + (d.progress || 0), 0);

    // For the tooltip, we might list each file’s progress individually:
    const tooltipText = downloads
        .map((d) => {
            const percent = d.total > 0 ? ((d.progress / d.total) * 100).toFixed(1) : "??";
            return `${d.fileName}: ${d.progress} / ${d.total} bytes (${percent}%) @ ${
                d.transferSpeed
            } B/s`;
        })
        .join("\n");

    // Or you can just show an aggregated progress if you prefer
    const aggregatedPercent =
        totalBytes > 0 ? ((totalProgress / totalBytes) * 100).toFixed(1) : "0";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="ml-2 flex items-center">
                        {/* Icon or small spinner */}
                        <Download className="h-4 w-4 animate-bounce" />
                        {/* A small text indicating overall progress */}
                        <span className="ml-1 text-xs font-medium">
              {aggregatedPercent}%
            </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="whitespace-pre">
                    {tooltipText}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
