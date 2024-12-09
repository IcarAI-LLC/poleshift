// src/components/UploadQueueStatus.tsx
import { useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, LinearProgress, IconButton,
    Tooltip, Card, CardHeader, CardContent, Divider, Snackbar, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { UploadTask, removeFromQueue } from '../lib/utils/uploadQueue';

interface UploadQueueStatusProps {
    isExpanded: boolean;
    onClose: () => void;
    queuedUploads: UploadTask[];
    setQueuedUploads: React.Dispatch<React.SetStateAction<UploadTask[]>>;
}

const UploadQueueStatus: React.FC<UploadQueueStatusProps> = ({
                                                                 isExpanded,
                                                                 onClose,
                                                                 queuedUploads,
                                                                 setQueuedUploads
                                                             }) => {
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({
        open: false,
        message: '',
        severity: 'success',
    });

    const getStatusIcon = (status: string, retries: number) => {
        if (status === 'error' || retries >= 3) {
            return <ErrorOutlineIcon color="error" />;
        }
        if (status === 'queued' && retries > 0) {
            return <WarningAmberIcon color="warning" />;
        }
        if (status === 'success') {
            return <CheckCircleOutlineIcon color="success" />;
        }
        return null;
    };

    const getStatusColor = (status: string, retries: number) => {
        if (status === 'error' || retries >= 3) return 'error.main';
        if (status === 'queued' && retries > 0) return 'warning.main';
        if (status === 'success') return 'success.main';
        return 'text.secondary';
    };

    const handleRemove = async (id: string) => {
        await removeFromQueue(id);
        setQueuedUploads(prev => prev.filter(upload => upload.id !== id));
        setSnackbar({
            open: true,
            message: 'Upload removed from queue.',
            severity: 'warning',
        });
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    if (!isExpanded) {
        return null;
    }

    return (
        <>
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                onClick={onClose}
            >
                <Card
                    sx={{
                        width: 800,
                        maxHeight: '80vh',
                        margin: 2,
                    }}
                    elevation={4}
                    onClick={(e) => e.stopPropagation()}
                >
                    <CardHeader
                        title="Upload Queue"
                        action={
                            <IconButton onClick={onClose} size="small">
                                <CloseIcon />
                            </IconButton>
                        }
                        sx={{
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            py: 1,
                        }}
                    />
                    <Divider />
                    <CardContent
                        sx={{
                            maxHeight: 'calc(80vh - 64px)',
                            overflowY: 'auto',
                            padding: 2,
                        }}
                    >
                        {queuedUploads.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" align="center">
                                No uploads in the queue.
                            </Typography>
                        ) : (
                            <List>
                                {queuedUploads.map(upload => (
                                    <ListItem
                                        key={upload.id}
                                        sx={{
                                            flexDirection: 'column',
                                            alignItems: 'stretch',
                                            paddingY: 1,
                                            bgcolor: 'background.paper',
                                            borderRadius: 1,
                                            mb: 1,
                                            border: 1,
                                            borderColor: 'divider'
                                        }}
                                    >
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%'
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {getStatusIcon(upload.status, upload.retries)}
                                                <ListItemText
                                                    primary={upload.file.name}
                                                    secondary={`Path: ${upload.path}`}
                                                />
                                            </Box>
                                            <Tooltip title="Remove">
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => handleRemove(upload.id)}
                                                >
                                                    <CloseIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <Box sx={{ width: '100%', mt: 1 }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={upload.progress || 0}
                                                sx={{
                                                    height: 8,
                                                    borderRadius: 4,
                                                    bgcolor: 'grey.200',
                                                    '& .MuiLinearProgress-bar': {
                                                        bgcolor: getStatusColor(upload.status, upload.retries)
                                                    }
                                                }}
                                            />
                                            <Box sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                mt: 0.5
                                            }}>
                                                <Typography variant="caption" color={getStatusColor(upload.status, upload.retries)}>
                                                    {upload.progress ? `${upload.progress.toFixed(0)}%` : 'Queued'}
                                                </Typography>
                                                <Typography variant="caption" color={getStatusColor(upload.status, upload.retries)}>
                                                    {upload.retries > 0 ? `Retry ${upload.retries}/3` : upload.status}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </CardContent>
                </Card>
            </Box>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default UploadQueueStatus;