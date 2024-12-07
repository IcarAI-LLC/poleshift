import { useEffect, useState, useRef } from 'react';
import { Box, Typography, List, ListItem, ListItemText, LinearProgress, IconButton, Tooltip, Card, CardHeader, CardContent, Divider, Snackbar, Alert, Badge } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getAllQueuedUploads, UploadTask, removeFromQueue } from '../lib/utils/uploadQueue';
import { useStorage } from '../lib/hooks';

const UploadQueueStatus = () => {
    const [queuedUploads, setQueuedUploads] = useState<UploadTask[]>([]);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const { fileExists } = useStorage();
    const previousQueueRef = useRef<UploadTask[]>([]);

    useEffect(() => {
        const fetchQueuedUploads = async () => {
            const uploads = await getAllQueuedUploads();
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

            previousQueueRef.current = updatedUploads;
            setQueuedUploads(updatedUploads);

            // Auto-expand when new uploads are added
            if (updatedUploads.length > previousQueueRef.current.length) {
                setIsExpanded(true);
            }
        };

        fetchQueuedUploads();
        const interval = setInterval(fetchQueuedUploads, 5000);
        return () => clearInterval(interval);
    }, [fileExists]);

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

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <>
            <Box sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 1300,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end'
            }}>
                <Card
                    sx={{
                        width: 350,
                        transition: 'all 0.3s ease-in-out',
                        maxHeight: isExpanded ? '500px' : '64px',
                        overflow: 'hidden'
                    }}
                    elevation={4}
                >
                    <CardHeader
                        title={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h6" component="div">
                                    Upload Queue
                                </Typography>
                                {queuedUploads.length > 0 && (
                                    <Badge
                                        badgeContent={queuedUploads.length}
                                        color="secondary"
                                        sx={{ ml: 1 }}
                                    />
                                )}
                            </Box>
                        }
                        action={
                            <Tooltip title={isExpanded ? "Minimize" : "Expand"}>
                                <IconButton onClick={toggleExpanded}>
                                    {isExpanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                                </IconButton>
                            </Tooltip>
                        }
                        sx={{
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            py: 1
                        }}
                    />
                    <Divider />
                    <CardContent
                        sx={{
                            maxHeight: '400px',
                            overflowY: 'auto',
                            padding: 1,
                            display: isExpanded ? 'block' : 'none'
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
                                            paddingY: 1
                                        }}
                                    >
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%'
                                        }}>
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
                                            <Box sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                mt: 0.5
                                            }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {upload.progress ? `${upload.progress.toFixed(0)}%` : 'Queued'}
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