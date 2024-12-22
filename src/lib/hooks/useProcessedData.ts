// src/lib/hooks/useProcessedData.ts

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, usePowerSync } from '@powersync/react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { useStorage } from './useStorage';

import type { Organization, SampleGroupMetadata } from '../types';
import type { DropboxConfigItem } from '../../config/dropboxConfig';

import {toCompilableQuery, wrapPowerSyncWithDrizzle} from '@powersync/drizzle-driver';
import { DrizzleSchema, processed_data } from '../powersync/DrizzleSchema';
import {and, desc, eq} from "drizzle-orm";

interface ProcessStatus {
    isProcessing: boolean;
    progress: number;
    status: string;
    uploadProgress: number;
    downloadProgress: number;
    uploadStatus: string;
    downloadStatus: string;
}

const createDefaultProcessStatus = (): ProcessStatus => ({
    isProcessing: false,
    progress: 0,
    status: '',
    uploadProgress: 0,
    downloadProgress: 0,
    uploadStatus: '',
    downloadStatus: '',
});

interface UseProcessedDataParams {
    sampleGroup: SampleGroupMetadata | null;
    orgShortId?: string;
    orgId?: string;
    organization: Organization | null;
    storage?: ReturnType<typeof useStorage>;
}

export const useProcessedData = ({
                                     sampleGroup,
                                     orgShortId = '',
                                     orgId = '',
                                     organization,
                                     storage = useStorage(),
                                 }: UseProcessedDataParams) => {
    const [processStatuses, setProcessStatuses] = useState<Record<string, ProcessStatus>>({});
    const [error, setError] = useState<string | null>(null);

    const sampleId = sampleGroup?.id || null;
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db, { schema: DrizzleSchema });

    // Build query conditionally
    const processedDataQuery = useMemo(() => {
        if (!sampleId) {
            // Return a dummy query that fetches no rows if no sampleId
            return drizzleDB.select().from(processed_data).where(eq(processed_data.id, '__none__'));
        }

        return drizzleDB
            .select()
            .from(processed_data)
            .where(
                and(
                    eq(processed_data.sample_id, sampleId),
                    eq(processed_data.status, 'completed')
                )
            )
            .orderBy(desc(processed_data.timestamp));
    }, [drizzleDB, sampleId]);

    // Compile the query for use with `useQuery`
    const compiledProcessedDataQuery = useMemo(() => {
        return toCompilableQuery(processedDataQuery);
    }, [processedDataQuery]);

    // Now fetch data with useQuery
    const {
        data: rawResults = [],
        isLoading,
        isFetching,
        error: queryError,
    } = useQuery(compiledProcessedDataQuery);

    const processedData = useMemo(() => {
        if (!sampleId) {
            return {};
        }
        const dataMap: Record<string, any> = {};
        for (const result of rawResults) {
            const key = `${result.sample_id}:${result.config_id}`;
            dataMap[key] = {
                ...result,
                data: result.data ? JSON.parse(result.data) : null,
                metadata: result.metadata ? JSON.parse(result.metadata) : null,
                raw_file_paths: result.raw_file_paths ? JSON.parse(result.raw_file_paths) : null,
                processed_file_paths: result.processed_file_paths ? JSON.parse(result.processed_file_paths) : null,
            };
        }
        return dataMap;
    }, [rawResults, sampleId]);

    useEffect(() => {
        if (queryError) {
            setError(queryError instanceof Error ? queryError.message : 'Error fetching processed data');
        }
    }, [queryError]);

    const withRetry = useCallback(
        async (operation: () => Promise<any>, maxAttempts: number, delayMs: number) => {
            let lastError: Error | undefined;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    return await operation();
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));
                    if (attempt < maxAttempts - 1) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, delayMs * Math.pow(2, attempt))
                        );
                    }
                }
            }
            throw lastError || new Error('Processing failed after retries');
        },
        []
    );

    const updateProcessStatus = useCallback((key: string, updates: Partial<ProcessStatus>) => {
        setProcessStatuses((prev) => ({
            ...prev,
            [key]: {
                ...createDefaultProcessStatus(),
                ...prev[key],
                ...updates,
            },
        }));
    }, []);

    const resetProcessStatus = useCallback((key: string) => {
        setProcessStatuses((prev) => ({
            ...prev,
            [key]: createDefaultProcessStatus(),
        }));
    }, []);

    const saveProcessedData = useCallback(
        async (
            sampleId: string,
            configId: string,
            processFunctionName: string,
            data: any,
            rawFilePaths: string[],
            processedFilePaths: string[],
            metadata: any,
            orgIdParam: string,
            orgShortIdParam: string,
            humanReadableSampleId: string,
            processedPath: string
        ) => {
            const timestamp = Date.now();
            await drizzleDB
                .insert(processed_data)
                .values({
                    key: `${sampleId}:${configId}:${timestamp}`,
                    id: `${sampleId}:${configId}:${timestamp}`,
                    sample_id: sampleId,
                    human_readable_sample_id: humanReadableSampleId,
                    config_id: configId,
                    data: JSON.stringify(data),
                    raw_file_paths: JSON.stringify(rawFilePaths),
                    processed_file_paths: JSON.stringify(processedFilePaths),
                    processed_path: processedPath,
                    timestamp,
                    status: 'completed',
                    metadata: JSON.stringify(metadata),
                    org_id: orgIdParam,
                    org_short_id: orgShortIdParam,
                    process_function_name: processFunctionName,
                })
                .run();
        },
        [drizzleDB]
    );

    const processData = useCallback(
        async (
            processFunctionName: string,
            group: SampleGroupMetadata,
            inputs: Record<string, any>,
            filePaths: string[],
            configItem: DropboxConfigItem,
            uploadedRawPaths?: string[]
        ) => {
            if (!group || !group.id) {
                setError('No valid sample group for processing');
                return;
            }

            const key = `${group.id}:${configItem.id}`;
            let progressUnlisten: UnlistenFn | undefined;

            try {
                // Register the event listener *before* invoking the command
                progressUnlisten = await listen('progress', (event) => {
                    const { progress, status } = event.payload as { progress: number; status: string };
                    console.log('progress event:', progress, status);
                    updateProcessStatus(key, { progress, status });
                });

                updateProcessStatus(key, {
                    isProcessing: true,
                    progress: 0,
                    status: 'Starting process...',
                });

                const result = await withRetry(
                    () =>
                        invoke(processFunctionName, {
                            sampleId: group.id,
                            modalInputs: inputs,
                            filePaths,
                        }),
                    3,
                    1000
                );

                const processedFiles = result.files?.processed || [];

                let uploadedProcessedPaths: string[] = [];
                if (processedFiles.length > 0 && organization) {
                    const basePath = `${organization.org_short_id}/${group.id}`;
                    uploadedProcessedPaths = await storage.uploadFiles(
                        processedFiles,
                        basePath,
                        'processed-data',
                        (progress) => {
                            updateProcessStatus(key, {
                                uploadProgress: progress.progress,
                                uploadStatus: 'Uploading processed data...',
                            });
                        }
                    );

                    updateProcessStatus(key, {
                        uploadProgress: 100,
                        uploadStatus: 'Processed data upload complete',
                    });
                }

                result.processedData = {
                    ...result.processedData,
                    uploadedProcessedPaths,
                };

                const processedPath = uploadedProcessedPaths.length > 0
                    ? uploadedProcessedPaths[0]
                    : result.processedPath || '';
                const processedFilePaths = uploadedProcessedPaths;
                const metadata = result.metadata || {};
                const humanReadableSampleId = group.human_readable_sample_id || group.id;
                const sampleOrgId = group.org_id || orgId || '';
                const sampleOrgShortId = orgShortId || organization?.org_short_id || '';

                await saveProcessedData(
                    group.id,
                    configItem.id,
                    configItem.processFunctionName,
                    result,
                    uploadedRawPaths || [],
                    processedFilePaths,
                    metadata,
                    sampleOrgId,
                    sampleOrgShortId,
                    humanReadableSampleId,
                    processedPath
                );

                updateProcessStatus(key, {
                    progress: 100,
                    status: 'Processing complete',
                    isProcessing: false,
                });
            } catch (err: any) {
                const errorMessage = err instanceof Error ? err.message : 'Processing failed';
                setError(errorMessage);

                updateProcessStatus(key, {
                    status: `Error: ${errorMessage}`,
                    isProcessing: false,
                });
            } finally {
                if (progressUnlisten) {
                    await progressUnlisten();
                }
            }
        },
        [
            orgShortId,
            orgId,
            organization,
            processedData,
            saveProcessedData,
            setError,
            storage,
            updateProcessStatus,
            withRetry,
        ]
    );

    /**
     * Handles reading raw files from local paths, uploading them, and then calling processData.
     */
    const handleRawUploadAndProcess = useCallback(
        async (
            configItem: DropboxConfigItem,
            group: SampleGroupMetadata,
            filePaths: string[],
            inputs: Record<string, any>,
            onError: (message: string) => void,
            isOffline: boolean
        ) => {
            if (!group?.id || !organization) {
                onError('Missing organization or group data.');
                return;
            }

            const key = `${group.id}:${configItem.id}`;

            updateProcessStatus(key, {
                uploadProgress: 0,
                uploadStatus: 'Preparing files for upload...',
            });

            try {
                // Read files locally
                const files = await Promise.all(
                    filePaths.map(async (filePath) => {
                        const fileContents = await readFile(filePath);
                        const fileName = filePath.split('/').pop()?.split('\\').pop() || filePath;
                        return new File([new Uint8Array(fileContents)], fileName);
                    })
                );

                // Upload raw files
                const basePath = `${organization.org_short_id}/${group.id}`;
                const uploadedRawPaths = await storage.uploadFiles(files, basePath, 'raw-data', (progress) => {
                    updateProcessStatus(key, {
                        uploadProgress: progress.progress,
                        uploadStatus: 'Uploading raw data...',
                    });
                });

                updateProcessStatus(key, {
                    uploadProgress: 100,
                    uploadStatus: 'Raw data upload complete',
                });

                if (isOffline) {
                    onError(
                        'You are offline. Your files have been queued and will be uploaded when back online.'
                    );
                }

                // Now call processData after raw upload
                await processData(
                    configItem.processFunctionName,
                    group,
                    inputs,
                    filePaths,
                    configItem,
                    uploadedRawPaths
                );
            } catch (err: any) {
                console.error('handleRawUploadAndProcess error:', err);
                onError(err.message || 'Failed to upload and process files');
                updateProcessStatus(key, {
                    status: `Error: ${err.message || 'Failed to upload and process files'}`,
                    isProcessing: false,
                });
            }
        },
        [organization, processData, storage, updateProcessStatus]
    );

    // Utilities
    const isProcessing = useCallback(
        (sId: string, cId: string): boolean => {
            const key = `${sId}:${cId}`;
            return processStatuses[key]?.isProcessing || false;
        },
        [processStatuses]
    );

    const getProgress = useCallback(
        (sId: string, cId: string): number => {
            const key = `${sId}:${cId}`;
            return processStatuses[key]?.progress || 0;
        },
        [processStatuses]
    );

    const getStatus = useCallback(
        (sId: string, cId: string): string => {
            const key = `${sId}:${cId}`;
            return processStatuses[key]?.status || '';
        },
        [processStatuses]
    );

    const hasProcessedData = useCallback(
        (sId: string, cId: string): boolean => {
            if (!sampleId) return false;
            const key = `${sId}:${cId}`;
            return Boolean(processedData[key]);
        },
        [processedData, sampleId]
    );

    const getProcessedData = useCallback(
        (sId: string, cId: string): any => {
            if (!sampleId) return null;
            const key = `${sId}:${cId}`;
            return processedData[key];
        },
        [processedData, sampleId]
    );

    const getProgressState = useCallback(
        (sId: string, cId: string) => {
            const key = `${sId}:${cId}`;
            const status = processStatuses[key] || createDefaultProcessStatus();
            return {
                progress: status.progress,
                status: status.status,
            };
        },
        [processStatuses]
    );

    const getUploadDownloadProgressState = useCallback(
        (sId: string, cId: string) => {
            const key = `${sId}:${cId}`;
            const status = processStatuses[key] || createDefaultProcessStatus();

            const hasDownload = status.downloadProgress > 0;
            let combinedProgress: number;
            let currentStatus: string;

            if (hasDownload) {
                // If download is actually happening
                combinedProgress = (status.uploadProgress + status.downloadProgress) / 2;
                currentStatus = status.uploadProgress < 100 ? status.uploadStatus : status.downloadStatus;
            } else {
                // No download phase, use uploadProgress directly
                combinedProgress = status.uploadProgress;
                currentStatus = status.uploadStatus;
            }

            return {
                progress: combinedProgress,
                status: currentStatus,
            };
        },
        [processStatuses]
    );

    const trackProgress = useCallback(
        (sId: string, cId: string, prog: number, stat: string) => {
            const key = `${sId}:${cId}`;
            updateProcessStatus(key, { progress: prog, status: stat });
        },
        [updateProcessStatus]
    );

    const resetProgress = useCallback(
        (sId: string, cId: string) => {
            const key = `${sId}:${cId}`;
            resetProcessStatus(key);
        },
        [resetProcessStatus]
    );

    return {
        processedData,
        error,
        isLoading,
        isFetching,

        processData,

        isProcessing,
        getProgress,
        getStatus,
        hasProcessedData,
        getProcessedData,

        trackProgress,
        resetProgress,
        getProgressState,
        getUploadDownloadProgressState,

        setError,

        updateProcessStatus,

        handleRawUploadAndProcess,

        totalProcessedItems: Object.keys(processedData).length,
        hasActiveProcesses: Object.values(processStatuses).some((status) => status.isProcessing),
    };
};

export default useProcessedData;
