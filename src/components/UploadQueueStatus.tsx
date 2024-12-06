// src/lib/components/UploadQueueStatus.tsx

import React, { useEffect, useState, useRef } from 'react';
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
    Badge,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getAllQueuedUploads, UploadTask, removeFromQueue } from '../lib/utils/uploadQueue';
import { useStorage } from '../lib/hooks/index.ts';

const UploadQueueStatus: React.FC = () => {
    const [queuedUploads, setQueuedUploads] = useState<UploadTask[]>([]);
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [isManuallyClosed, setIsManuallyClosed] = useState<boolean>(false);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const [newUploads, setNewUploads] = useState<number>(0);
    const { fileExists } = useStorage();
    const previousQueueRef = useRef<UploadTask[]>([]); // To track previous queue for detecting new uploads

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
                        severity: 'info',
                    });
                } else {
                    updatedUploads.push(upload);
                }
            }

            // Detect new uploads
            const previousIds = previousQueueRef.current.map(u => u.id);
            const currentIds = updatedUploads.map(u => u.id);
            const newUploadCount = currentIds.filter(id => !previousIds.includes(id)).length;
            if (newUploadCount > 0 && isManuallyClosed) {
                setNewUploads(prev => prev + newUploadCount);
            }

            previousQueueRef.current = updatedUploads;

            setQueuedUploads(updatedUploads);
            if (!isManuallyClosed) {
                setIsVisible(updatedUploads.length > 0);
            }
        };

        fetchQueuedUploads();

        // Set up an interval to poll for queue updates every 5 seconds
        const interval = setInterval(fetchQueuedUploads, 5000);

        return () => clearInterval(interval);
    }, [fileExists, isManuallyClosed]);

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

    const handleCloseQueue = () => {
        setIsVisible(false);
        setIsManuallyClosed(true);
        setNewUploads(0); // Reset new uploads count
    };

    const handleOpenQueue = () => {
        setIsVisible(true);
        setIsManuallyClosed(false);
        setNewUploads(0); // Reset new uploads count
    };

    if (!isVisible && newUploads === 0) return null;

    return (
        <>
            <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1300 }}>
                <Badge
                    badgeContent={newUploads}
                    color="secondary"
                    invisible={newUploads === 0}
                    overlap="rectangular"
                    anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                >
                    <Card
                        sx={{
                            width: 350,
                            boxShadow: 6,
                            transition: 'transform 0.3s ease-in-out',
                            transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
                        }}
                        elevation={4}
                    >
                        <CardHeader
                            title="Upload Queue"
                            action={
                                isVisible ? (
                                    <Tooltip title="Close">
                                        <IconButton onClick={handleCloseQueue}>
                                            <CloseIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : (
                                    newUploads > 0 && (
                                        <Tooltip title="View New Uploads">
                                            <IconButton onClick={handleOpenQueue}>
                                                <Badge badgeContent={newUploads} color="secondary">
                                                    <CloseIcon /> {/* Consider a different icon for "open" */}
                                                </Badge>
                                            </IconButton>
                                        </Tooltip>
                                    )
                                )
                            }
                            sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
                        />
                        <Divider />
                        <CardContent
                            sx={{
                                maxHeight: '400px', // Set a max height
                                overflowY: 'auto', // Enable vertical scrolling
                                padding: 1,
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
                                            alignItems="flex-start"
                                            sx={{
                                                flexDirection: 'column',
                                                alignItems: 'stretch',
                                                paddingY: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '100%',
                                                }}
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            {upload.file.name}
                                                        </Typography>
                                                    }
                                                    secondary={`Path: ${upload.path}`}
                                                />
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
                                                    sx={{ height: 8, borderRadius: 4 }}
                                                />
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    <Typography variant="caption" color="text.secondary">
                                                        {upload.progress
                                                            ? `${upload.progress.toFixed(0)}%`
                                                            : 'Queued'}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {upload.status}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </ListItem>
                                    ))}
                                </List>
                            )}
                        </CardContent>
                        {!isVisible && newUploads > 0 && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    padding: 1,
                                    backgroundColor: 'grey.100',
                                }}
                            >
                                <Typography variant="body2" color="text.secondary">
                                    {newUploads} new upload{newUploads > 1 ? 's' : ''} added.
                                </Typography>
                                <IconButton onClick={handleOpenQueue} size="small" sx={{ ml: 1 }}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>
                        )}
                    </Card>
                </Badge>
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
