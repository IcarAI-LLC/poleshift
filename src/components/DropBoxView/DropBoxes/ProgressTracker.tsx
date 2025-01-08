// ProgressTracker.tsx

import React, { memo, useMemo } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ProgressTrackerProps {
  progress: number;
  status: string;
  showPercentage?: boolean;
  type: 'processing';
}

const ProgressTracker: React.FC<ProgressTrackerProps> = memo(
  ({ progress, status, showPercentage = false, type }) => {

    // Memoize the color based on type
    const progressColor = useMemo(() => {
      return type === 'processing' ? 'secondary' : 'primary';
    }, [type]);

    return (
      <Box
        sx={{
          width: '100%',
          textAlign: 'center',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.875rem',
            fontWeight: 500,
            mb: 1,
            color: 'text.primary',
          }}
        >
          {status}
        </Typography>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgressWithLabel
            value={progress}
            color={progressColor}
            showPercentage={showPercentage}
          />
        </Box>
      </Box>
    );
  },
);

interface CircularProgressWithLabelProps {
  value: number;
  color: 'primary' | 'secondary';
  showPercentage: boolean;
}

const CircularProgressWithLabel: React.FC<CircularProgressWithLabelProps> = memo(
  ({ value, color, showPercentage }) => {
    return (
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={value}
          color={color}
          size={40}
        />
        {showPercentage && (
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="caption"
              component="div"
              color="text.secondary"
            >{`${Math.round(value)}%`}</Typography>
          </Box>
        )}
      </Box>
    );
  },
);

export default ProgressTracker;
