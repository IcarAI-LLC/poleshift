// ProcessedDataContext.tsx

import React, {
  createContext,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';
// import pako from 'pako';
import { DropboxConfigItem } from '../config/dropboxConfig';
import { SampleGroup } from '../utils/sampleGroupUtils';

// Import offline storage utilities (for future use)
// import {
//   addPendingOperation,
//   getAllPendingOperations,
//   deletePendingOperation,
// } from '../utils/offlineStorage';

interface ProgressState {
  progress: number;
  status: string;
}

const getProgressKey = (sampleId: string, configId: string) =>
    `${sampleId}:${configId}`;

interface UploadDownloadProgressState {
  progress: number;
  status: string;
}

interface ProcessedDataState {
  processedData: Record<string, any>;
  isProcessing: Record<string, boolean>;
  progressStates: Record<string, ProgressState>;
  uploadDownloadProgressStates: Record<string, UploadDownloadProgressState>;
}

type Action =
    | {
  type: 'SET_PROCESSING_STATE';
  sampleId: string;
  configId: string;
  isProcessing: boolean;
}
    | {
  type: 'UPDATE_PROCESSED_DATA';
  sampleId: string;
  configId: string;
  data: any;
}
    | {
  type: 'UPDATE_PROGRESS_STATE';
  sampleId: string;
  configId: string;
  progress: number;
  status: string;
}
    | {
  type: 'UPDATE_UPLOAD_DOWNLOAD_PROGRESS_STATE';
  sampleId: string;
  configId: string;
  progress: number;
  status: string;
}
    | {
  type: 'SET_PROCESSED_DATA';
  data: Record<string, any>;
};

interface ProcessedDataContextType {
  processedData: Record<string, any>;
  isProcessing: Record<string, boolean>;
  progressStates: Record<string, ProgressState>;
  uploadDownloadProgressStates: Record<string, UploadDownloadProgressState>;
  processData: (
      functionName: string,
      sampleGroup: SampleGroup,
      modalInputs: Record<string, string>,
      uploadedFiles: File[],
      configItem: DropboxConfigItem,
      onDataProcessed: (
          insertData: any,
          configItem: DropboxConfigItem,
          processedData: any,
      ) => void,
      onError: (message: string) => void,
      onProgress?: (progress: number, status: string) => void,
  ) => Promise<void>;
  setProcessingState: (
      sampleId: string,
      configId: string,
      isProcessing: boolean,
  ) => void;
  updateProcessedData: (sampleId: string, configId: string, data: any) => void;
  fetchProcessedData: (sampleGroup: SampleGroup | null) => Promise<void>;
  updateProgressState: (
      sampleId: string,
      configId: string,
      progress: number,
      status: string,
  ) => void;
  getProgressState: (sampleId: string, configId: string) => ProgressState;
  updateUploadDownloadProgressState: (
      sampleId: string,
      configId: string,
      progress: number,
      status: string,
  ) => void;
  getUploadDownloadProgressState: (
      sampleId: string,
      configId: string,
  ) => UploadDownloadProgressState;
}

export const ProcessedDataContext = createContext<
    ProcessedDataContextType | undefined
>(undefined);

const initialState: ProcessedDataState = {
  processedData: {},
  isProcessing: {},
  progressStates: {},
  uploadDownloadProgressStates: {},
};

function reducer(
    state: ProcessedDataState,
    action: Action,
): ProcessedDataState {
  switch (action.type) {
    case 'SET_PROCESSING_STATE': {
      const key = getProgressKey(action.sampleId, action.configId);
      return {
        ...state,
        isProcessing: {
          ...state.isProcessing,
          [key]: action.isProcessing,
        },
      };
    }
    case 'UPDATE_PROCESSED_DATA': {
      const key = getProgressKey(action.sampleId, action.configId);
      return {
        ...state,
        processedData: {
          ...state.processedData,
          [key]: action.data,
        },
      };
    }
    case 'UPDATE_PROGRESS_STATE': {
      const key = getProgressKey(action.sampleId, action.configId);
      return {
        ...state,
        progressStates: {
          ...state.progressStates,
          [key]: {
            progress: action.progress,
            status: action.status,
          },
        },
      };
    }
    case 'UPDATE_UPLOAD_DOWNLOAD_PROGRESS_STATE': {
      const key = getProgressKey(action.sampleId, action.configId);
      return {
        ...state,
        uploadDownloadProgressStates: {
          ...state.uploadDownloadProgressStates,
          [key]: {
            progress: action.progress,
            status: action.status,
          },
        },
      };
    }
    case 'SET_PROCESSED_DATA': {
      return {
        ...state,
        processedData: action.data,
      };
    }
    default:
      return state;
  }
}

export const ProcessedDataProvider: React.FC<{ children: React.ReactNode }> = ({
                                                                                 children,
                                                                               }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Ref to store in-progress promises to prevent duplicate processing
  const processingPromisesRef = useRef<Record<string, Promise<void>>>({});

  const updateProgressState = useCallback(
      (sampleId: string, configId: string, progress: number, status: string) => {
        dispatch({
          type: 'UPDATE_PROGRESS_STATE',
          sampleId,
          configId,
          progress,
          status,
        });
      },
      [],
  );

  const updateUploadDownloadProgressState = useCallback(
      (sampleId: string, configId: string, progress: number, status: string) => {
        dispatch({
          type: 'UPDATE_UPLOAD_DOWNLOAD_PROGRESS_STATE',
          sampleId,
          configId,
          progress,
          status,
        });
      },
      [],
  );

  const getProgressState = useCallback(
      (sampleId: string, configId: string) => {
        const key = getProgressKey(sampleId, configId);
        return (
            state.progressStates[key] || {
              progress: 0,
              status: '',
            }
        );
      },
      [state.progressStates],
  );

  const getUploadDownloadProgressState = useCallback(
      (sampleId: string, configId: string) => {
        const key = getProgressKey(sampleId, configId);
        return (
            state.uploadDownloadProgressStates[key] || {
              progress: 0,
              status: '',
            }
        );
      },
      [state.uploadDownloadProgressStates],
  );

  const setProcessingState = useCallback(
      (sampleId: string, configId: string, isProcessing: boolean) => {
        dispatch({
          type: 'SET_PROCESSING_STATE',
          sampleId,
          configId,
          isProcessing,
        });
      },
      [],
  );

  const updateProcessedData = useCallback(
      (sampleId: string, configId: string, data: any) => {
        dispatch({
          type: 'UPDATE_PROCESSED_DATA',
          sampleId,
          configId,
          data,
        });
      },
      [],
  );

  const fetchProcessedData = useCallback(
      async (sampleGroup: SampleGroup | null) => {
        if (!sampleGroup) return;

        try {
          // TODO: Fetch processed data from local storage or filesystem
          const newProcessedData: Record<string, any> = {};

          // Simulate fetching data
          const sampleId = sampleGroup.human_readable_sample_id;
          const configId = 'exampleConfigId';

          updateUploadDownloadProgressState(
              sampleId,
              configId,
              0,
              'Loading data...',
          );

          // Simulate a delay
          await new Promise((resolve) => setTimeout(resolve, 500));

          const processedContent = { /* Simulated processed data */ };

          const key = getProgressKey(sampleId, configId);
          newProcessedData[key] = {
            data: processedContent,
          };

          updateUploadDownloadProgressState(
              sampleId,
              configId,
              100,
              'Data loaded',
          );

          dispatch({ type: 'SET_PROCESSED_DATA', data: newProcessedData });
        } catch (error) {
          console.error('Error fetching processed data:', error);
        }
      },
      [updateUploadDownloadProgressState],
  );

  // Function to simulate file upload with offline support
  const uploadFileWithOfflineSupport = useCallback(
      async (
          _bucket: string,
          _path: string,
          _file: Blob,
          sampleId: string,
          configId: string,
      ) => {
        // TODO: Implement file upload logic using Tauri or local filesystem
        // For now, simulate a delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        updateUploadDownloadProgressState(
            sampleId,
            configId,
            100,
            'File upload simulated',
        );
      },
      [updateUploadDownloadProgressState],
  );

  // Function to simulate data insertion with offline support
  const insertDataWithOfflineSupport = useCallback(
      async (
          _tableName: string,
          data: any[],
          sampleId: string,
          configId: string,
      ) => {
        // TODO: Implement data insertion logic using local storage or filesystem
        // For now, simulate a delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        updateProgressState(
            sampleId,
            configId,
            100,
            'Data insertion simulated',
        );
        return [data[0]]; // Return the data as if it was inserted
      },
      [updateProgressState],
  );

  const processData = useCallback(
      async (
          functionName: string,
          sampleGroup: SampleGroup,
          modalInputs: Record<string, string>,
          uploadedFiles: File[],
          configItem: DropboxConfigItem,
          onDataProcessed: (
              insertData: any,
              configItem: DropboxConfigItem,
              processedData: any,
          ) => void,
          onError: (message: string) => void,
          onProgress?: (progress: number, status: string) => void,
      ) => {
        const sampleId = sampleGroup.human_readable_sample_id;
        const configId = configItem.id;
        const key = getProgressKey(sampleId, configId);

        // @ts-ignore
        if (await processingPromisesRef.current[key]) {
          // Prevent duplicate processing for the same sample and config
          return processingPromisesRef.current[key];
        }

        let removeProgressListener: (() => void) | undefined;

        const processingPromise = (async () => {
          try {
            setProcessingState(sampleId, configId, true);
            updateProgressState(sampleId, configId, 0, 'Starting process...');

            if (!sampleGroup.storage_folder) {
              throw new Error('Storage folder not found for sample group');
            }

            if (uploadedFiles.length > 0 && !configItem.expectedFileTypes) {
              throw new Error('File upload not supported for this data type');
            }

            // Simulate file upload progress
            const totalBytes = uploadedFiles.reduce(
                (sum, file) => sum + file.size,
                0,
            );
            let uploadedBytes = 0;

            for (const [index, file] of uploadedFiles.entries()) {
              updateUploadDownloadProgressState(
                  sampleId,
                  configId,
                  (uploadedBytes / totalBytes) * 100,
                  `Uploading file ${index + 1} of ${uploadedFiles.length}: ${
                      file.name
                  }`,
              );

              // Simulate a delay
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Simulate file upload
              await uploadFileWithOfflineSupport(
                  'raw-data',
                  `${sampleGroup.storage_folder}${file.name}`,
                  file,
                  sampleId,
                  configId,
              );

              uploadedBytes += file.size;
              const totalProgress = (uploadedBytes / totalBytes) * 100;

              updateUploadDownloadProgressState(
                  sampleId,
                  configId,
                  totalProgress,
                  totalProgress === 100
                      ? 'All files uploaded successfully'
                      : `Uploaded ${index + 1} of ${uploadedFiles.length} files`,
              );
            }

            // Processing progress
            updateProgressState(sampleId, configId, 10, 'Processing data...');

            // TODO: Implement actual data processing logic using Tauri
            // Simulate processing with progress updates
            for (let progress = 10; progress <= 90; progress += 20) {
              updateProgressState(
                  sampleId,
                  configId,
                  progress,
                  `Processing... ${progress}%`,
              );
              if (onProgress) {
                onProgress(progress, `Processing... ${progress}%`);
              }
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            // Simulate processed data
            const processedData = { /* Simulated processed data */ };

            // Simulate generating metadata
            const metadataRecord = {
              human_readable_sample_id: sampleGroup.human_readable_sample_id,
              data_type: configId,
              processed_storage_path: '', // Since we're offline, path can be empty or a local path
              raw_storage_paths: uploadedFiles.map((file) => file.name),
              org_id: sampleGroup.org_id,
              user_id: sampleGroup.user_id,
              status: 'processed',
              processed_datetime_utc: new Date().toISOString(),
              process_function_name: functionName,
              sample_group_id: sampleGroup.id,
              lat: modalInputs.lat ? parseFloat(modalInputs.lat) : null,
              long: modalInputs.long ? parseFloat(modalInputs.long) : null,
              file_name: '', // For future use
              file_type: '', // For future use
            };

            // Simulate data insertion
            const [insertedData] = await insertDataWithOfflineSupport(
                'sample_metadata',
                [metadataRecord],
                sampleId,
                configId,
            );

            // Update processed data state
            updateProcessedData(sampleId, configId, {
              ...insertedData,
              data: processedData,
            });

            updateProgressState(sampleId, configId, 100, 'Processing complete');
            setProcessingState(sampleId, configId, false);
            onDataProcessed(insertedData, configItem, processedData);
          } catch (error: any) {
            console.error('Error processing data:', error);
            onError(error.message || 'Failed to process data');
            updateProgressState(sampleId, configId, 0, '');
            updateUploadDownloadProgressState(sampleId, configId, 0, '');
            setProcessingState(sampleId, configId, false);
          } finally {
            if (removeProgressListener) {
              removeProgressListener();
            }
            delete processingPromisesRef.current[key];
          }
        })();

        processingPromisesRef.current[key] = processingPromise;
        return processingPromise;
      },
      [
        setProcessingState,
        updateProgressState,
        updateProcessedData,
        updateUploadDownloadProgressState,
        uploadFileWithOfflineSupport,
        insertDataWithOfflineSupport,
      ],
  );

  // Function to handle pending operations (for future use)
  const uploadPendingOperations = useCallback(async () => {
    // TODO: Implement logic to handle pending operations when back online
  }, []);

  // Add event listener for online event (for future use)
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online, attempting to upload pending operations.');
      uploadPendingOperations();
    };

    window.addEventListener('online', handleOnline);

    // Attempt to upload pending operations immediately if online
    if (navigator.onLine) {
      uploadPendingOperations();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [uploadPendingOperations]);

  const value = {
    processedData: state.processedData,
    isProcessing: state.isProcessing,
    progressStates: state.progressStates,
    uploadDownloadProgressStates: state.uploadDownloadProgressStates,
    processData,
    fetchProcessedData,
    setProcessingState,
    updateProcessedData,
    updateProgressState,
    getProgressState,
    updateUploadDownloadProgressState,
    getUploadDownloadProgressState,
  };

  return (
      <ProcessedDataContext.Provider value={value}>
        {children}
      </ProcessedDataContext.Provider>
  );
};

export default ProcessedDataContext;
