import { CircularProgress, Typography, Box } from '@mui/material';

const LoadingScreen = ({
                           message = 'Loading application...',
                           showRefreshHint = true,
                           size = 44
                       }) => {
    const getDetailMessage = () => {
        if (message.includes("Authenticating")) {
            return "Verifying your credentials and retrieving your user profile...";
        }
        if (message.includes("Loading your profile")) {
            return "Setting up your workspace and preparing the application...";
        }
        if (message.includes("Syncing")) {
            return "Retrieving and synchronizing your data with the server...";
        }
        return "Preparing your workspace...";
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)'
            }}
        >
            <Box sx={{ position: 'relative', mb: 4 }}>
                <CircularProgress
                    size={size}
                    thickness={4}
                    sx={{
                        color: 'var(--color-primary)',
                        position: 'relative',
                        zIndex: 1
                    }}
                />
            </Box>

            <Typography
                variant="h5"
                sx={{
                    mb: 2,
                    color: 'var(--color-text)',
                    fontWeight: 500,
                    textAlign: 'center',
                    px: 2
                }}
            >
                {message}
            </Typography>

            <Box sx={{ maxWidth: '400px', px: 2 }}>
                <Typography
                    variant="body1"
                    sx={{
                        color: 'var(--color-text-muted)',
                        textAlign: 'center',
                        mb: 1
                    }}
                >
                    {getDetailMessage()}
                </Typography>

                {showRefreshHint && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'var(--color-text-disabled)',
                            textAlign: 'center',
                            fontSize: 'var(--font-size-small)'
                        }}
                    >
                        This should take no longer than a minute...
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default LoadingScreen;