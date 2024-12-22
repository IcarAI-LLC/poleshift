// src/lib/components/DropBox.tsx

import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import {
    Add as AddIcon,
    CheckCircle as CheckCircleIcon,
    Lock as LockIcon,
    Search as SearchOutlinedIcon,
} from '@mui/icons-material';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleGroupMetadata, Organization } from '../../lib/types';
import ProgressTracker from './ProgressTracker';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { open } from '@tauri-apps/plugin-dialog';
import { useNetworkStatus } from '../../lib/hooks/useNetworkStatus';

interface DropBoxProps {
    configItem: DropboxConfigItem;
    isProcessing: boolean;
    hasData: boolean;
    isLocked: boolean; // If locked, user cannot upload
    openModal: (title: string, configItem: DropboxConfigItem, uploadedFiles?: string[]) => void;
    sampleGroup: SampleGroupMetadata;
    onError: (message: string) => void;
    uploadedDataItem: any;
    openDataModal: (title: string, dataItem: any, configItem: DropboxConfigItem) => void;
    getProgressState: (sId: string, cId: string) => { progress: number; status: string };
    getUploadDownloadProgressState: (sId: string, cId: string) => { progress: number; status: string };
    handleRawUploadAndProcess: (
        configItem: DropboxConfigItem,
        group: SampleGroupMetadata,
        filePaths: string[],
        inputs: Record<string, any>,
        onError: (message: string) => void,
        isOffline: boolean
    ) => Promise<void>;
    organization: Organization | null;
}

