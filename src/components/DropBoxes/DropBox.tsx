// DropBox.tsx

import React, { useContext, useMemo, useState, memo, useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon,
  Search as SearchOutlinedIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { DropboxConfigItem } from '../../config/dropboxConfig';
import { SampleGroup } from '../../old_utils/sampleGroupUtils';
import { ProcessedDataContext } from '../../old_contexts/ProcessedDataContext';
import ProgressTracker from './ProgressTracker';

interface DropBoxProps {
  configItem: DropboxConfigItem;
  isProcessing: boolean;
  hasData: boolean;
  isLocked: boolean;
  openModal: (
    title: string,
    configItem: DropboxConfigItem,
    uploadedFiles?: File[],
  ) => void;
  sampleGroup: SampleGroup;
  onDataProcessed: (
    insertData: any,
    configItem: DropboxConfigItem,
    processedData: any,
  ) => void;
  onError: (message: string) => void;
  uploadedDataItem: any;
  openDataModal: (
    title: string,
    dataItem: any,
    configItem: DropboxConfigItem,
  ) => void;
}

const DropBox: React.FC<DropBoxProps> = memo((props) => {
  const {
    configItem,
    isProcessing: _isProcessing, // renamed to avoid confusion
    hasData,
    isLocked,
    openModal,
    sampleGroup,
    onDataProcessed,
    onError,
    uploadedDataItem,
    openDataModal,
  } = props;

  const {
    processData,
    getProgressState,
    getUploadDownloadProgressState,
  } = useContext(ProcessedDataContext)!;

  const [dragActive, setDragActive] = useState(false);

  const sampleId = sampleGroup.human_readable_sample_id;
  const configId = configItem.id;

  const progressState = useMemo(
    () => getProgressState(sampleId, configId),
    [getProgressState, sampleId, configId],
  );

  const uploadDownloadProgressState = useMemo(
    () => getUploadDownloadProgressState(sampleId, configId),
    [getUploadDownloadProgressState, sampleId, configId],
  );

  // Determine if processing is ongoing (excluding completed)
  const isProcessing = useMemo(
    () =>
      (progressState.progress > 0 && progressState.progress < 100) ||
      _isProcessing,
    [progressState.progress, _isProcessing],
  );

  // Determine if upload/download is ongoing (excluding completed)
  const isUploadingDownloading = useMemo(
    () =>
      uploadDownloadProgressState.progress > 0 &&
      uploadDownloadProgressState.progress < 100,
    [uploadDownloadProgressState.progress],
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!sampleGroup?.storage_folder) {
        onError('Storage path not found for this sample group.');
        return;
      }

      if (acceptedFiles.length === 0) {
        onError('No files were provided.');
        return;
      }

      try {
        await processData(
          configItem.processFunctionName,
          sampleGroup,
          {}, // empty modalInputs for file uploads
          acceptedFiles,
          configItem,
          onDataProcessed,
          onError,
        );
      } catch (error: any) {
        onError(error.message || 'Failed to process uploaded files');
      }
    },
    [
      sampleGroup,
      onError,
      processData,
      configItem,
      onDataProcessed,
    ],
  );

  const handleClick = useCallback(() => {
    if (!isLocked && configItem.isModalInput && !isProcessing) {
      openModal(configItem.label, configItem);
    }
  }, [isLocked, configItem, isProcessing, openModal]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        !isLocked &&
        configItem.isModalInput &&
        (e.key === 'Enter' || e.key === ' ')
      ) {
        e.preventDefault();
        handleClick();
      }
    },
    [isLocked, configItem.isModalInput, handleClick],
  );

  const handleDataClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openDataModal(configItem.label, uploadedDataItem, configItem);
    },
    [configItem.label, uploadedDataItem, configItem, openDataModal],
  );

  const accept = useMemo(() => {
    if (!configItem.expectedFileTypes) return undefined;
    return Object.fromEntries(
      Object.entries(configItem.expectedFileTypes).map(
        ([mimeType, extensions]) => [mimeType, extensions],
      ),
    );
  }, [configItem.expectedFileTypes]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept,
    disabled: isProcessing || isLocked,
    multiple: configItem.acceptsMultipleFiles ?? false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDropAccepted: () => setDragActive(false),
    onDropRejected: () => setDragActive(false),
  });

  const fileTypesDisplay = useMemo(() => {
    if (!configItem.expectedFileTypes) return null;
    return Object.values(configItem.expectedFileTypes)
      .flat()
      .join(', ');
  }, [configItem.expectedFileTypes]);

  const tooltipTitle = useMemo(() => {
    if (isLocked) {
      return 'Unable to perform this action, please contact your organization lead';
    }
    if (configItem.isModalInput) {
      if (isProcessing) {
        return progressState.status;
      }
      if (hasData) {
        return 'Click on the magnifying glass to view data';
      }
      return 'Click to input data';
    }
    if (isProcessing || isUploadingDownloading) {
      return `${progressState.status}${
        isUploadingDownloading
          ? ` | ${uploadDownloadProgressState.status}`
          : ''
      }`;
    }
    if (hasData) {
      return 'Click on the magnifying glass to view data';
    }
    return 'Drag and drop files here or click to upload';
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mt: 1,
          }}
        >
          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32 }} />
          <Tooltip title="View Data" arrow>
            <SearchOutlinedIcon
              sx={{
                color: 'text.secondary',
                fontSize: 20,
                ml: 1,
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
          pointerEvents:
            isProcessing || isUploadingDownloading ? 'none' : 'auto',
          transition: 'opacity 0.3s',
        }}
      />
    );
  }, [
    isLocked,
    isProcessing,
    progressState.progress,
    progressState.status,
    isUploadingDownloading,
    uploadDownloadProgressState.progress,
    uploadDownloadProgressState.status,
    hasData,
    handleDataClick,
  ]);

  // Define a common style for consistent height and content alignment
  const commonBoxStyles = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center',
      alignItems: 'center',
      height: '300px', // Set a fixed height
      minHeight: '200px', // Ensure minimum height
      boxSizing: 'border-box' as const,
    }),
    [],
  );

  return (
    <Tooltip title={tooltipTitle} arrow disableHoverListener={!tooltipTitle}>
      {configItem.isModalInput || isLocked ? (
        <Box
          sx={{
            ...commonBoxStyles,
            position: 'relative',
            border: '2px dashed',
            borderColor: isLocked
              ? 'grey.800' // Changed from 'grey.400' to 'grey.800' for dark theme
              : dragActive
                ? 'primary.main'
                : 'grey.300',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            cursor: isLocked ? 'not-allowed' : 'pointer',
            backgroundColor: isLocked
              ? 'grey.800' // Changed from 'grey.100' to 'grey.800' for dark theme
              : dragActive
                ? 'primary.light'
                : 'background.paper',
            transition: 'border-color 0.3s, background-color 0.3s',
          }}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
        >
          <Typography
            sx={{
              fontSize: '1rem',
              fontWeight: 500,
              mb: 1,
              color: isLocked ? 'text.disabled' : 'text.primary',
            }}
          >
            {configItem.label}
          </Typography>
          {fileTypesDisplay && (
            <Typography
              sx={{
                fontSize: '0.875rem',
                color: 'text.secondary',
                mb: 2,
              }}
            >
              {fileTypesDisplay}
            </Typography>
          )}
          {IconComponent}
          {configItem.tooltip && (
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                mt: 1,
              }}
            >
              {configItem.tooltip}
            </Typography>
          )}
        </Box>
      ) : (
        <Box
          {...getRootProps()}
          sx={{
            ...commonBoxStyles,
            position: 'relative',
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            cursor: isProcessing || isLocked ? 'not-allowed' : 'pointer',
            backgroundColor: dragActive
              ? 'primary.light'
              : isProcessing
                ? 'grey.800' // Changed from 'grey.100' to 'grey.800' for dark theme
                : 'background.paper',
            transition: 'border-color 0.3s, background-color 0.3s',
            opacity: isProcessing || isLocked ? 0.6 : 1,
          }}
          aria-disabled={isProcessing || isLocked}
        >
          <input {...getInputProps()} />
          <Typography
            sx={{
              fontSize: '1rem',
              fontWeight: 500,
              mb: 1,
              color:
                isProcessing || isLocked ? 'text.disabled' : 'text.primary',
            }}
          >
            {configItem.label}
          </Typography>
          {fileTypesDisplay && (
            <Typography
              sx={{
                fontSize: '0.875rem',
                color: 'text.secondary',
                mb: 2,
              }}
            >
              {fileTypesDisplay}
            </Typography>
          )}
          {IconComponent}
          {configItem.tooltip && (
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                mt: 1,
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
      )}
    </Tooltip>
  );
});

export default DropBox;
