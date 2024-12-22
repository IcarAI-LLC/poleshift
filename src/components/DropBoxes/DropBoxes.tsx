// src/lib/components/DropBoxes.tsx

import React, { useCallback, useMemo, useState } from 'react';
import { Box, SelectChangeEvent, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

import { useAuth, useData, useProcessedData, useStorage, useUI } from '../../lib/hooks';
import {
    FileNodeType,
    ModalState as UIModalState,
    SampleGroupMetadata,
    SampleLocation,
} from '../../lib/types';
import { Permissions } from '../../lib/types'; // <--- Import your Permissions enum or constant
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import dropboxConfig from '../../config/dropboxConfig';
import { processCTDDataForModal, processKrakenDataForModal } from '../../lib/utils';
import Modal from '../Modal';
import DataTable from '../DataTable';
import DataChart from '../DataChart';
import DropBox from './DropBox';
import NutrientAmmoniaView from '../NutrientAmmoniaView';
import KrakenVisualization from '../KrakenVisualization/KrakenVisualization';
import { useAuthStore } from '../../lib/stores/authStore';

interface ProcessedModalData {
    modalData: any;
    units?: Record<string, string>;
}

interface DropBoxesProps {
    onError: (message: string) => void;
}

interface LocalModalState extends UIModalState {
    uploadedFiles?: string[];
    units?: Record<string, string>;
}

const DropBoxes: React.FC<DropBoxesProps> = ({ onError }) => {
    const { selectedLeftItem } = useUI();
    const { sampleGroups, getLocationById } = useData();
    const { organization } = useAuth(); // Make sure this returns userPermissions
    const { uploadFiles } = useStorage();
    const { userPermissions } = useAuthStore.getState();

    /**
     * 1. Check if the user has ModifySampleGroup permission
     */
    const hasModifyPermission = userPermissions?.includes(Permissions.ModifySampleGroup);

    /**
     * Identify the currently selected sample group and location
     */
    const { sampleGroup, sampleLocation } = useMemo<{
        sampleGroup: SampleGroupMetadata | null;
        sampleLocation: SampleLocation | null;
    }>(() => {
        const sampleGroupId =
            selectedLeftItem?.type === FileNodeType.SampleGroup ? selectedLeftItem.id : null;
        const currentSampleGroup = sampleGroupId ? sampleGroups[sampleGroupId] : null;
        const location = getLocationById(currentSampleGroup?.loc_id || null);

        return {
            sampleGroup: currentSampleGroup,
            sampleLocation: location,
        };
    }, [selectedLeftItem, sampleGroups, getLocationById]);

    /**
     * Setup processedData, processData, and related hooks
     */
    const {
        processData,
        processedData,
        isProcessing,
        getProgressState,
        getUploadDownloadProgressState,
        handleRawUploadAndProcess,
    } = useProcessedData({
        sampleGroup,
        orgShortId: organization?.org_short_id,
        orgId: organization?.id,
        organization,
        storage: useStorage(),
    });

    const [modalState, setModalState] = useState<LocalModalState>({
        isOpen: false,
        title: '',
        type: 'input',
        modalInputs: {},
    });

    const getProgressKey = useCallback((sampleId: string, configId: string): string => {
        return `${sampleId}:${configId}`;
    }, []);

    /**
     * Helper to process data for modals, based on configItem
     */
    const processModalData = useCallback(
        async (dataItem: any, configItem: DropboxConfigItem): Promise<ProcessedModalData> => {
            switch (configItem.id) {
                case 'ctd_data': {
                    // The raw data is in data.report
                    dataItem = dataItem.data.report;
                    const { processedData, variableUnits } = processCTDDataForModal(dataItem);
                    return {
                        modalData: processedData,
                        units: variableUnits,
                    };
                }
                case 'nutrient_ammonia': {
                    dataItem = dataItem.data.report;
                    return {
                        modalData: dataItem,
                    };
                }
                case 'sequencing_data': {
                    console.log('Sequence data', dataItem.data.report.report_content);
                    dataItem = dataItem.data.report.report_content;
                    return {
                        modalData: processKrakenDataForModal(dataItem),
                    };
                }
                default: {
                    // For any other data type, just return the data as-is
                    return {
                        modalData: dataItem.data || dataItem,
                    };
                }
            }
        },
        []
    );

    /**
     * Open a modal that expects user input
     */
    const openModal = useCallback(
        (title: string, configItem: DropboxConfigItem, uploadedFiles: string[] = []) => {
            if (!configItem.modalFields?.length) return;

            setModalState({
                isOpen: true,
                title,
                type: 'input',
                configItem: {
                    ...configItem,
                    modalFields: [...configItem.modalFields],
                },
                modalInputs: {
                    lat: sampleLocation?.lat?.toString() || '',
                    long: sampleLocation?.long?.toString() || '',
                },
                uploadedFiles,
            });
        },
        [sampleLocation]
    );

    /**
     * Open a modal to display existing data
     */
    const openDataModal = useCallback(
        async (title: string, dataItem: any, configItem: DropboxConfigItem) => {
            if (!dataItem) return;

            try {
                const { modalData, units } = await processModalData(dataItem, configItem);

                setModalState({
                    isOpen: true,
                    title: `Data for ${title}`,
                    type: 'data',
                    data: modalData,
                    configItem,
                    units,
                });
            } catch (error) {
                console.error('Error processing modal data:', error);
                onError('Failed to process data for display');
            }
        },
        [onError, processModalData]
    );

    /**
     * Close the modal
     */
    const closeModal = useCallback(() => {
        setModalState({
            isOpen: false,
            title: '',
            type: 'input',
            configItem: undefined,
            modalInputs: {},
            uploadedFiles: [],
            data: null,
            units: undefined,
        });
    }, []);

    /**
     * Handle user input changes in the modal
     */
    const handleModalChange = useCallback(
        (
            e:
                | React.ChangeEvent<HTMLTextAreaElement>
                | React.ChangeEvent<{ name?: string; value: unknown }>
                | SelectChangeEvent
        ) => {
            const { name, value } = e.target;
            if (typeof name === 'string') {
                setModalState((prevState) => ({
                    ...prevState,
                    modalInputs: {
                        ...prevState.modalInputs,
                        [name]: typeof value === 'string' ? value : String(value),
                    },
                }));
            }
        },
        []
    );

    /**
     * Handle submission (i.e. user hitting "Save" or "Submit") in the modal
     */
    const handleModalSubmit = useCallback(async () => {
        const { configItem, modalInputs } = modalState;
        if (!configItem || !sampleGroup || !organization?.org_short_id || !modalInputs) return;

        try {
            // 1) Create a JSON file from the modal inputs
            const fileName = `${configItem.id}_${Date.now()}.json`;
            const fileContent = JSON.stringify(modalInputs, null, 2);
            const file = new File([fileContent], fileName, { type: 'application/json' });

            // 2) Upload the file to the 'raw-data' bucket
            const basePath = `${organization.org_short_id}/${sampleGroup.id}`;
            const uploadedRawPaths = await uploadFiles([file], basePath, 'raw-data', (progress) => {
                console.log('Raw input upload progress:', progress);
            });

            // 3) Process the data (calls your processing function on the backend)
            await processData(
                configItem.processFunctionName,
                sampleGroup,
                modalInputs,
                [],
                configItem,
                uploadedRawPaths
            );

            closeModal();
        } catch (error) {
            console.error('Error processing data:', error);
            onError('Failed to process uploaded data');
        }
    }, [
        modalState,
        sampleGroup,
        processData,
        onError,
        closeModal,
        organization?.org_short_id,
        organization?.id,
        uploadFiles,
    ]);

    /**
     * The styles for each DropBox container
     */
    const boxStyles = useMemo((): SxProps<Theme> => {
        return {
            width: {
                xs: '100%',
                sm: 'calc(50% - var(--spacing-md))',
                md: 'calc(33.333% - var(--spacing-md))',
            },
        };
    }, []);

    /**
     * Render each DropBox. We lock a DropBox if:
     * - The user does NOT have the ModifySampleGroup permission
     *   OR
     * - Data is already present for that config
     */
    const renderedDropBoxes = useMemo(() => {
        if (!sampleGroup) {
            return (
                <Typography
                    variant="body1"
                    sx={{
                        color: 'text.secondary',
                        textAlign: 'center',
                        width: '100%',
                        padding: 2,
                    }}
                >
                    Please select a sample group to view DropBoxes.
                </Typography>
            );
        }

        return dropboxConfig
            .filter((configItem) => configItem?.isEnabled)
            .map((configItem) => {
                const sampleId = sampleGroup.id;
                const configId = configItem.id;
                const key = getProgressKey(sampleId, configId);

                // Check if data already exists
                const hasData = !!processedData[key];

                // Lock if no permission or if data is already there
                const isLocked = !hasModifyPermission || hasData;

                return (
                    <Box key={key} sx={boxStyles}>
                        <DropBox
                            configItem={configItem}
                            isProcessing={isProcessing(sampleId, configId)}
                            hasData={hasData}
                            openModal={openModal}
                            isLocked={isLocked} // <-- pass isLocked here
                            sampleGroup={sampleGroup}
                            onError={onError}
                            uploadedDataItem={processedData[key]}
                            openDataModal={openDataModal}
                            getProgressState={getProgressState}
                            getUploadDownloadProgressState={getUploadDownloadProgressState}
                            handleRawUploadAndProcess={handleRawUploadAndProcess}
                            organization={organization}
                        />
                    </Box>
                );
            });
    }, [
        sampleGroup,
        boxStyles,
        isProcessing,
        processedData,
        openModal,
        onError,
        openDataModal,
        getProgressKey,
        getProgressState,
        getUploadDownloadProgressState,
        handleRawUploadAndProcess,
        organization,
        hasModifyPermission,
    ]);

    /**
     * Determine how to render the modal when user clicks "View Data"
     */
    const renderModalContent = useCallback(() => {
        if (!modalState.data || !modalState.configItem) return null;

        switch (modalState.configItem.id) {
            case 'ctd_data':
                return <DataChart data={modalState.data} units={modalState.units || {}} />;
            case 'sequencing_data':
                return (
                    <KrakenVisualization
                        data={modalState.data}
                        open={modalState.isOpen}
                        onClose={closeModal}
                    />
                );
            case 'nutrient_ammonia':
                return <NutrientAmmoniaView data={modalState.data} />;
            default:
                return <DataTable data={modalState.data} />;
        }
    }, [modalState, closeModal]);

    return (
        <Box className="dropBoxes">
            {renderedDropBoxes}

            {modalState.isOpen && (
                <Modal
                    isOpen={modalState.isOpen}
                    title={modalState.title}
                    onClose={closeModal}
                    modalFields={modalState.configItem?.modalFields}
                    modalInputs={modalState.modalInputs}
                    handleModalChange={handleModalChange}
                    handleModalSubmit={handleModalSubmit}
                >
                    {modalState.type === 'data' && modalState.data && renderModalContent()}
                </Modal>
            )}
        </Box>
    );
};

export default DropBoxes;
