import { useCallback, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, CheckCircle2, Lock, Search } from "lucide-react";

import ProgressTracker from "./ProgressTracker.tsx"; // Replace MUI references with custom ShadCN logic
import DataChart from "../DataChart.tsx";
import NutrientAmmoniaView from "./NutrientAmmoniaView.tsx";
import KrakenVisualization from "../KrakenVisualization/KrakenVisualization.tsx";
import NutrientAmmoniaInput from "@/components/SampleGroupView/NutrientAmmoniaInput.tsx";

import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip.tsx";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
    DataType,
    ProcessingState,
    processed_data_improved,
    processed_ctd_rbr_data_values,
    processed_nutrient_ammonia_data,
    processed_kraken_uniq_report,
} from "@/lib/powersync/DrizzleSchema.ts";

import { useTauriDataProcessor } from "@/hooks/useTauriDataProcessor.ts";
import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { usePowerSync, useQuery } from "@powersync/react";
import {eq, desc, and} from "drizzle-orm";
import { toCompilableQuery } from "@powersync/drizzle-driver";

import {
    Organizations,
    ProcessedDataImproved,
    SampleGroupMetadata,
    DetailedData,
} from "src/types";
import { DropboxConfigItem } from "@/config/dropboxConfig.ts";

export interface SingleDropBoxProps {
    configItem: DropboxConfigItem;
    sampleGroup: SampleGroupMetadata;
    organization: Organizations | null;
    isLocked: boolean;
    onError: (message: string) => void;
}

