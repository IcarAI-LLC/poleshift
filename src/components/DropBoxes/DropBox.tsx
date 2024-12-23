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
// Removed unused import: getAllQueuedUploads

interface DropBoxProps {
    configItem: DropboxConfigItem;
    isProcessing: boolean;
    hasData: boolean;
    isLocked: boolean;
    openModal: (title: string, configItem: DropboxConfigItem, uploadedFiles?: string[]) => void;
    sampleGroup: SampleGroupMetadata;
    onError: (message: string) => void;
    uploadedDataItem: any;
    openDataModal: (title: string, dataItem: any, configItem: DropboxConfigItem) => void;
    getProgressState: (sId: string, cId: string) => { progress: number; status: string; };
    getUploadDownloadProgressState: (sId: string, cId: string) => { progress: number; status: string; };
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
                          organization
                      }: DropBoxProps) => {
    const [dragActive, setDragActive] = useState(false);
    // Removed isQueued state
    const dropRef = useRef<HTMLDivElement>(null);
    const { isOnline } = useNetworkStatus();

    const sampleId = sampleGroup.id;
    const configId = configItem.id;

    const progressState = getProgressState(sampleId, configId);
    const uploadDownloadProgressState = getUploadDownloadProgressState(sampleId, configId);

    // Removed useEffect for isQueued

    const handleFileSelect = useCallback(async () => {
        if (isLocked) {
            onError('DropBox is locked.');
            return;
        }

        // If this config requires modal input instead of a file upload
        if (configItem.isModalInput && !isProcessing) {
            openModal(configItem.label, configItem);
            return;
        }

        try {
            const selectedPaths = await open({
                multiple: configItem.acceptsMultipleFiles ?? false,
                directory: false,
                filters: configItem.expectedFileTypes
                    ? Object.entries(configItem.expectedFileTypes).map(([mime, extensions]) => ({
                        name: mime,
                        extensions: extensions.map(ext => ext.replace('.', '')),
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

            await handleRawUploadAndProcess(configItem, sampleGroup, filePaths, {}, (errorMessage) => {
                onError(errorMessage);
            }, !isOnline);

        } catch (error: any) {
            console.error('File selection error:', error);
            onError(error.message || 'Failed to select files');
        }
    }, [isLocked, configItem, isProcessing, openModal, onError, handleRawUploadAndProcess, sampleGroup, organization, isOnline]);

    // Drag-and-drop Handlers (unchanged)
    const handleDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLocked || configItem.isModalInput) return;
        setDragActive(true);
    }, [isLocked, configItem.isModalInput]);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLocked || configItem.isModalInput) return;
        setDragActive(true);
    }, [isLocked, configItem.isModalInput]);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLocked || configItem.isModalInput) return;
        setDragActive(false);
    }, [isLocked, configItem.isModalInput]);

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLocked || configItem.isModalInput) return;
        setDragActive(false);

        // Drag-and-drop file paths is not supported
        onError('Drag-and-drop file path retrieval is not supported. Please use the file selection dialog.');
    }, [isLocked, configItem.isModalInput, onError]);

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

    const handleDataClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        openDataModal(configItem.label, uploadedDataItem, configItem);
    }, [configItem.label, uploadedDataItem, configItem, openDataModal]);

    const isUploadingDownloading = useMemo(
        () => uploadDownloadProgressState.progress > 0 && uploadDownloadProgressState.progress < 100,
        [uploadDownloadProgressState.progress]
    );

    const tooltipTitle = useMemo(() => {
        if (isLocked) return 'Unable to perform this action, please contact your organization lead';
        if (configItem.isModalInput) {
            if (isProcessing) return progressState.status;
            if (hasData) return 'Click on the magnifying glass to view data';
            return 'Click to input data';
        }
        if (isProcessing || isUploadingDownloading) {
            return `${progressState.status}${isUploadingDownloading ? ` | ${uploadDownloadProgressState.status}` : ''}`;
        }
        if (hasData) return 'Click on the magnifying glass to view data';
        return 'Click to select files or drag and drop them here';
    }, [isLocked, configItem.isModalInput, isProcessing, progressState.status, hasData, isUploadingDownloading, uploadDownloadProgressState.status]);

    const IconComponent = useMemo(() => {
        if (isLocked) {
            return <LockIcon sx={{ fontSize: 32, color: 'text.disabled' }} />;
        }

        if (isProcessing) {
            // While processing, show progress
            return (
                <ProgressTracker
                    progress={progressState.progress}
                    status={progressState.status}
                    showPercentage
                    type="processing"
                />
            );
        }

        if (isUploadingDownloading) {
            // While uploading/downloading, show that state
            return (
                <ProgressTracker
                    progress={uploadDownloadProgressState.progress}
                    status={uploadDownloadProgressState.status}
                    showPercentage
                    type="uploadDownload"
                />
            );
        }

        if (hasData) {
            // Once processing completes and data is available, show check and search icon
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

        // Default state: show AddIcon
        return (
            <AddIcon
                sx={{
                    fontSize: 32,
                    color: 'text.primary',
                    opacity: isProcessing || isUploadingDownloading ? 0.5 : 1, // Removed isQueued
                    pointerEvents: isProcessing || isUploadingDownloading ? 'none' : 'auto', // Removed isQueued
                    transition: 'opacity 0.3s',
                }}
            />
        );
    }, [isLocked, isProcessing, progressState, isUploadingDownloading, uploadDownloadProgressState, hasData, handleDataClick]);

    const commonBoxStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        alignItems: 'center',
        height: '300px',
        minHeight: '200px',
        boxSizing: 'border-box' as const,
    };

    const getBoxStyles = useMemo((): SxProps<Theme> => ({
        ...commonBoxStyles,
        position: 'relative',
        border: '2px dashed',
        borderColor: isLocked ? 'grey.800' : dragActive ? 'primary.main' : 'grey.300',
        borderRadius: 2,
        p: 2,
        textAlign: 'center',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        backgroundColor: isLocked ? 'grey.800' : dragActive ? 'primary.light' : 'background.paper',
        transition: 'all 0.3s ease',
        opacity: isProcessing || isLocked ? 0.6 : 1, // Removed isQueued
        '&:hover': {
            borderColor: isLocked ? 'grey.800' : 'primary.main',
            backgroundColor: isLocked ? 'grey.800' : 'action.hover',
        },
    }), [isLocked, dragActive, isProcessing]);

    return (
        <Tooltip title={tooltipTitle} arrow>
            <Box
                ref={dropRef}
                onClick={handleFileSelect}
                sx={getBoxStyles}
            >
                <Typography
                    variant="h6"
                    sx={{
                        mb: 1,
                        color: isLocked ? 'text.disabled' : 'text.primary'
                    }}
                >
                    {configItem.label}
                </Typography>

                {configItem.expectedFileTypes && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'text.secondary',
                            mb: 2
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
                            mt: 1
                        }}
                    >
                        {configItem.tooltip}
                    </Typography>
                )}

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
                                fontWeight: 500
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
