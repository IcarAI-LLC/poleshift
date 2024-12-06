// src/lib/components/UploadQueueStatus.tsx

import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    LinearProgress,
    IconButton,
    Tooltip,
    Card,
    CardHeader,
    CardContent,
    Divider,
    Snackbar,
    Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getAllQueuedUploads, UploadTask, removeFromQueue } from '../lib/utils/uploadQueue';
import { useStorage } from '../lib/hooks/index.ts';

const UploadQueueStatus: React.FC = () => {
    const [queuedUploads, setQueuedUploads] = useState<UploadTask[]>([]);
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const { fileExists } = useStorage();

    useEffect(() => {
        const fetchQueuedUploads = async () => {
            const uploads = await getAllQueuedUploads();

            // Check if files already exist and remove them from the queue
            const updatedUploads: UploadTask[] = [];
            for (const upload of uploads) {
                const exists = await fileExists(upload.path);
                if (exists) {
                    await removeFromQueue(upload.id);
                    setSnackbar({
                        open: true,
                        message: `File "${upload.file.name}" already exists. Removed from queue.`,
                        //@ts-ignore
                        severity: 'info',
                    });
                } else {
                    updatedUploads.push(upload);
                }
            }

            setQueuedUploads(updatedUploads);
            setIsVisible(updatedUploads.length > 0);
        };

        fetchQueuedUploads();

        // Set up an interval to poll for queue updates every 5 seconds
        const interval = setInterval(fetchQueuedUploads, 5000);

        return () => clearInterval(interval);
    }, [fileExists]);

    const handleRemove = async (id: string) => {
        await removeFromQueue(id);
        setQueuedUploads(prev => prev.filter(upload => upload.id !== id));
        setSnackbar({
            open: true,
            message: 'Upload removed from queue.',
            //@ts-ignore
            severity: 'warning',
        });
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    if (!isVisible) return null;

    return (
        <>
            <Card
                sx={{
                    position: 'fixed',
                    bottom: 16,
                    right: 16,
                    width: 350,
                    zIndex: 1300, // Ensure it appears above other elements
                    boxShadow: 6,
                }}
            >
                <CardHeader
                    title="Upload Queue"
                    action={
                        <Tooltip title="Close">
                            <IconButton onClick={() => setIsVisible(false)}>
                                <CloseIcon />
                            </IconButton>
                        </Tooltip>
                    }
                    sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
                />
                <Divider />
                <CardContent>
                    <List>
                        {queuedUploads.map(upload => (
                            <ListItem key={upload.id} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <ListItemText
                                        primary={
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {upload.file.name}
                                            </Typography>
                                        }
                                        secondary={`Path: ${upload.path}`}
                                    />
                                    <Tooltip title="Remove">
                                        <IconButton edge="end" size="small" onClick={() => handleRemove(upload.id)}>
                                            <CloseIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                <Box sx={{ width: '100%', mt: 1 }}>
                                    <LinearProgress variant="determinate" value={upload.progress || 0} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                        <Typography variant="caption" color="textSecondary">
                                            {upload.progress ? `${upload.progress.toFixed(0)}%` : 'Queued'}
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            {upload.status}
                                        </Typography>
                                    </Box>
                                </Box>
                            </ListItem>
                        ))}
                    </List>
                </CardContent>
            </Card>
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