const DropBox = memo(({
                          configItem,
                          isProcessing,
                          hasData,
                          isLocked,
                          openModal,
                          sampleGroup,
                          onError,
                          uploadedDataItem,
                          openDataModal,
                          getProgressState,
                          getUploadDownloadProgressState,
                          handleRawUploadAndProcess,
                          organization,
                      }: DropBoxProps) => {
    const [dragActive, setDragActive] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);
    const { isOnline } = useNetworkStatus();

    const sampleId = sampleGroup.id;
    const configId = configItem.id;

    const progressState = getProgressState(sampleId, configId);
    const uploadDownloadProgressState = getUploadDownloadProgressState(sampleId, configId);

    /**
     * Handle file selection (upload). Prevent if locked (and no data).
     */
    const handleFileSelect = useCallback(async () => {
        // If locked, bail out (prevent new uploads).
        // But we do NOT handle data viewing here;
        // the magnifying glass has its own onClick handler for that.
        if (isLocked) {
            onError('DropBox is locked.');
            return;
        }

        // If this config requires only modal input (no file upload)
        if (configItem.isModalInput && !isProcessing) {
            openModal(configItem.label, configItem);
            return;
        }

        // Otherwise, open file dialog for upload
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
            }) as string | string[] | null;

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

            // Upload and process
            await handleRawUploadAndProcess(
                configItem,
                sampleGroup,
                filePaths,
                {},
                (errorMessage) => {
                    onError(errorMessage);
                },
                !isOnline
            );
        } catch (error: any) {
            console.error('File selection error:', error);
            onError(error.message || 'Failed to select files');
        }
    }, [
        isLocked,
        configItem,
        isProcessing,
        openModal,
        onError,
        handleRawUploadAndProcess,
        sampleGroup,
        organization,
        isOnline,
    ]);

    /**
     * Drag-and-drop events (Tauri does not support reading actual file paths).
     */
    const handleDragEnter = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLocked || configItem.isModalInput) return;
            setDragActive(true);
        },
        [isLocked, configItem.isModalInput]
    );

    const handleDragOver = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLocked || configItem.isModalInput) return;
            setDragActive(true);
        },
        [isLocked, configItem.isModalInput]
    );

    const handleDragLeave = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLocked || configItem.isModalInput) return;
            setDragActive(false);
        },
        [isLocked, configItem.isModalInput]
    );

    const handleDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLocked || configItem.isModalInput) return;
            setDragActive(false);

            // We do not actually read file paths from drag events in Tauri
            onError('Drag-and-drop file path retrieval is not supported. Please use the file selection dialog.');
        },
        [isLocked, configItem.isModalInput, onError]
    );

    useEffect(() => {
        const div = dropRef.current;
        if (!div) return;

        div.addEventListener('dragenter', handleDragEnter);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('dragleave', handleDragLeave);
        div.addEventListener('drop', handleDrop);

        return () => {
            div.removeEventListener('dragenter', handleDragEnter);
            div.removeEventListener('dragover', handleDragOver);
            div.removeEventListener('dragleave', handleDragLeave);
            div.removeEventListener('drop', handleDrop);
        };
    }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

    /**
     * Allow user to view data if it exists (hasData = true).
     * This is triggered by the magnifying glass icon (not the container).
     */
    const handleDataClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            openDataModal(configItem.label, uploadedDataItem, configItem);
        },
        [configItem.label, uploadedDataItem, configItem, openDataModal]
    );

    /**
     * Check if we are currently uploading/downloading
     */
    const isUploadingDownloading = useMemo(() => {
        return (
            uploadDownloadProgressState.progress > 0 &&
            uploadDownloadProgressState.progress < 100
        );
    }, [uploadDownloadProgressState.progress]);

    /**
     * Build the tooltip text based on the current state
     */
    const tooltipTitle = useMemo(() => {
        // If locked but has data, user can still click the magnifying glass (icon) to see it.
        // However, the container is locked for new uploads.
        if (isLocked && !hasData) {
            return 'Unable to perform this action, please contact your organization lead';
        }

        if (configItem.isModalInput) {
            if (isProcessing) return progressState.status;
            if (hasData) return 'Click on the magnifying glass to view data';
            return 'Click to input data';
        }

        if (isProcessing || isUploadingDownloading) {
            return `${progressState.status}${
                isUploadingDownloading ? ` | ${uploadDownloadProgressState.status}` : ''
            }`;
        }

        if (hasData) {
            return 'Click on the magnifying glass to view data';
        }

        // Default
        return 'Click to select files or drag and drop them here';
    }, [
        isLocked,
        hasData,
        configItem.isModalInput,
        isProcessing,
        progressState.status,
        isUploadingDownloading,
        uploadDownloadProgressState.status,
    ]);

    /**
     * Decide which icon(s) to show.
     * 1. If locked & has NO data => show Lock icon
     * 2. If locked & has data => show Check icon + Magnifying Glass
     * 3. Otherwise, fallback to existing logic
     */
    const IconComponent = useMemo(() => {
        // (A) Locked & no data => Lock
        if (isLocked && !hasData) {
            return <LockIcon sx={{ fontSize: 32, color: 'text.disabled' }} />;
        }

        // (B) Locked & has data => show check + magnifying glass
        if (isLocked && hasData) {
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
                            onClick={handleDataClick}
                        />
                    </Tooltip>
                </Box>
            );
        }

        // (C) Not locked, but isProcessing => show progress
        if (isProcessing) {
            return (
                <ProgressTracker
                    progress={progressState.progress}
                    status={progressState.status}
                    showPercentage
                    type="processing"
                />
            );
        }

        // (D) Not locked, but uploading/downloading => show that progress
        if (isUploadingDownloading) {
            return (
                <ProgressTracker
                    progress={uploadDownloadProgressState.progress}
                    status={uploadDownloadProgressState.status}
                    showPercentage
                    type="uploadDownload"
                />
            );
        }

        // (E) Not locked, data present => check + magnifying glass
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
                            onClick={handleDataClick}
                        />
                    </Tooltip>
                </Box>
            );
        }

        // (F) Not locked, no data => show Add icon
        return (
            <AddIcon
                sx={{
                    fontSize: 32,
                    color: 'text.primary',
                    opacity: isProcessing || isUploadingDownloading ? 0.5 : 1,
                    pointerEvents: isProcessing || isUploadingDownloading ? 'none' : 'auto',
                    transition: 'opacity 0.3s',
                }}
            />
        );
    }, [
        isLocked,
        hasData,
        isProcessing,
        progressState,
        isUploadingDownloading,
        uploadDownloadProgressState,
        handleDataClick,
    ]);

    /**
     * Common styles for the box
     */
    const commonBoxStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        alignItems: 'center',
        height: '300px',
        minHeight: '200px',
        boxSizing: 'border-box' as const,
    };

    /**
     * Merge in dynamic styles
     * - If locked and no data => pointerEvents 'none' so the entire box is non-clickable
     * - Else => 'auto', so we can handle the file selection or let user see data
     */
    const getBoxStyles = useMemo(
        (): SxProps<Theme> => ({
            ...commonBoxStyles,
            position: 'relative',
            border: '2px dashed',
            borderColor: isLocked && !hasData ? 'grey.800' : dragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            // only block pointer events if locked + no data
            pointerEvents: isLocked && !hasData ? 'none' : 'auto',
            cursor: isLocked && !hasData ? 'not-allowed' : 'pointer',

            backgroundColor:
                isLocked && !hasData
                    ? 'grey.800'
                    : dragActive
                        ? 'primary.light'
                        : 'background.paper',
            transition: 'all 0.3s ease',
            opacity: isProcessing || (isLocked && !hasData) ? 0.6 : 1,
            '&:hover': {
                borderColor: isLocked && !hasData ? 'grey.800' : 'primary.main',
                backgroundColor: isLocked && !hasData ? 'grey.800' : 'action.hover',
            },
        }),
        [isLocked, hasData, dragActive, isProcessing]
    );

    return (
        <Tooltip title={tooltipTitle} arrow>
            {/*
        If locked and has NO data => the container is pointerEvents none (above).
        If locked but has data => user can't upload, but the magnifying glass is clickable.
        If not locked => user can upload by clicking the container.
      */}
            <Box ref={dropRef} onClick={handleFileSelect} sx={getBoxStyles}>
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
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'text.secondary',
                            mb: 2,
                        }}
                    >
                        {Object.values(configItem.expectedFileTypes).flat().join(', ')}
                    </Typography>
                )}

                {IconComponent}

                {configItem.tooltip && (
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'text.secondary',
                            mt: 1,
                        }}
                    >
                        {configItem.tooltip}
                    </Typography>
                )}

                {/* Drag overlay */}
                {dragActive && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'primary.light',
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.8,
                            pointerEvents: 'none',
                        }}
                    >
                        <Typography
                            sx={{
                                color: 'primary.contrastText',
                                fontWeight: 500,
                            }}
                        >
                            Drop files here
                        </Typography>
                    </Box>
                )}
            </Box>
        </Tooltip>
    );
});

export default DropBox;
