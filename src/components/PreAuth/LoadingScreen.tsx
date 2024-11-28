import { Box, Typography, CircularProgress } from '@mui/material';

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
                className="mb-4 text-gray-100 font-medium"
            >
                {message}
            </Typography>

            <Typography
                variant="body1"
                className="text-gray-400 max-w-md text-center"
            >
                Please wait while we initialize your workspace and sync your data
            </Typography>
        </Box>
    );
};

export default LoadingScreen;