export default function SingleDropBox({
                                          configItem,
                                          sampleGroup,
                                          organization,
                                          isLocked,
                                          onError,
                                      }: SingleDropBoxProps) {
    const { processNutrientAmmoniaData, processCtdData, processSequenceData } =
        useTauriDataProcessor();
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db);

    // For ammonia input
    const [ammoniaDialogOpen, setAmmoniaDialogOpen] = useState(false);
    const [isAmmoniaProcessing, setIsAmmoniaProcessing] = useState(false);

    // For data viewer
    const [dataDialogOpen, setDataDialogOpen] = useState(false);
    const [dataTitle, setDataTitle] = useState("");
    const [detailedData, setDetailedData] = useState<DetailedData | null>(null);

    const sampleId = sampleGroup.id;
    const dataType = configItem.id;

    // 1) Query for existing processed data
    const metadataQuery = toCompilableQuery(
        drizzleDB
            .select()
            .from(processed_data_improved)
            .where(
                and(
                    eq(processed_data_improved.sample_id, sampleId),
                    eq(processed_data_improved.data_type, dataType)
                )
            )
            .orderBy(desc(processed_data_improved.created_at))
            .limit(1)
    );
    const { data: processedDataImproved = [] } = useQuery(metadataQuery);

    const processedMetadataItem: ProcessedDataImproved | undefined =
        processedDataImproved.length > 0 ? processedDataImproved[0] : undefined;

    const hasData =
        !!processedMetadataItem &&
        processedMetadataItem.processing_state !== ProcessingState.Processing &&
        processedMetadataItem.processing_state !== ProcessingState.Saving;

    const isProcessing =
        processedMetadataItem?.processing_state === ProcessingState.Processing ||
        processedMetadataItem?.processing_state === ProcessingState.Saving;

    const progressMessage = processedMetadataItem?.status_message || "";
    const progressPercentage = processedMetadataItem?.progress_percentage || 0;

    // ---------- File selection + uploading ----------
    const handleFileSelect = useCallback(async () => {
        if (isLocked) {
            onError("DropBox is locked.");
            return;
        }
        // If ammonia & no existing record, open custom ammonia input
        if (
            dataType === DataType.NutrientAmmonia &&
            !isProcessing &&
            !processedMetadataItem
        ) {
            setAmmoniaDialogOpen(true);
            return;
        }
        const selectedPaths = await open({
            multiple: configItem.acceptsMultipleFiles ?? false,
            directory: false,
            filters: configItem.expectedFileTypes
                ? Object.entries(configItem.expectedFileTypes).map(([mime, exts]) => ({
                    name: mime,
                    extensions: exts.map((ext) => ext.replace(".", "")),
                }))
                : undefined,
        });

        if (!selectedPaths) return;
        const filePaths = Array.isArray(selectedPaths)
            ? selectedPaths
            : [selectedPaths];
        if (filePaths.length === 0) {
            onError("No files were selected.");
            return;
        }
        if (!organization) {
            onError("No organization found for user.");
            return;
        }

        switch (dataType) {
            case DataType.CTD: {
                await processCtdData(sampleId, filePaths);
                break;
            }
            case DataType.Sequence: {
                await processSequenceData(sampleId, filePaths);
                break;
            }
            default:
                break;
        }
    }, [
        isLocked,
        isProcessing,
        dataType,
        configItem,
        processedMetadataItem,
        sampleId,
        organization,
        processCtdData,
        processSequenceData,
        onError,
    ]);

    // ---------- Nutrient Ammonia submission ----------
    const handleAmmoniaSubmit = useCallback(
        async (ammoniaValue: number) => {
            try {
                setIsAmmoniaProcessing(true);
                await processNutrientAmmoniaData(sampleGroup.id, ammoniaValue);
                setAmmoniaDialogOpen(false);
            } catch (error) {
                console.error("Failed to process ammonia data:", error);
                onError("Failed to process ammonia data");
            } finally {
                setIsAmmoniaProcessing(false);
            }
        },
        [onError, processNutrientAmmoniaData, sampleGroup.id]
    );

    // ---------- Viewing existing data ----------
    const handleDataClick = useCallback(() => {
        if (!processedMetadataItem?.id) return;

        const fetchDetailedData = async () => {
            try {
                let fetchedData: DetailedData | null = null;
                switch (dataType) {
                    case DataType.CTD: {
                        const ctdData = await drizzleDB
                            .select()
                            .from(processed_ctd_rbr_data_values)
                            .where(eq(processed_ctd_rbr_data_values.processed_data_id, processedMetadataItem.id));
                        fetchedData = { dataType: DataType.CTD, data: ctdData };
                        break;
                    }
                    case DataType.NutrientAmmonia: {
                        const ammoniaData = await drizzleDB
                            .select()
                            .from(processed_nutrient_ammonia_data)
                            .where(eq(processed_nutrient_ammonia_data.processed_data_id, processedMetadataItem.id));
                        fetchedData = { dataType: DataType.NutrientAmmonia, data: ammoniaData };
                        break;
                    }
                    case DataType.Sequence: {
                        const sequenceData = await drizzleDB
                            .select()
                            .from(processed_kraken_uniq_report)
                            .where(eq(processed_kraken_uniq_report.processed_data_id, processedMetadataItem.id));
                        fetchedData = { dataType: DataType.Sequence, data: sequenceData };
                        break;
                    }
                    default:
                        break;
                }

                if (fetchedData) {
                    setDataTitle(`${configItem.label}`);
                    setDetailedData(fetchedData);
                    setDataDialogOpen(true);
                }
            } catch (error) {
                console.error("Failed to fetch data for display:", error);
                onError("Failed to fetch data for display");
            }
        };

        fetchDetailedData();
    }, [
        dataType,
        processedMetadataItem?.id,
        drizzleDB,
        configItem.label,
        onError,
    ]);

    // Data viewer with type narrowing
    function renderDataViewer() {
        if (!detailedData) return null;

        switch (detailedData.dataType) {
            case DataType.CTD:
                return <DataChart data={detailedData.data} />;
            case DataType.Sequence:
                return (
                    <KrakenVisualization
                        data={detailedData.data}
                        open={dataDialogOpen}
                        onClose={() => setDataDialogOpen(false)}
                    />
                );
            case DataType.NutrientAmmonia:
                return <NutrientAmmoniaView data={detailedData.data} />;
            default:
                return null;
        }
    }

    // Tooltip text
    const tooltipTitle = useMemo(() => {
        if (isLocked && !hasData) {
            return "Unable to perform this action, please contact your organization lead";
        }
        if (isProcessing) {
            return progressMessage;
        }
        if (hasData) {
            return "Click the magnifying glass to view data";
        }
        return configItem.isModalInput
            ? "Click to input data"
            : "Click to select files";
    }, [isLocked, hasData, isProcessing, progressMessage, configItem.isModalInput]);

    // Icon logic
    const IconComponent = useMemo(() => {
        if (isLocked && !hasData) {
            return <Lock className="h-8 w-8 text-muted-foreground" />;
        }
        if (isProcessing) {
            return (
                <ProgressTracker
                    progress={progressPercentage}
                    status={progressMessage}
                    showPercentage
                    type="processing"
                />
            );
        }
        if (hasData) {
            return (
                <div className="flex items-center gap-2 mt-1">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <Tooltip>
                        <TooltipTrigger
                            asChild
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDataClick();
                            }}
                        >
                            <Search className="h-5 w-5 cursor-pointer text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>View Data</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            );
        }
        // Default add icon
        return <Plus className="h-8 w-8 text-foreground" />;
    }, [isLocked, hasData, isProcessing, progressMessage, progressPercentage, handleDataClick]);

    return (
        <div>
            <Tooltip>
                <TooltipTrigger
                    onClick={handleFileSelect}
                    disabled={isLocked && !hasData}
                    className={`
                        grid
                        w-full
                        h-72
                        grid-cols-3
                        gap-3
                        place-items-center
                        border-2 border-dashed
                        transition-all
                        text-center
                        rounded
                        p-2
                        ${
                        isLocked && !hasData
                            ? "opacity-60 cursor-not-allowed"
                            : "cursor-pointer"
                    }
                    `}
                >
                    {/* Label: full width => col-span-3 */}
                    <p
                        className={`col-span-3 text-lg font-semibold mb-2 ${
                            isLocked && !hasData ? "text-gray-500" : ""
                        }`}
                    >
                        {configItem.label}
                    </p>

                    {/* Expected file types => full width => col-span-3 */}
                    {configItem.expectedFileTypes && (
                        <p className="col-span-3 text-sm text-muted-foreground mb-2">
                            {Object.values(configItem.expectedFileTypes).flat().join(", ")}
                        </p>
                    )}

                    {/* Main icon => col-span-3 */}
                    <div className="col-span-3">{IconComponent}</div>

                    {/* Additional tooltip => col-span-3 */}
                    {configItem.tooltip && (
                        <p className="col-span-3 mt-2 text-xs text-muted-foreground">
                            {configItem.tooltip}
                        </p>
                    )}
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltipTitle}</p>
                </TooltipContent>
            </Tooltip>

            {/* Nutrient Ammonia Input Dialog */}
            <NutrientAmmoniaInput
                open={ammoniaDialogOpen}
                onClose={() => setAmmoniaDialogOpen(false)}
                onSubmit={handleAmmoniaSubmit}
                isProcessing={isAmmoniaProcessing}
            />

            {/* If dataType !== Sequence, show a standard ShadCN Dialog */}
            {dataDialogOpen && detailedData?.dataType !== DataType.Sequence && (
                <Dialog open={dataDialogOpen} onOpenChange={setDataDialogOpen}>
                    <DialogContent className="md:max-w-fit md:max-h-fit">
                        <DialogHeader>
                            <DialogTitle>{dataTitle}</DialogTitle>
                        </DialogHeader>
                        <div className="mt-2">{renderDataViewer()}</div>
                    </DialogContent>
                </Dialog>
            )}

            {/* If dataType === Sequence, rely on KrakenVisualization's internal dialog logic */}
            {dataDialogOpen && detailedData?.dataType === DataType.Sequence && (
                <KrakenVisualization
                    data={detailedData.data}
                    open={dataDialogOpen}
                    onClose={() => setDataDialogOpen(false)}
                />
            )}
        </div>
    )
}