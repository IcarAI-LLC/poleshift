// src/renderer/components/DropBoxes/SingleDropBox.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
    Box,
    Typography,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
} from '@mui/material';
import {
    Add as AddIcon,
    CheckCircle as CheckCircleIcon,
    Lock as LockIcon,
    Search as SearchOutlinedIcon,
} from '@mui/icons-material';
import { open } from '@tauri-apps/plugin-dialog';

import ProgressTracker from './ProgressTracker.tsx';
import DataChart from '../../DataChart.tsx';
import NutrientAmmoniaView from '../../NutrientAmmoniaView.tsx';
import KrakenVisualization from '../../KrakenVisualization/KrakenVisualization.tsx';

// Import your new dedicated ammonia input component
import NutrientAmmoniaInput from './ModalInputs/NutrientAmmoniaInput.tsx';

import { usePowerSync, useQuery } from '@powersync/react';
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import {
    processed_data_improved,
    processed_ctd_rbr_data_values,
    processed_nutrient_ammonia_data,
    processed_kraken_uniq_report, ProcessingState, DataType,
} from '@/lib/powersync/DrizzleSchema.ts';
import { and, desc, eq } from 'drizzle-orm';

import { useTauriDataProcessor } from '@/lib/hooks/useTauriDataProcessor.ts';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

import { ProcessedDataImproved } from '@/lib/types';
import type { SingleDropBoxProps } from './types.ts';
import CloseIcon from '@mui/icons-material/Close';

