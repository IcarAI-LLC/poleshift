// DropBoxes.tsx

import React, {
  useState,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Box, Typography } from '@mui/material';
import dropboxConfig, { DropboxConfigItem } from '../../config/dropboxConfig';
import useUI from '../../hooks/useUI';
import useData from '../../hooks/useData';
import Modal from '../Modal';
import DataTable from '../DataTable';
import DataChart from '../DataChart';
import { useLocations } from '../../hooks/useLocations';
import DropBox from './DropBox';
import { ProcessedDataContext } from '../../contexts/ProcessedDataContext';
import {
  processCTDDataForModal,
  processKrakenDataForModal,
} from '../../utils/dataProcessingUtils';
import { SampleGroup } from '../../utils/sampleGroupUtils';
import NutrientAmmoniaView from '../NutrientAmmoniaView';
import KrakenVisualization from '../KrakenVisualization/KrakenVisualization';

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
  const { sampleGroupData } = useData();
  const { processData, fetchProcessedData, processedData, isProcessing } =
    useContext(ProcessedDataContext);
  const getProgressKey = (sampleId: string, configId: string) =>
    `${sampleId}:${configId}`;
  const sampleGroupId =
    selectedLeftItem?.type === 'sampleGroup' ? selectedLeftItem.id : null;
  const sampleGroup: SampleGroup | null = sampleGroupId
    ? sampleGroupData[sampleGroupId]
    : null;

  const { getLocationById } = useLocations();
  const sampleLocation = getLocationById(sampleGroup?.loc_id || null);

  // Fetch processed data when sample group changes
  useEffect(() => {
    if (sampleGroup) {
      fetchProcessedData(sampleGroup);
    }
  }, [sampleGroup, fetchProcessedData]);

  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    type: 'input',
    modalInputs: {},
  });

  // Memoize openModal to avoid unnecessary re-renders
  const openModal = useCallback(
    (
      title: string,
      configItem: DropboxConfigItem,
      uploadedFiles: File[] = [],
    ) => {
      if (configItem.modalFields?.length) {
        const extendedModalFields = [
          ...configItem.modalFields,
          {
            name: 'lat',
            label: 'Latitude',
            type: 'number',
            tooltip: 'Latitude of the sample location',
            required: false,
          },
          {
            name: 'long',
            label: 'Longitude',
            type: 'number',
            tooltip: 'Longitude of the sample location',
            required: false,
          },
        ];

        setModalState({
          isOpen: true,
          title,
          type: 'input',
          configItem: {
            ...configItem,
            modalFields: extendedModalFields,
          },
          modalInputs: {
            lat: sampleLocation?.lat?.toString() || '',
            long: sampleLocation?.long?.toString() || '',
          },
          uploadedFiles,
        });
      }
    },
    [sampleLocation],
  );

  const openDataModal = useCallback(
    async (title: string, dataItem: any, configItem: DropboxConfigItem) => {
      if (!dataItem) return;

      let modalData;
      let units;

      try {
        if (configItem.id === 'ctd_data') {
          const { processedData: ctdData, variableUnits } =
            processCTDDataForModal(dataItem.data);
          modalData = ctdData;
          units = variableUnits;
        } else if (configItem.id === 'nutrient_ammonia') {
          modalData = dataItem.data;
        } else if (configItem.id === 'sequencing_data') {
          modalData = processKrakenDataForModal(dataItem);
        } else {
          modalData = dataItem;
        }

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
    [onError],
  );

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

  const handleModalChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const { name, value } = e.target;
      setModalState((prev) => ({
        ...prev,
        modalInputs: { ...prev.modalInputs, [name]: value },
      }));
    },
    [],
  );

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
  }, [
    modalState,
    sampleGroup,
    processData,
    onDataProcessed,
    onError,
    closeModal,
  ]);

  // Memoize the DropBoxes to prevent unnecessary re-renders
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

    return dropboxConfig.map((configItem) => {
      if (!configItem?.isEnabled) return null;

      const sampleId = sampleGroup.human_readable_sample_id;
      const configId = configItem.id;
      const key = getProgressKey(sampleId, configId);

      const isProcessingItem = isProcessing[key];
      const hasData = !!processedData[key];
      const uploadedDataItem = processedData[key];

      return (
        <Box
          key={key}
          sx={{
            width: {
              xs: '100%',
              sm: 'calc(50% - var(--spacing-md))',
              md: 'calc(33.333% - var(--spacing-md))',
            },
          }}
        >
          <DropBox
            configItem={configItem}
            isProcessing={isProcessingItem}
            hasData={hasData}
            openModal={openModal}
            isLocked={false}
            sampleGroup={sampleGroup}
            onDataProcessed={onDataProcessed}
            onError={onError}
            uploadedDataItem={uploadedDataItem}
            openDataModal={openDataModal}
          />
        </Box>
      );
    });
  }, [
    sampleGroup,
    dropboxConfig,
    isProcessing,
    processedData,
    openModal,
    onDataProcessed,
    onError,
    openDataModal,
  ]);

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
          {modalState.type === 'data' &&
            modalState.data &&
            (modalState.configItem?.id === 'ctd_data' ? (
              <DataChart
                data={modalState.data}
                units={modalState.units || {}}
              />
            ) : modalState.configItem?.id === 'sequencing_data' ? (
              <KrakenVisualization data={modalState.data} />
            ) : modalState.configItem?.id === 'nutrient_ammonia' ? (
              <NutrientAmmoniaView data={modalState.data} />
            ) : (
              <DataTable data={modalState.data} />
            ))}
        </Modal>
      )}
    </Box>
  );
};

export default DropBoxes;
