// src/renderer/components/DataChart.tsx

import React, { useState, useMemo } from 'react';
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
import { Box, FormControlLabel, Checkbox, Typography } from '@mui/material';
import {ProcessedCTDData} from "../lib/utils/processCTDDataForModal.ts";
interface DataChartProps {
  data: ProcessedCTDData['processedData'];
  units: ProcessedCTDData['variableUnits'];
}

const DataChart: React.FC<DataChartProps> = ({ data, units }) => {
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  console.log("data", data);
  console.log("units", units);
  // Memoize variable options to avoid unnecessary recalculations
  const variableOptions = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter((key) => key !== 'depth');
  }, [data]);

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

  if (data.length === 0) {
    return <Typography>No data available to display.</Typography>;
  }

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
                        color="primary"
                    />
                  }
                  label={`${variableName} (${units[variableName] || 'N/A'})`}
              />
          ))}
        </Box>

        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 40,
                left: 60,
              }}
          >
            <CartesianGrid />
            <XAxis
                type="number"
                dataKey="value"
                name="Value"
                domain={['auto', 'auto']}
                label={{ value: 'Variable Value', position: 'insideBottom', offset: -10 }}
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
                formatter={(value: number, name: string) => [`${value}`, name]}
                labelFormatter={(label) => `Depth: ${label} m`}
            />
            <Legend />
            {selectedVariables.map((variableName, index) => (
                <Scatter
                    key={variableName}
                    name={`${variableName} (${units[variableName] || 'N/A'})`}
                    data={data.map((item) => ({
                      depth: item.depth,
                      value: item[variableName],
                    })).filter(point => !isNaN(point.value))}
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
