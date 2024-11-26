import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, SelectChangeEvent, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

import dropboxConfig, { DropboxConfigItem } from '../../config/dropboxConfig';
import { useUI } from '../../lib/hooks';
import { useData } from '../../lib/hooks';
import { useLocations } from '../../lib/hooks/useLocations';
import { useProcessedData } from '../../lib/hooks/useProcessedData';

import Modal from '../Modal';
import DataTable from '../DataTable';
import DataChart from '../DataChart';
import DropBox from './DropBox';
import NutrientAmmoniaView from '../NutrientAmmoniaView';
import KrakenVisualization from '../KrakenVisualization/KrakenVisualization';

import { processCTDDataForModal, processKrakenDataForModal } from '../../lib/utils/dataProcessingUtils';

interface ModalState {
  isOpen: boolean;
  title: string;
  type: 'input' | 'data';
  configItem?: DropboxConfigItem;
  modalInputs?: Record<string, string>;
  uploadedFiles?: File[];
  data?: any;
  units?: Record<string, string>;
}

interface DropBoxesProps {
  onDataProcessed: (
      insertData: any,
      configItem: DropboxConfigItem,
      processedData: any,
  ) => void;
  onError: (message: string) => void;
}

const DropBoxes: React.FC<DropBoxesProps> = ({ onDataProcessed, onError }) => {
  const { selectedLeftItem } = useUI();
  const { sampleGroups } = useData();
  const { processData, fetchProcessedData, processedData, isProcessing } = useProcessedData();
  const { getLocationById } = useLocations();

  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    type: 'input',
    modalInputs: {},
  });

  const getProgressKey = useCallback((sampleId: string, configId: string): string =>
      `${sampleId}:${configId}`, []
  );

  // Get sample group data
  const { sampleGroup, sampleLocation } = useMemo(() => {
    const sampleGroupId = selectedLeftItem?.type === 'sampleGroup' ? selectedLeftItem.id : null;
    const currentSampleGroup = sampleGroupId ? sampleGroups[sampleGroupId] : null;
    const location = getLocationById(currentSampleGroup?.loc_id || null);

    return {
      sampleGroup: currentSampleGroup,
      sampleLocation: location,
    };
  }, [selectedLeftItem, sampleGroups, getLocationById]);

  // Fetch processed data when sample group changes
  useEffect(() => {
    if (sampleGroup) {
      fetchProcessedData(sampleGroup);
    }
  }, [sampleGroup, fetchProcessedData]);

  const openModal = useCallback(
      (title: string, configItem: DropboxConfigItem, uploadedFiles: File[] = []) => {
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
      [onError]
  );

  const processModalData = async (dataItem: any, configItem: DropboxConfigItem) => {
    switch (configItem.id) {
      case 'ctd_data': {
        const { processedData: ctdData, variableUnits } = processCTDDataForModal(dataItem.data);
        return { modalData: ctdData, units: variableUnits };
      }
      case 'nutrient_ammonia':
        return { modalData: dataItem.data, units: undefined };
      case 'sequencing_data':
        return { modalData: processKrakenDataForModal(dataItem), units: undefined };
      default:
        return { modalData: dataItem, units: undefined };
    }
  };

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

  const handleModalChange = useCallback((
      e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<{ name?: string; value: unknown }> | SelectChangeEvent
  ) => {
    const { name, value } = e.target;

    if (typeof name === 'string') {
      const stringValue = typeof value === 'string' ? value : String(value);

      setModalState((prevState) => ({
        ...prevState,
        modalInputs: {
          ...prevState.modalInputs,
          [name]: stringValue,
        },
      }));
    } else {
      console.warn('Input element is missing a name attribute.');
    }
  }, []);

  const handleModalSubmit = useCallback(async () => {
    const { configItem, modalInputs, uploadedFiles } = modalState;

    if (!configItem || !sampleGroup) return;

    try {
      await processData(
          configItem.processFunctionName,
          sampleGroup,
          modalInputs!,
          uploadedFiles || [],
          configItem,
          onDataProcessed,
          onError,
      );
      closeModal();
    } catch (error) {
      console.error('Error processing data:', error);
      onError('Failed to process uploaded data');
    }
  }, [modalState, sampleGroup, processData, onDataProcessed, onError, closeModal]);

  const boxStyles = useMemo((): SxProps<Theme> => ({
    width: {
      xs: '100%',
      sm: 'calc(50% - var(--spacing-md))',
      md: 'calc(33.333% - var(--spacing-md))',
    },
  }), []);

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
        .filter(configItem => configItem?.isEnabled)
        .map((configItem) => {
          const sampleId = sampleGroup.human_readable_sample_id;
          const configId = configItem.id;
          const key = getProgressKey(sampleId, configId);

          return (
              <Box key={key} sx={boxStyles}>
                <DropBox
                    configItem={configItem}
                    isProcessing={isProcessing[key]}
                    hasData={!!processedData[key]}
                    openModal={openModal}
                    isLocked={false}
                    sampleGroup={sampleGroup}
                    onDataProcessed={onDataProcessed}
                    onError={onError}
                    uploadedDataItem={processedData[key]}
                    openDataModal={openDataModal}
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
    onDataProcessed,
    onError,
    openDataModal,
    getProgressKey,
  ]);

  const renderModalContent = useCallback(() => {
    if (!modalState.data || !modalState.configItem) {
      return null;
    }

    switch (modalState.configItem.id) {
      case 'ctd_data':
        return <DataChart data={modalState.data} units={modalState.units || {}} />;
      case 'sequencing_data':
        return <KrakenVisualization data={modalState.data} />;
      case 'nutrient_ammonia':
        return <NutrientAmmoniaView data={modalState.data} />;
      default:
        return <DataTable data={modalState.data} />;
    }
  }, [modalState]);

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