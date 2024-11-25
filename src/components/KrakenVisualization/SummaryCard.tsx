import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

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
  color,
}) => (
  <Card variant="outlined">
    <CardContent>
      <Typography variant="subtitle2" color="textSecondary">
        {title}
      </Typography>
      <Typography variant="h5" sx={{ color: color || 'inherit' }}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="textSecondary">
          {subtitle}
        </Typography>
      )}
    </CardContent>
  </Card>
);

export default SummaryCard;
