import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {theme} from "../../theme.ts";

interface SummaryCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  color?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
                                                   title,
                                                   value,
                                                   subtitle,
                                                   color = 'inherit'
                                                 }) => {
  return (
      <Card
          variant="outlined"
          sx={{
            height: 140, // Fixed height for consistency
            display: 'flex',
            flexDirection: 'column',
            margin: theme.spacing(2)
          }}
      >
        <CardContent sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <Box>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ color: color || 'inherit', fontWeight: 'medium' }}>
              {typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : value}
            </Typography>
          </Box>
          {subtitle && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {subtitle}
              </Typography>
          )}
        </CardContent>
      </Card>
  );
};

export default SummaryCard;