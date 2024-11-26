// src/lib/contexts/ProcessedDataContext.tsx

import React, { createContext, useCallback, useRef, useReducer, useEffect } from 'react';
import { SampleGroup, SampleMetadata } from '../types/data';
import { DropboxConfigItem } from '../../config/dropboxConfig';
import {
    ProcessedDataContextType,
    ProgressState,
    UploadDownloadProgressState,
} from '../types/processed-data';
import { processedDataReducer, initialProcessedDataState } from './reducers/processedDataReducer';
import { api } from '../api';
import { fileStorage } from '../api/storage';
import { storage } from '../storage/indexedDB';
import pako from 'pako';

export const ProcessedDataContext = createContext<ProcessedDataContextType | undefined>(undefined);

const getProgressKey = (sampleId: string, configId: string) => `${sampleId}:${configId}`;

export const ProcessedDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(processedDataReducer, initialProcessedDataState);
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
        []
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
        []
    );

    const getProgressState = useCallback(
        (sampleId: string, configId: string): ProgressState => {
            const key = getProgressKey(sampleId, configId);
            return state.progressStates[key] || { progress: 0, status: '' };
        },
        [state.progressStates]
    );

    const getUploadDownloadProgressState = useCallback(
        (sampleId: string, configId: string): UploadDownloadProgressState => {
            const key = getProgressKey(sampleId, configId);
            return state.uploadDownloadProgressStates[key] || { progress: 0, status: '' };
        },
        [state.uploadDownloadProgressStates]
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
        []
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
        []
    );

    // Function to upload files with offline support
    const uploadFileWithOfflineSupport = useCallback(
        async (bucket: string, path: string, file: Blob, sampleId: string, configId: string) => {
            if (navigator.onLine) {
                try {
                    await fileStorage.uploadFile(bucket, path, file);
                    updateUploadDownloadProgressState(
                        sampleId,
                        configId,
                        100,
                        'File uploaded successfully'
                    );
                } catch (error) {
                    console.error('Error uploading file:', error);
                    updateUploadDownloadProgressState(
                        sampleId,
                        configId,
                        0,
                        'File upload failed'
                    );
                    throw error;
                }
            } else {
                // Offline: Queue the file upload
                await storage.addPendingOperation({
                    type: 'insert',
                    table: 'fileUploads',
                    data: { bucket, path, file },
                    sampleId,
                    configId,
                    timestamp: Date.now(),
                });
                updateUploadDownloadProgressState(
                    sampleId,
                    configId,
                    0,
                    'Offline: File upload queued'
                );
            }
        },
        [updateUploadDownloadProgressState]
    );

    // Function to insert data with offline support
    const insertDataWithOfflineSupport = useCallback(
        async (
            tableName: string,
            data: any,
            sampleId: string,
            configId: string
        ): Promise<any> => {
            if (navigator.onLine) {
                try {
                    const insertedData = await api.data.insertData(tableName, data);
                    updateProgressState(sampleId, configId, 100, 'Data inserted successfully');
                    return insertedData;
                } catch (error) {
                    console.error('Error inserting data:', error);
                    updateProgressState(sampleId, configId, 0, 'Data insertion failed');
                    throw error;
                }
            } else {
                // Offline: Queue the data insertion
                await storage.addPendingOperation({
                    type: 'insert',
                    table: tableName,
                    data,
                    sampleId,
                    configId,
                    timestamp: Date.now(),
                });
                updateProgressState(sampleId, configId, 0, 'Offline: Data insertion queued');
                return data; // Return the data as if it was inserted
            }
        },
        [updateProgressState]
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
                processedData: any
            ) => void,
            onError: (message: string) => void
        ) => {
            const sampleId = sampleGroup.human_readable_sample_id;
            const configId = configItem.id;
            const key = getProgressKey(sampleId, configId);

            if (!processingPromisesRef.current[key]) {
                const processingPromise = (async () => {
                    try {
                        setProcessingState(sampleId, configId, true);
                        updateProgressState(sampleId, configId, 0, 'Starting process...');

                        if (!sampleGroup?.storage_folder) {
                            throw new Error('Storage folder not found for sample group');
                        }

                        // Upload raw files (gzipped)
                        updateProgressState(sampleId, configId, 10, 'Uploading raw files...');
                        const totalFiles = uploadedFiles.length;
                        let uploadedFilesCount = 0;
                        for (const file of uploadedFiles) {
                            const isGzipped = file.name.endsWith('.gz');
                            let fileToUpload: Blob = file;
                            let uploadFileName = file.name;
                            if (!isGzipped) {
                                // Gzip the file
                                const arrayBuffer = await file.arrayBuffer();
                                const compressedData = pako.gzip(new Uint8Array(arrayBuffer));
                                fileToUpload = new Blob([compressedData], { type: 'application/gzip' });
                                uploadFileName = `${file.name}.gz`;
                            }
                            const uploadPath = `${sampleGroup.storage_folder}/${uploadFileName}`;

                            await uploadFileWithOfflineSupport(
                                'raw-data',
                                uploadPath,
                                fileToUpload,
                                sampleId,
                                configId
                            );

                            uploadedFilesCount++;
                            updateProgressState(
                                sampleId,
                                configId,
                                10 + (uploadedFilesCount / totalFiles) * 30,
                                `Uploaded ${uploadedFilesCount} of ${totalFiles} raw files`
                            );
                        }

                        // TODO: Implement actual processing logic using Tauri
                        // This will be implemented locally
                        // For now, simulate processing time
                        updateProgressState(sampleId, configId, 50, 'Processing data...');
                        await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate processing delay

                        // After processing, get the processed data
                        const processedData = {}; // Replace with actual processed data

                        // Upload processed data
                        updateProgressState(sampleId, configId, 70, 'Uploading processed data...');
                        const processedStoragePath = `${sampleGroup.storage_folder}/processed_${configId}.json.gz`;
                        const processedJson = JSON.stringify(processedData);
                        const compressedProcessedData = pako.gzip(processedJson);

                        await uploadFileWithOfflineSupport(
                            'processed-data',
                            processedStoragePath,
                            new Blob([compressedProcessedData], { type: 'application/gzip' }),
                            sampleId,
                            configId
                        );

                        // Insert metadata record
                        updateProgressState(sampleId, configId, 90, 'Inserting metadata...');
                        const metadataRecord: Omit<SampleMetadata, 'id' | 'created_at'> = {
                            human_readable_sample_id: sampleGroup.human_readable_sample_id,
                            data_type: configId,
                            processed_storage: processedStoragePath,
                            raw_storage_paths: uploadedFiles
                                .map((file) => {
                                    const isGzipped = file.name.endsWith('.gz');
                                    const fileName = isGzipped ? file.name : `${file.name}.gz`;
                                    return `${sampleGroup.storage_folder}/${fileName}`;
                                })
                                .join(','), // Convert array to comma-separated string
                            org_id: sampleGroup.org_id,
                            user_id: sampleGroup.user_id,
                            status: 'processed',
                            processed_datetime_utc: new Date().toISOString(),
                            process_function_name: functionName,
                            sample_group_id: sampleGroup.id,
                            lat: modalInputs.lat ? parseFloat(modalInputs.lat) : undefined,
                            long: modalInputs.long ? parseFloat(modalInputs.long) : undefined,
                            file_name: '', // Add any additional fields as needed
                        };

                        const insertedData = await insertDataWithOfflineSupport(
                            'sample_metadata',
                            metadataRecord,
                            sampleId,
                            configId
                        );

                        // Update local state
                        updateProcessedData(sampleId, configId, processedData);

                        // Save processed data offline
                        await storage.saveProcessedData(sampleId, configId, processedData, Date.now());

                        updateProgressState(sampleId, configId, 100, 'Processing complete');
                        setProcessingState(sampleId, configId, false);

                        // Call the onDataProcessed callback with the results
                        onDataProcessed(insertedData, configItem, processedData);
                    } catch (error: any) {
                        console.error('Error during processing:', error);
                        onError(error.message || 'Processing failed');
                        updateProgressState(sampleId, configId, 0, '');
                        setProcessingState(sampleId, configId, false);
                    } finally {
                        delete processingPromisesRef.current[key];
                    }
                })();
                processingPromisesRef.current[key] = processingPromise;
                return processingPromise;
            } else {
                return processingPromisesRef.current[key];
            }
        },
        [
            setProcessingState,
            updateProgressState,
            updateProcessedData,
            uploadFileWithOfflineSupport,
            insertDataWithOfflineSupport,
        ]
    );

    const fetchProcessedData = useCallback(
        async (sampleGroup: SampleGroup | null) => {
            if (!sampleGroup) return;

            try {
                const sampleId = sampleGroup.human_readable_sample_id;

                updateUploadDownloadProgressState(sampleId, '', 10, 'Fetching processed data...');

                // Fetch the list of processed data entries for the sample group from 'sample_metadata'
                const processedDataEntries = await api.data.getProcessedDataEntries(sampleGroup.id);

                for (const entry of processedDataEntries) {
                    const {
                        data_type,
                        // @ts-ignore
                        process_function_name,
                        processed_storage,
                        updated_at,
                    } = entry;

                    const config_id = data_type!;
                    const processedStoragePath = processed_storage!;
                    const updatedAt = updated_at!;

                    const localDataEntry = await storage.getProcessedData(sampleId, config_id);

                    if (localDataEntry && localDataEntry.updatedAt >= new Date(updatedAt).getTime()) {
                        // Local data is newer or same, use local data
                        updateProcessedData(sampleId, config_id, localDataEntry.data);
                        continue;
                    }

                    updateUploadDownloadProgressState(sampleId, config_id, 30, 'Downloading data...');

                    // Download the processed data file from the storage bucket
                    const dataBlob = await fileStorage.downloadFile('processed-data', processedStoragePath);

                    // Read and decompress the data
                    const arrayBuffer = await dataBlob.arrayBuffer();
                    const decompressedData = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
                    const data = JSON.parse(decompressedData);

                    // Save data to local storage with updated timestamp
                    await storage.saveProcessedData(sampleId, config_id, data, new Date(updatedAt).getTime());

                    // Update the processed data state
                    updateProcessedData(sampleId, config_id, data);

                    updateUploadDownloadProgressState(sampleId, config_id, 100, 'Data fetched');
                }
            } catch (error) {
                console.error('Error fetching processed data:', error);
            }
        },
        [updateProcessedData, updateUploadDownloadProgressState]
    );

    // Function to upload pending operations when back online
    const uploadPendingOperations = useCallback(async () => {
        const pendingOperations = await storage.getPendingOperations();

        for (const pendingOperation of pendingOperations) {
            const { type, table, data, id, sampleId, configId } = pendingOperation;

            if (type === 'insert' && table === 'fileUploads') {
                const { bucket, path, file } = data;
                try {
                    await fileStorage.uploadFile(bucket, path, file);
                    await storage.deletePendingOperation(id);
                    if (sampleId && configId) {
                        updateUploadDownloadProgressState(
                            sampleId,
                            configId,
                            100,
                            'File uploaded successfully'
                        );
                    }
                } catch (error) {
                    console.error('Error uploading file:', error);
                    // Optionally implement retry logic or leave it in the queue
                }
            } else if (type === 'insert') {
                try {
                    await api.data.insertData(table, data);
                    await storage.deletePendingOperation(id);
                    if (sampleId && configId) {
                        updateProgressState(sampleId, configId, 100, 'Data inserted successfully');
                    }
                } catch (error) {
                    console.error('Error inserting data:', error);
                    // Optionally implement retry logic or leave it in the queue
                }
            }
        }
    }, [updateProgressState, updateUploadDownloadProgressState]);

    // Add event listener for online event
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

    const value: ProcessedDataContextType = {
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