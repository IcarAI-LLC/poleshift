// src/hooks/useProcessedData.ts

import { useContext, useCallback } from 'react';
import { UnlistenFn, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { AppContext } from '../contexts/AppContext';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type {SampleGroupMetadata, SampleMetadata} from '../types';
import {v4 as uuidv4} from "uuid";
import { readFile } from '@tauri-apps/plugin-fs';
import {UploadManager} from "../services/UploadManager.ts";
import {supabase} from "../supabase/client.ts";

// Types for progress tracking
interface ProgressState {
    progress: number;
    status: string;
}

interface ProcessCallback {
    (insertData: any, configItem: DropboxConfigItem, processedData: any): void;
}

// State interfaces
interface ProcessedDataState {
    data: Record<string, any>;
    isProcessing: Record<string, boolean>;
    progressStates: Record<string, ProgressState>;
    uploadDownloadProgressStates: Record<string, ProgressState>;
    error: string | null;
}

export function useProcessedData() {
    const { state, dispatch, services } = useContext(AppContext);
    const { processedDataStorage, processedData: processedDataService, network } = services;

    // Instantiate the UploadManager
    const uploadManager = new UploadManager(supabase, network);

    const getProgressKey = useCallback((sampleId: string, configId: string): string => {
        return `${sampleId}:${configId}`;
    }, []);

    // Progress tracking functions
    const updateProgressState = useCallback(
        (sampleId: string, configId: string, progress: number, status: string) => {
            dispatch({
                type: 'SET_PROCESSED_DATA_PROGRESS',
                payload: {
                    key: getProgressKey(sampleId, configId),
                    progress,
                    status,
                },
            });
        },
        [dispatch, getProgressKey]
    );

    const updateUploadDownloadProgressState = useCallback(
        (sampleId: string, configId: string, progress: number, status: string) => {
            dispatch({
                type: 'SET_UPLOAD_DOWNLOAD_PROGRESS',
                payload: {
                    key: getProgressKey(sampleId, configId),
                    progress,
                    status,
                },
            });
        },
        [dispatch, getProgressKey]
    );

    const getProgressState = useCallback(
        (sampleId: string, configId: string): ProgressState => {
            const key = getProgressKey(sampleId, configId);
            return state.processedData.progressStates[key] || { progress: 0, status: '' };
        },
        [state.processedData.progressStates, getProgressKey]
    );

    const getUploadDownloadProgressState = useCallback(
        (sampleId: string, configId: string): ProgressState => {
            const key = getProgressKey(sampleId, configId);
            return state.processedData.uploadDownloadProgressStates[key] || { progress: 0, status: '' };
        },
        [state.processedData.uploadDownloadProgressStates, getProgressKey]
    );

    // Updated processData function
    const processData = useCallback(
        async (
            processFunctionName: string,
            sampleGroup: SampleGroupMetadata,
            modalInputs: Record<string, string>,
            filePaths: string[],
            configItem: DropboxConfigItem,
            onDataProcessed: ProcessCallback,
            onError: (message: string) => void
        ) => {
            const sampleId = sampleGroup.human_readable_sample_id;
            const configId = configItem.id;
            const key = getProgressKey(sampleId, configId);
            const user = state.auth.user;
            const organization = state.auth.organization
            try {
                dispatch({
                    type: 'SET_PROCESSING_STATUS',
                    payload: {key, status: true},
                });
                // 1. Create initial metadata record
                const metadataRecord: SampleMetadata = {
                    id: uuidv4(),
                    human_readable_sample_id: sampleId,
                    org_id: organization?.id,
                    user_id: user?.id,
                    data_type: configItem.dataType,
                    status: 'processing',
                    upload_datetime_utc: new Date().toISOString(),
                    process_function_name: processFunctionName,
                    sample_group_id: sampleGroup.id,
                    raw_storage_paths: filePaths.map(file =>
                        `${organization?.org_short_id}/${sampleId}/${file.replace(/^.*[\\\/]/, '')}`
                    ),
                    processed_storage_path: `${organization?.org_short_id}/${sampleId}/processed/${configId}.json`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                // Save initial metadata to IndexedDB
                await services.data.saveSampleMetadata(metadataRecord);

                // 2. Queue raw files for upload with correct paths
                for (const filePath of filePaths) {
                    console.log("File path: ", filePath)
                    const fileName = filePath.replace(/^.*[\\\/]/, '');
                    const storagePath = `${organization?.org_short_id}/${sampleId}/${fileName}`;

                    const fileBuffer = await readFile(filePath);
                    await processedDataStorage.queueRawFile(
                        sampleId,
                        configId,
                        new File([fileBuffer], fileName),
                        {customPath: storagePath}
                    );
                }
                await uploadManager.startUploadProcess();

                // 3. Process the data using Tauri command
                updateProgressState(sampleId, configId, 0, 'Processing data...');

                let unlisten: UnlistenFn | undefined;
                try {
                    unlisten = await listen('progress', (event) => {
                        const {progress, status} = event.payload as { progress: number; status: string };
                        updateProgressState(sampleId, configId, progress, status);
                    });

                    const result = await invoke<any>(configItem.processFunctionName, {
                        functionName: processFunctionName,
                        sampleId,
                        modalInputs,
                        filePaths,
                    });

                    // 4. Prepare and queue processed data
                    const processedData = {
                        data: result,
                        metadata: {
                            processFunction: processFunctionName,
                            processedDateTime: new Date().toISOString(),
                        },
                        rawFilePaths: metadataRecord.raw_storage_paths
                    };

                    const processedBlob = new Blob([JSON.stringify(processedData)], {
                        type: 'application/json',
                    });

                    await processedDataStorage.queueProcessedFile(
                        sampleId,
                        configId,
                        processedBlob,
                        {customPath: metadataRecord.processed_storage_path}
                    );
                    // Trigger the upload process after queuing processed data
                    await uploadManager.startUploadProcess();

                    // 5. Update metadata record with completion status
                    const updatedMetadata = {
                        ...metadataRecord,
                        status: 'processed',
                        processed_datetime_utc: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    await services.data.saveSampleMetadata(updatedMetadata);

                    // 6. Save processed data to local IndexedDB
                    await processedDataStorage.saveProcessedData(sampleId, configId, processedData, {
                        rawFilePaths: metadataRecord.raw_storage_paths || undefined,
                        processedPath: metadataRecord.processed_storage_path,
                        metadata: processedData.metadata
                    });

                    // 7. Update global state
                    dispatch({
                        type: 'SET_PROCESSED_DATA',
                        payload: {key, data: processedData.data}
                    });

                    updateProgressState(sampleId, configId, 100, 'Processing complete');
                    onDataProcessed({
                        sampleId,
                        configId,
                        timestamp: Date.now(),
                        status: 'processed'
                    }, configItem, processedData);

                } finally {
                    if (unlisten) {
                        await unlisten();
                    }
                }

            } catch (error: any) {
                console.error('Processing error:', error);
                onError(error.message || 'Failed to process data');
                updateProgressState(sampleId, configId, 0, 'Processing failed');
            } finally {
                dispatch({
                    type: 'SET_PROCESSING_STATUS',
                    payload: {key, status: false},
                });
            }
        },
        [dispatch, services.data, processedDataStorage, updateProgressState]
    );

    const fetchProcessedData = useCallback(
        async (sampleGroup: SampleGroupMetadata) => {
            if (!sampleGroup) return;

            try {
                const localData = await processedDataStorage.getAllProcessedData(
                    sampleGroup.human_readable_sample_id
                );

                Object.entries(localData).forEach(([key, value]) => {
                    // Extract the actual data
                    const data = value.data.data; // Adjusted to extract the actual data
                    dispatch({
                        type: 'SET_PROCESSED_DATA',
                        payload: { key, data },
                    });
                });

                if (network.isOnline()) {
                    await processedDataService.syncProcessedData(sampleGroup.human_readable_sample_id);
                }
            } catch (error: any) {
                console.error('Error fetching processed data:', error);
                dispatch({
                    type: 'SET_ERROR_MESSAGE',
                    payload: error.message || 'Failed to fetch processed data',
                });
            }
        },
        [dispatch, network, processedDataService, processedDataStorage]
    );
    return {
        processedData: state.processedData.data,
        isProcessing: state.processedData.isProcessing,
        processData,
        fetchProcessedData,
        getProgressState,
        getUploadDownloadProgressState,
    };
}