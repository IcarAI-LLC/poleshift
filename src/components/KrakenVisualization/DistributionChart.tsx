import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardContent, Typography } from '@mui/material';

interface DistributionData {
  taxon: string;
  percentage: number;
  cladeReads: number;
  taxonReads: number;
}

interface DistributionChartProps {
  data?: DistributionData[];
  title: string;
}

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.[0]) {
    const data = payload[0];
    return (
      <div
        style={{
          backgroundColor: '#fff',
          color: '#000',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0px 0px 10px rgba(0,0,0,0.5)',
        }}
      >
        <p style={{ margin: '0 0 5px 0' }}>
          <strong>{label}</strong>
        </p>
        <p style={{ margin: '0 0 5px 0' }}>
          Percentage: {data.value?.toFixed(2) ?? '0.00'}%
        </p>
        <p style={{ margin: '0 0 5px 0' }}>
          Clade Reads: {formatNumber(data.payload?.cladeReads ?? 0)}
        </p>
        <p style={{ margin: '0' }}>
          Taxon Reads: {formatNumber(data.payload?.taxonReads ?? 0)}
        </p>
      </div>
    );
  }
  return null;
};

const DistributionChart: React.FC<DistributionChartProps> = ({
                                                               data = [],
                                                               title,
                                                             }) => {
  // Check if we have valid data to display
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardHeader title={title} />
        <CardContent>
          <Typography variant="body1" color="text.secondary" align="center">
            No data available for visualization
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Take top 20 taxa for visualization
  const chartData = data
    .slice(0, 20)
    .map((item) => ({
      ...item,
      // Ensure taxon exists before trying to access its length
      taxonShort: item.taxon
        ? item.taxon.length > 20
          ? `${item.taxon.substring(0, 17)}...`
          : item.taxon
        : 'Unknown',
      // Ensure numerical values are defined
      percentage: item.percentage ?? 0,
      cladeReads: item.cladeReads ?? 0,
      taxonReads: item.taxonReads ?? 0,
    }));

  return (
    <Card sx={{ mt: 3 }}>
      <CardHeader title={title} />
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="taxonShort"
              angle={-45}
              textAnchor="end"
              interval={0}
              height={100}
            />
            <YAxis
              label={{
                value: 'Percentage',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle' },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="percentage" fill="#2196f3" name="Percentage" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default DistributionChart;
