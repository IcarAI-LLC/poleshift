// src/renderer/components/DataChart.tsx

import React, { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, FormControlLabel, Checkbox } from '@mui/material';

interface DataChartProps {
  data: any[];
  units: Record<string, string>;
}

const DataChart: React.FC<DataChartProps> = ({ data, units }) => {
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  // Get variable names from the data, excluding 'depth'
  const variableOptions = Object.keys(data[0] || {}).filter(
    (key) => key !== 'depth',
  );

  const handleToggle = (variableName: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variableName)
        ? prev.filter((v) => v !== variableName)
        : [...prev, variableName],
    );
  };

  const colorArray = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7300',
    '#0088FE',
    '#00C49F',
    '#FFBB28',
    '#FF8042',
  ];

  return (
    <Box>
      {/* Render toggles */}
      <Box display="flex" flexWrap="wrap" mb={2}>
        {variableOptions.map((variableName) => (
          <FormControlLabel
            key={variableName}
            control={
              <Checkbox
                checked={selectedVariables.includes(variableName)}
                onChange={() => handleToggle(variableName)}
                name={variableName}
              />
            }
            label={variableName}
          />
        ))}
      </Box>

      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 40,
            left: 20,
          }}
        >
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="value"
            name="Value"
            domain={['auto', 'auto']}
          />
          <YAxis
            type="number"
            dataKey="depth"
            name="Depth"
            reversed // Depth increasing downward
            label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft' }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name) => [`${value}`, `${name}`]}
          />
          <Legend />
          {selectedVariables.map((variableName, index) => (
            <Scatter
              key={variableName}
              name={`${variableName} (${units[variableName] || ''})`}
              data={data.map((item) => ({
                depth: item.depth,
                value: item[variableName],
              }))}
              fill={colorArray[index % colorArray.length]}
              line
              lineType="joint"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default DataChart;
