import { memo, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon,
  Search as SearchOutlinedIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import type { DropboxConfigItem } from '../../config/dropboxConfig';
import type { SampleGroup } from '../../lib/types';
import { useProcessedData } from '../../lib/hooks/useProcessedData';
import ProgressTracker from './ProgressTracker';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

interface DropBoxProps {
  configItem: DropboxConfigItem;
  isProcessing: boolean;
  hasData: boolean;
  isLocked: boolean;
  openModal: (title: string, configItem: DropboxConfigItem, uploadedFiles?: File[]) => void;
  sampleGroup: SampleGroup;
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

  const sampleId = sampleGroup.human_readable_sample_id;
  const configId = configItem.id;

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
              onError
          );
        } catch (error: any) {
          onError(error.message || 'Failed to process uploaded files');
        }
      },
      [sampleGroup, processData, configItem, onDataProcessed, onError]
  );

  const handleClick = useCallback(() => {
    if (!isLocked && configItem.isModalInput && !isProcessing) {
      openModal(configItem.label, configItem);
    }
  }, [isLocked, configItem, isProcessing, openModal]);

  const handleDataClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        openDataModal(configItem.label, uploadedDataItem, configItem);
      },
      [configItem.label, uploadedDataItem, configItem, openDataModal]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: configItem.expectedFileTypes ?
        Object.fromEntries(
            Object.entries(configItem.expectedFileTypes).map(
                ([mimeType, extensions]) => [mimeType, extensions]
            )
        ) : undefined,
    disabled: isProcessing || isLocked,
    multiple: configItem.acceptsMultipleFiles ?? false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDropAccepted: () => setDragActive(false),
    onDropRejected: () => setDragActive(false),
  });

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
            {...(configItem.isModalInput || isLocked ? {} : getRootProps())}
            onClick={configItem.isModalInput ? handleClick : undefined}
            sx={getBoxStyles}
        >
          {!configItem.isModalInput && <input {...getInputProps()} />}

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