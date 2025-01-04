import { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import ContainerVisualization from './ContainerVisualization';

const ContainerScreen = () => {
    const [isVisualizationOpen, setIsVisualizationOpen] = useState(false);

    return (
        <Box sx={{ p: 4 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 4
                }}
            >
                <Typography variant="h5">Container Analysis</Typography>
                <Button
                    variant="contained"
                    startIcon={<QueryStatsIcon />}
                    onClick={() => setIsVisualizationOpen(true)}
                >
                    Open Query Builder
                </Button>
            </Box>

            <Typography color="text.secondary" sx={{ mb: 2 }}>
                Use the Query Builder to analyze taxonomic distributions across different locations and time periods.
            </Typography>

            <ContainerVisualization
                open={isVisualizationOpen}
                onClose={() => setIsVisualizationOpen(false)}
            />
        </Box>
    );
};

export default ContainerScreen;