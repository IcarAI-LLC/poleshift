import { CircularProgress, Typography, Box } from '@mui/material';

const LoadingScreen = ({ message = 'Loading application...' }) => {
    return (
        <Box
            className="flex flex-col items-center justify-center min-h-screen bg-gray-900"
        >
            <Box className="relative mb-8">
                <CircularProgress
                    size={60}
                    thickness={4}
                    className="text-blue-500"
                />
                <CircularProgress
                    size={60}
                    thickness={4}
                    className="absolute top-0 left-0 text-blue-300 opacity-30"
                    variant="determinate"
                    value={100}
                />
            </Box>

            <Typography
                variant="h5"
                className="mb-4 text-gray-100 font-medium text-center"
            >
                {message}
            </Typography>

            <Box className="max-w-md text-center space-y-2">
                <Typography
                    variant="body1"
                    className="text-gray-400"
                >
                    {(() => {
                        if (message.includes("Authenticating")) {
                            return "Verifying your credentials and retrieving your user profile...";
                        }
                        if (message.includes("Syncing")) {
                            return "Retrieving and synchronizing your data with the server...";
                        }
                        return "Setting up your workspace and preparing the application...";
                    })()}
                </Typography>

                <Typography
                    variant="body2"
                    className="text-gray-500"
                >
                    If this takes longer than expected, try refreshing the page
                </Typography>
            </Box>
        </Box>
    );
};

export default LoadingScreen;