const SingleDropBox: React.FC<SingleDropBoxProps> = ({
                                                         configItem,
                                                         sampleGroup,
                                                         organization,
                                                         isLocked,
                                                         onError,
                                                     }) => {
    const { processNutrientAmmoniaData, processCtdData, processSequenceData } = useTauriDataProcessor();
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db);

    // -- For ammonia input
    const [ammoniaDialogOpen, setAmmoniaDialogOpen] = useState(false);
    const [isAmmoniaProcessing, setIsAmmoniaProcessing] = useState(false);

    // -- For data viewing
    const [dataDialogOpen, setDataDialogOpen] = useState(false);
    const [dataTitle, setDataTitle] = useState('');
    const [detailedData, setDetailedData] = useState<any[]>([]);

    const sampleId = sampleGroup.id;
    const dataType = configItem.id; // e.g. DataType.Sequence, DataType.CTD, DataType.NutrientAmmonia, etc.

    // 1) Query the processed_data_improved record for this dataType
    const metadataQuery = toCompilableQuery(
        drizzleDB
            .select()
            .from(processed_data_improved)
            .where(and(eq(processed_data_improved.sample_id, sampleId), eq(processed_data_improved.data_type, dataType)))
            .orderBy(desc(processed_data_improved.created_at))
            .limit(1)
    );

    const { data: processedDataImproved = [] } = useQuery(metadataQuery);

    // 2) Check if any existing data record
    const processedMetadataItem: ProcessedDataImproved | undefined =
        processedDataImproved.length > 0 ? processedDataImproved[0] : undefined;

    const hasData = !!processedMetadataItem && processedMetadataItem.processing_state !== ProcessingState.Processing && processedMetadataItem.processing_state !== ProcessingState.Saving;
    const isProcessing = processedMetadataItem?.processing_state === ProcessingState.Processing || processedMetadataItem?.processing_state === ProcessingState.Saving;
    const progressMessage = processedMetadataItem?.status_message || '';
    const progressPercentage = processedMetadataItem?.progress_percentage || 0;

    // ------------------------------------------------------------------
    // File selection + uploading (CTD, Sequence, or if we had file-based ammonia)
    // ------------------------------------------------------------------
    const handleFileSelect = useCallback(async () => {
        if (isLocked) {
            onError('DropBox is locked.');
            return;
        }

        // For ammonia, we want to open our new ammonia input if no data yet:
        if (dataType === DataType.NutrientAmmonia && !isProcessing && !processedMetadataItem) {
            setAmmoniaDialogOpen(true);
            return;
        }

        try {
            // Otherwise, handle file selection
            const selectedPaths = await open({
                multiple: configItem.acceptsMultipleFiles ?? false,
                directory: false,
                filters: configItem.expectedFileTypes
                    ? Object.entries(configItem.expectedFileTypes).map(([mime, exts]) => ({
                        name: mime,
                        extensions: exts.map((ext) => ext.replace('.', '')),
                    }))
                    : undefined,
            });

            if (!selectedPaths) return;

            const filePaths = Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths];
            if (filePaths.length === 0) {
                onError('No files were selected.');
                return;
            }
            if (!organization) {
                onError('No organization found for user.');
                return;
            }

            // Depending on the dataType, call the Tauri side
            switch (dataType) {
                case DataType.CTD:
                    await processCtdData(sampleId, filePaths);
                    break;
                case DataType.Sequence:
                    await processSequenceData(sampleId, filePaths);
                    break;
                // NutrientAmmonia typically doesn't need filePaths (unless your code requires them).
                // If so, handle it here as well.
                default:
                    break;
            }
        } catch (error: any) {
            console.error('File selection error:', error);
            onError(error.message || 'Failed to select files');
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

    // ------------------------------------------------------------------
    // NutrientAmmonia: handle user-submitted ammoniaValue
    // ------------------------------------------------------------------
    const handleAmmoniaSubmit = useCallback(
        async (ammoniaValue: number) => {
            try {
                setIsAmmoniaProcessing(true);
                await processNutrientAmmoniaData(sampleGroup.id, ammoniaValue);
                setAmmoniaDialogOpen(false);
            } catch (error) {
                console.error('Failed to process ammonia data:', error);
                onError('Failed to process ammonia data');
            } finally {
                setIsAmmoniaProcessing(false);
            }
        },
        [onError, processNutrientAmmoniaData, sampleGroup.id]
    );

    // ------------------------------------------------------------------
    // Viewing existing data
    // ------------------------------------------------------------------
    const handleDataClick = useCallback(() => {
        if (!processedMetadataItem?.id) return;

        const fetchDetailedData = async () => {
            try {
                let fetchedData: any[] = [];

                switch (dataType) {
                    case DataType.CTD:
                        fetchedData = await drizzleDB
                            .select()
                            .from(processed_ctd_rbr_data_values)
                            .where(eq(processed_ctd_rbr_data_values.processed_data_id, processedMetadataItem.id));
                        break;
                    case DataType.NutrientAmmonia:
                        fetchedData = await drizzleDB
                            .select()
                            .from(processed_nutrient_ammonia_data)
                            .where(eq(processed_nutrient_ammonia_data.processed_data_id, processedMetadataItem.id));
                        break;
                    case DataType.Sequence:
                        fetchedData = await drizzleDB
                            .select()
                            .from(processed_kraken_uniq_report)
                            .where(eq(processed_kraken_uniq_report.processed_data_id, processedMetadataItem.id));
                        break;
                    default:
                        // If you have other data types, handle them or show a default
                        break;
                }

                setDataTitle(`${configItem.label}`);
                setDetailedData(fetchedData);
                setDataDialogOpen(true);
            } catch (error) {
                console.error('Failed to fetch data for display:', error);
                onError('Failed to fetch data for display');
            }
        };

        fetchDetailedData();
    }, [dataType, processedMetadataItem?.id, drizzleDB, configItem.label, onError]);

    // ------------------------------------------------------------------
    // Decide what component to show in the data dialog
    // ------------------------------------------------------------------
    const renderDataViewer = () => {
        if (!detailedData || detailedData.length === 0) return null;

        switch (dataType) {
            case DataType.CTD:
                return <DataChart data={detailedData} />;
            case DataType.Sequence:
                return (
                    <KrakenVisualization
                        data={detailedData}
                        open={dataDialogOpen}
                        onClose={() => setDataDialogOpen(false)}
                    />
                );
            case DataType.NutrientAmmonia:
                return <NutrientAmmoniaView data={detailedData} />;
        }
    };

    // ------------------------------------------------------------------
    // Tooltip + Icon
    // ------------------------------------------------------------------
    const tooltipTitle = useMemo(() => {
        if (isLocked && !hasData) {
            return 'Unable to perform this action, please contact your organization lead';
        }
        if (isProcessing) {
            return progressMessage;
        }
        if (hasData) {
            return 'Click on the magnifying glass to view data';
        }
        // No data, not locked, not processing
        return configItem.isModalInput ? 'Click to input data' : 'Click to select files';
    }, [isLocked, hasData, isProcessing, progressMessage, configItem.isModalInput]);

    const IconComponent = useMemo(() => {
        if (isLocked && !hasData) {
            return <LockIcon sx={{ fontSize: 32, color: 'text.disabled' }} />;
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32 }} />
                    <Tooltip title="View Data" arrow>
                        <SearchOutlinedIcon
                            sx={{ color: 'text.secondary', fontSize: 20, cursor: 'pointer' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDataClick();
                            }}
                        />
                    </Tooltip>
                </Box>
            );
        }
        // Default icon if no data
        return <AddIcon sx={{ fontSize: 32, color: 'text.primary' }} />;
    }, [isLocked, hasData, isProcessing, progressMessage, progressPercentage, handleDataClick]);

    // ------------------------------------------------------------------
    // Overall DropBox box styling
    // ------------------------------------------------------------------
    const boxStyles = useMemo<SxProps<Theme>>(
        () => ({
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '300px',
            minHeight: '200px',
            boxSizing: 'border-box',
            position: 'relative',
            border: '2px dashed',
            borderColor: isLocked && !hasData ? 'grey.800' : 'grey.300',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            pointerEvents: isLocked && !hasData ? 'none' : 'auto',
            cursor: isLocked && !hasData ? 'not-allowed' : 'pointer',
            backgroundColor: isLocked && !hasData ? 'grey.800' : 'background.paper',
            transition: 'all 0.3s ease',
            opacity: isProcessing || (isLocked && !hasData) ? 0.6 : 1,
            '&:hover': {
                borderColor: isLocked && !hasData ? 'grey.800' : 'primary.main',
                backgroundColor: isLocked && !hasData ? 'grey.800' : 'action.hover',
            },
        }),
        [isLocked, hasData, isProcessing]
    );

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <>
            <Tooltip title={tooltipTitle} arrow>
                <Box onClick={handleFileSelect} sx={boxStyles}>
                    <Typography
                        variant="h6"
                        sx={{ mb: 1, color: isLocked && !hasData ? 'text.disabled' : 'text.primary' }}
                    >
                        {configItem.label}
                    </Typography>

                    {configItem.expectedFileTypes && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                            {Object.values(configItem.expectedFileTypes).flat().join(', ')}
                        </Typography>
                    )}

                    {IconComponent}

                    {configItem.tooltip && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
                            {configItem.tooltip}
                        </Typography>
                    )}
                </Box>
            </Tooltip>

            {/* --- Nutrient Ammonia Input Dialog --- */}
            <NutrientAmmoniaInput
                open={ammoniaDialogOpen}
                onClose={() => setAmmoniaDialogOpen(false)}
                onSubmit={handleAmmoniaSubmit}
                isProcessing={isAmmoniaProcessing}
            />

            {/* --- Data Viewer (for CTD / Sequence / Ammonia / Other) --- */}
            {dataDialogOpen && dataType !== DataType.Sequence && (
                <Dialog
                    open={dataDialogOpen}
                    onClose={() => setDataDialogOpen(false)}
                    fullWidth
                    maxWidth={dataType === DataType.CTD ? 'lg' : 'md'}
                >
                    <DialogTitle>
                        {dataTitle}
                        <IconButton
                            onClick={() => setDataDialogOpen(false)}
                            sx={{ position: 'absolute', right: 8, top: 8 }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent>{renderDataViewer()}</DialogContent>
                </Dialog>
            )}

            {/* Sequence has a custom KrakenVisualization which is also a Dialog, so we handle it differently */}
            {dataDialogOpen && dataType === DataType.Sequence && (
                <KrakenVisualization
                    data={detailedData}
                    open={dataDialogOpen}
                    onClose={() => setDataDialogOpen(false)}
                />
            )}
        </>
    );
};

export default React.memo(SingleDropBox);
