// lib/components/DropBox.tsx

import { memo, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import {
    Add as AddIcon,
    CheckCircle as CheckCircleIcon,
    Lock as LockIcon,
    Search as SearchOutlinedIcon,
} from '@mui/icons-material';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleGroupMetadata } from '../../lib/types';
import { useProcessedData } from '../../lib/hooks';
import ProgressTracker from './ProgressTracker';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useRef } from 'react';
import { useAuth } from "../../lib/hooks";

interface DropBoxProps {
    configItem: DropboxConfigItem;
    isProcessing: boolean;
    hasData: boolean;
    isLocked: boolean;
    openModal: (title: string, configItem: DropboxConfigItem, uploadedFiles?: string[]) => void;
    sampleGroup: SampleGroupMetadata;
    onDataProcessed: (insertData: any, configItem: DropboxConfigItem, processedData: any) => void;
    onError: (message: string) => void;
    uploadedDataItem: any;
    openDataModal: (title: string, dataItem: any, configItem: DropboxConfigItem) => void;
}

const DropBox = memo(({
                          configItem,
                          isProcessing: _isProcessing,
                          hasData,
                          isLocked,
                          openModal,
                          sampleGroup,
                          onDataProcessed,
                          onError,
                          uploadedDataItem,
                          openDataModal,
                      }: DropBoxProps) => {
    const [dragActive, setDragActive] = useState(false);
    const { processData, getProgressState, getUploadDownloadProgressState } = useProcessedData();
    const dropRef = useRef<HTMLDivElement>(null);

    const sampleId = sampleGroup.id; // Changed from human_readable_sample_id to sample_id
    const configId = configItem.id;
    const { organization } = useAuth();
    // Get progress states using hooks
    const progressState = useMemo(
        () => getProgressState(sampleId, configId),
        [getProgressState, sampleId, configId]
    );

    const uploadDownloadProgressState = useMemo(
        () => getUploadDownloadProgressState(sampleId, configId),
        [getUploadDownloadProgressState, sampleId, configId]
    );

    // Determine processing states
    const isProcessing = useMemo(
        () => (progressState.progress > 0 && progressState.progress < 100) || _isProcessing,
        [progressState.progress, _isProcessing]
    );

    const isUploadingDownloading = useMemo(
        () => uploadDownloadProgressState.progress > 0 && uploadDownloadProgressState.progress < 100,
        [uploadDownloadProgressState.progress]
    );

    // File Selection via Tauri Dialog
    const handleFileSelect = useCallback(async () => {
        if (isLocked) {
            onError('DropBox is locked.');
            return;
        }

        if (configItem.isModalInput && !isProcessing) {
            openModal(configItem.label, configItem);
            return;
        }

        try {
            const selectedPaths = await open({
                multiple: configItem.acceptsMultipleFiles ?? false,
                directory: false,
                filters: configItem.expectedFileTypes ? Object.entries(configItem.expectedFileTypes).map(([mime, extensions]) => ({
                    name: mime,
                    extensions: extensions.map(ext => ext.replace('.', '')),
                })) : undefined,
            }) as string | string[] | null;

            if (!selectedPaths) {
                // User canceled the dialog
                return;
            }

            const filePaths = Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths];

            if (filePaths.length === 0) {
                onError('No files were selected.');
                return;
            }
            if (!organization){
                onError('No organization found for user.');
                return;
            }
            await processData(
                configItem.processFunctionName,
                sampleGroup,
                {}, // empty modalInputs for file uploads
                filePaths,
                configItem,
                onDataProcessed,
                onError,
                organization?.org_short_id
            );
        } catch (error: any) {
            console.error('File selection error:', error);
            onError(error.message || 'Failed to select files');
        }
    }, [isLocked, configItem, isProcessing, openModal, onError, processData, sampleGroup, onDataProcessed]);

    // Custom Drag-and-Drop Handlers
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

    const handleDrop = useCallback(async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLocked || configItem.isModalInput) return;
        setDragActive(false);

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) {
            onError('No files were dropped.');
            return;
        }

        try {
            // Convert FileList to Array of File objects
            // const fileArray = Array.from(files);

            // Since File objects do not have paths, use Tauri's fs API to get paths if possible
            // Alternatively, read file contents and handle accordingly
            // Here, we'll assume that you can obtain file paths via Tauri's APIs or by other means

            // Placeholder: Implement logic to obtain file paths from File objects
            // This might require custom Tauri commands or additional setup

            // For demonstration, we'll pass the File objects directly
            // Ensure that your backend can handle File objects or adjust accordingly

            // Example: Upload file contents instead of paths
            // You might need to adjust the processData function to handle this

            // Alternatively, inform the user to use the file selection dialog for path-based uploads
            onError('Drag-and-drop file path retrieval is not supported. Please use the file selection dialog.');

            // Uncomment below if handling file contents
            /*
            const fileContents = await Promise.all(fileArray.map(file => file.text()));
            const filePaths = fileArray.map(file => file.name); // Placeholder paths

            await processData(
                configItem.processFunctionName,
                sampleGroup,
                {},
                filePaths,
                configItem,
                onDataProcessed,
                onError
            );
            */
        } catch (error: any) {
            console.error('Drop error:', error);
            onError(error.message || 'Failed to process dropped files');
        }
    }, [isLocked, configItem.isModalInput, onError, processData, sampleGroup, configItem, onDataProcessed]);

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

    const handleDataClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevents the Box's onClick from firing
            openDataModal(configItem.label, uploadedDataItem, configItem);
        },
        [configItem.label, uploadedDataItem, configItem, openDataModal]
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
    }, [
        isLocked,
        configItem.isModalInput,
        isProcessing,
        progressState.status,
        hasData,
        isUploadingDownloading,
        uploadDownloadProgressState.status,
    ]);

    const IconComponent = useMemo(() => {
        if (isLocked) {
            return <LockIcon sx={{ fontSize: 32, color: 'text.disabled' }} />;
        }

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
        isProcessing,
        progressState,
        isUploadingDownloading,
        uploadDownloadProgressState,
        hasData,
        handleDataClick,
    ]);

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
        opacity: isProcessing || isLocked ? 0.6 : 1,
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
                            pointerEvents: 'none', // Allow clicks to pass through
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
