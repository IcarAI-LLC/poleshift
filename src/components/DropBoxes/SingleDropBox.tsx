import React, { useCallback, useMemo, useState } from 'react';
import {Box, Typography, Tooltip, SelectChangeEvent, DialogTitle, Dialog, DialogContent, IconButton} from '@mui/material';
import {
    Add as AddIcon,
    CheckCircle as CheckCircleIcon,
    Lock as LockIcon,
    Search as SearchOutlinedIcon,
} from '@mui/icons-material';
import { open } from '@tauri-apps/plugin-dialog';

import ProgressTracker from './ProgressTracker';
import Modal from '../Modal';
import DataTable from '../DataTable';
import DataChart from '../DataChart';
import NutrientAmmoniaView from '../NutrientAmmoniaView';
import KrakenVisualization from '../KrakenVisualization/KrakenVisualization';

import { usePowerSync, useQuery } from '@powersync/react';
import { toCompilableQuery, wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import {
    processed_data_improved,
    processed_ctd_rbr_data_values,
    processed_nutrient_ammonia_data,
    processed_kraken_uniq_report,
} from '../../lib/powersync/DrizzleSchema';
import { and, desc, eq } from 'drizzle-orm';

import { useTauriDataProcessor } from '../../lib/hooks/useTauriDataProcessor';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

import type { DropboxConfigItem } from '../../config/dropboxConfig';
import { DataType, ProcessingState, ProcessedDataImproved } from '../../lib/types';
import type { SingleDropBoxProps, LocalModalState } from './types';
import CloseIcon from "@mui/icons-material/Close";

const SingleDropBox: React.FC<SingleDropBoxProps> = ({
                                                         configItem,
                                                         sampleGroup,
                                                         sampleLocation,
                                                         organization,
                                                         isLocked,
                                                         onError,
                                                     }) => {
    const { processNutrientAmmoniaData, processCtdData, processSequenceData } = useTauriDataProcessor();
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db);

    const [modalState, setModalState] = useState<LocalModalState>({
        isOpen: false,
        title: '',
        type: 'input', // or 'data'
        modalInputs: {},
        uploadedFiles: [],
        data: null,
    });

    const sampleId = sampleGroup.id;
    const dataType = configItem.id; // e.g. DataType.Sequence, DataType.CTD, etc.

    // 1) Query the processed_data_improved record for this dataType
    const metadataQuery = toCompilableQuery(
        drizzleDB
            .select()
            .from(processed_data_improved)
            .where(and(eq(processed_data_improved.sample_id, sampleId), eq(processed_data_improved.data_type, dataType)))
            .orderBy(desc(processed_data_improved.created_at))
            .limit(1)
    );

    const {
        data: processedDataImproved = [],
        isLoading: metadataIsLoading,
    } = useQuery(metadataQuery);

    // 2) We interpret if there's any existing data record
    const processedMetadataItem: ProcessedDataImproved | undefined =
        processedDataImproved && processedDataImproved.length > 0
            ? processedDataImproved[0]
            : undefined;

    console.debug('processedMetadataItem:', processedMetadataItem);

    const hasData = !!processedMetadataItem;
    const isProcessing = processedMetadataItem?.processing_state === ProcessingState.Processing;
    const progressMessage = processedMetadataItem?.status_message || '';
    const progressPercentage = processedMetadataItem?.progress_percentage || 0;

    // ------------------------------------------------------------------
    // File selection + uploading
    // ------------------------------------------------------------------

    const handleFileSelect = useCallback(async () => {
        if (isLocked) {
            onError('DropBox is locked.');
            return;
        }

        // If this config requires manual input (like NutrientAmmonia with lat/long), open the modal right away
        if (configItem.isModalInput && !isProcessing && !processedMetadataItem) {
            setModalState({
                isOpen: true,
                title: configItem.label,
                type: 'input',
                modalInputs: {
                    lat: sampleLocation?.lat?.toString() || '',
                    long: sampleLocation?.long?.toString() || '',
                },
                uploadedFiles: [],
                data: null,
            });
            return;
        }

        try {
            const selectedPaths = await open({
                multiple: configItem.acceptsMultipleFiles ?? false,
                directory: false,
                filters: configItem.expectedFileTypes
                    ? Object.entries(configItem.expectedFileTypes).map(([mime, extensions]) => ({
                        name: mime,
                        extensions: extensions.map((ext) => ext.replace('.', '')),
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

            // Depending on the dataType, call the appropriate Tauri processing
            switch (dataType) {
                case DataType.CTD:
                    await processCtdData(sampleId, filePaths);
                    break;
                case DataType.Sequence:
                    await processSequenceData(sampleId, filePaths);
                    break;
                case DataType.NutrientAmmonia:
                    // If user picks the file first (less common), we store them until final submission
                    setModalState((prev) => ({
                        ...prev,
                        isOpen: true,
                        title: configItem.label,
                        type: 'input',
                        uploadedFiles: filePaths,
                        modalInputs: {
                            lat: sampleLocation?.lat?.toString() || '',
                            long: sampleLocation?.long?.toString() || '',
                        },
                    }));
                    break;
                default:
                    // or do something else
                    break;
            }
        } catch (error: any) {
            console.error('File selection error:', error);
            onError(error.message || 'Failed to select files');
        }
    }, [
        isLocked,
        isProcessing,
        configItem,
        processedMetadataItem,
        sampleLocation,
        sampleId,
        dataType,
        organization,
        processCtdData,
        processSequenceData,
        onError,
    ]);

    // ------------------------------------------------------------------
    // Viewing existing data
    // ------------------------------------------------------------------

    const handleDataClick = useCallback(() => {
        console.log('Magnifying glass clicked!');

        // If there's no processed metadata, nothing to show
        if (!processedMetadataItem?.id) return;

        // We'll fetch the detailed data so we can display it in the Modal
        const fetchDetailedData = async () => {
            try {
                let detailedData = null;

                switch (dataType) {
                    case DataType.CTD: {
                        const ctdData = await drizzleDB
                            .select()
                            .from(processed_ctd_rbr_data_values)
                            .where(eq(processed_ctd_rbr_data_values.processed_data_id, processedMetadataItem.id));
                        console.log('Fetched CTD data:', ctdData);
                        detailedData = ctdData;
                        break;
                    }
                    case DataType.NutrientAmmonia: {
                        const ammoniaData = await drizzleDB
                            .select()
                            .from(processed_nutrient_ammonia_data)
                            .where(eq(processed_nutrient_ammonia_data.processed_data_id, processedMetadataItem.id));
                        console.log('Fetched Nutrient/Ammonia data:', ammoniaData);
                        detailedData = ammoniaData;
                        break;
                    }
                    case DataType.Sequence: {
                        const sequenceData = await drizzleDB
                            .select()
                            .from(processed_kraken_uniq_report)
                            .where(eq(processed_kraken_uniq_report.processed_data_id, processedMetadataItem.id));
                        console.log('Fetched Sequence data:', sequenceData);
                        detailedData = sequenceData;
                        break;
                    }
                    default:
                        return;
                }

                console.log('DetailedData after fetching:', detailedData);

                setModalState({
                    isOpen: true,
                    title: `Data for ${configItem.label}`,
                    type: 'data',
                    data: detailedData,
                    modalInputs: {},
                    uploadedFiles: [],
                });
            } catch (error) {
                console.error('Failed to fetch data for display:', error);
                onError('Failed to fetch data for display');
            }
        };

        fetchDetailedData();
    }, [configItem.label, dataType, processedMetadataItem?.id, drizzleDB, onError]);

    // ------------------------------------------------------------------
    // Modal form submission for "manual input" types
    // ------------------------------------------------------------------

    const handleModalChange = useCallback(
        (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
        ) => {
            const { name, value } = e.target as { name?: string; value: unknown };
            if (!name) return;

            setModalState((prev) => ({
                ...prev,
                modalInputs: {
                    ...prev.modalInputs,
                    [name]: typeof value === 'string' ? value : String(value),
                },
            }));
        },
        []
    );

    const closeModal = useCallback(() => {
        setModalState({
            isOpen: false,
            title: '',
            type: 'input',
            modalInputs: {},
            uploadedFiles: [],
            data: null,
        });
    }, []);

    const handleModalSubmit = useCallback(async () => {
        try {
            if (!modalState.modalInputs || !sampleGroup) return;

            switch (dataType) {
                case DataType.NutrientAmmonia:
                    // The user might have provided lat/long in the modal plus optional files
                    await processNutrientAmmoniaData(sampleGroup.id, modalState.modalInputs);
                    break;
                case DataType.CTD:
                    // If there's a reason to do it here, you can do so. Otherwise typically the file upload triggers processCtdData.
                    if (modalState.uploadedFiles.length > 0) {
                        await processCtdData(sampleGroup.id, modalState.uploadedFiles);
                    }
                    break;
                case DataType.Sequence:
                    if (modalState.uploadedFiles.length > 0) {
                        await processSequenceData(sampleGroup.id, modalState.uploadedFiles);
                    }
                    break;
                default:
                    break;
            }

            closeModal();
        } catch (error) {
            console.error('Error processing data:', error);
            onError('Failed to process uploaded data');
        }
    }, [
        dataType,
        modalState,
        sampleGroup,
        processNutrientAmmoniaData,
        processCtdData,
        processSequenceData,
        closeModal,
        onError,
    ]);

    // ------------------------------------------------------------------
    // Rendering the modal content (for "type: data")
    // ------------------------------------------------------------------
    const renderModalContent = () => {
        // If there's no data, return null
        if (!modalState.data) {
            console.log('No modalState.data found, returning null.');
            return null;
        }

        // Otherwise, decide which component to render
        switch (dataType) {
            case DataType.CTD:
                console.log('Rendering DataChart for CTD data...');
                return <DataChart data={modalState.data} />;
            case DataType.Sequence:
                return (
                    <KrakenVisualization
                        data={modalState.data}
                        open={modalState.isOpen}
                        onClose={closeModal}
                    />
                );
            case DataType.NutrientAmmonia:
                console.log('Rendering NutrientAmmoniaView for NutrientAmmonia data...');
                return <NutrientAmmoniaView data={modalState.data} />;
            default:
                console.log('Rendering DataTable for unhandled data type...');
                return <DataTable data={modalState.data} />;
        }
    };

    // ------------------------------------------------------------------
    // Tooltip + Icon
    // ------------------------------------------------------------------

    const tooltipTitle = useMemo(() => {
        if (isLocked && !hasData) {
            return 'Unable to perform this action, please contact your organization lead';
        }
        if (configItem.isModalInput && isProcessing) {
            return progressMessage;
        }
        if (hasData ) {
            return 'Click on the magnifying glass to view data';
        }
        if (!isLocked && !isProcessing) {
            return configItem.isModalInput ? 'Click to input data' : 'Click to select files';
        }
        return progressMessage;
    }, [isLocked, hasData, configItem.isModalInput, isProcessing, progressMessage]);

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
                            sx={{
                                color: 'text.secondary',
                                fontSize: 20,
                                cursor: 'pointer',
                            }}
                            // Stop the parent Box from also receiving this click
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDataClick();
                            }}
                        />
                    </Tooltip>
                </Box>
            );
        }
        // Default: Add icon
        return (
            <AddIcon
                sx={{
                    fontSize: 32,
                    color: 'text.primary',
                    opacity: isProcessing ? 0.5 : 1,
                    pointerEvents: isProcessing ? 'none' : 'auto',
                    transition: 'opacity 0.3s',
                }}
            />
        );
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
    console.log('Modal render attempt:', {
        isOpen: modalState.isOpen,
        type: modalState.type,
        hasData: !!modalState.data,
        dataType,
        content: renderModalContent()
    });
// Update the render section of SingleDropBox
    return (
        <>
            <Tooltip title={tooltipTitle} arrow>
                <Box onClick={handleFileSelect} sx={boxStyles}>
                    <Typography
                        variant="h6"
                        sx={{
                            mb: 1,
                            color: isLocked && !hasData ? 'text.disabled' : 'text.primary',
                        }}
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

            {/* Input Modal - show for any data type when type is 'input' */}
            {modalState.isOpen && modalState.type === 'input' && (
                <Modal
                    isOpen={modalState.isOpen}
                    title={modalState.title}
                    onClose={closeModal}
                    modalFields={configItem.modalFields}
                    modalInputs={modalState.modalInputs}
                    handleModalChange={handleModalChange}
                    handleModalSubmit={handleModalSubmit}
                />
            )}

            {/* Render KrakenVisualization separately */}
            {modalState.isOpen &&
                modalState.type === 'data' &&
                dataType === DataType.Sequence && (
                    <KrakenVisualization
                        data={modalState.data}
                        open={modalState.isOpen}
                        onClose={closeModal}
                    />
                )}

            {/* Render DataChart for CTD separately */}
            {modalState.isOpen &&
                modalState.type === 'data' &&
                dataType === DataType.CTD && (
                    <Dialog
                        open={modalState.isOpen}
                        onClose={closeModal}
                        fullWidth
                        maxWidth="lg"
                    >
                        <DialogTitle>
                            {modalState.title}
                            <IconButton
                                onClick={closeModal}
                                sx={{
                                    position: 'absolute',
                                    right: 8,
                                    top: 8
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <DataChart data={modalState.data} />
                        </DialogContent>
                    </Dialog>
                )}

            {/* Render NutrientAmmoniaView separately */}
            {modalState.isOpen &&
                modalState.type === 'data' &&
                dataType === DataType.NutrientAmmonia && (
                    <Dialog
                        open={modalState.isOpen}
                        onClose={closeModal}
                        fullWidth
                        maxWidth="md"
                    >
                        <DialogTitle>
                            {modalState.title}
                            <IconButton
                                onClick={closeModal}
                                sx={{
                                    position: 'absolute',
                                    right: 8,
                                    top: 8
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <NutrientAmmoniaView data={modalState.data} />
                        </DialogContent>
                    </Dialog>
                )}

            {/* Render Modal for other data types when displaying data */}
            {modalState.isOpen &&
                modalState.type === 'data' &&
                dataType !== DataType.Sequence &&
                dataType !== DataType.CTD &&
                dataType !== DataType.NutrientAmmonia && (
                    <Modal
                        isOpen={modalState.isOpen}
                        title={modalState.title}
                        onClose={closeModal}
                        modalFields={configItem.modalFields}
                        modalInputs={modalState.modalInputs}
                        handleModalChange={handleModalChange}
                        handleModalSubmit={handleModalSubmit}
                    >
                        {renderModalContent()}
                    </Modal>
                )}
        </>
    );
};

export default React.memo(SingleDropBox);
