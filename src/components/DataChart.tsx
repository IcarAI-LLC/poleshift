import React, { useState, useMemo } from 'react';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import type { ScatterSeriesType } from '@mui/x-charts/models';
import {
  Box,
  FormControlLabel,
  Checkbox,
  Typography,
  Card,
  CardContent
} from '@mui/material';

interface ProcessedCTDData {
  processedData: Record<string, any>[];
  variableUnits: Record<string, string>;
}

interface DataChartProps {
  data: ProcessedCTDData['processedData'];
  units: ProcessedCTDData['variableUnits'];
}

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

const DataChart: React.FC<DataChartProps> = ({ data, units }) => {
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  const variableOptions = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter((key) => key !== 'depth');
  }, [data]);

  const handleToggle = (variableName: string) => {
    setSelectedVariables((prev) =>
        prev.includes(variableName)
            ? prev.filter((v) => v !== variableName)
            : [...prev, variableName]
    );
  };

  if (data.length === 0) {
    return <Typography>No data available to display.</Typography>;
  }

  // Prepare series data for MUI X-Charts
  const series: ScatterSeriesType[] = selectedVariables.map((variableName, index) => ({
    type: 'scatter',
    data: data
        .map((item, idx) => ({
          id: `${variableName}-${idx}`,
          x: Number(item[variableName]),
          y: Number(item.depth),
          xAxis: undefined,
          yAxis: undefined
        }))
        .filter(point => !isNaN(point.x)),
    label: `${variableName} (${units[variableName] || 'N/A'})`,
    color: colorArray[index % colorArray.length],
    valueFormatter: (value: { x: number; y: number }) =>
        `Value: ${value.x}, Depth: ${value.y} m`,
    showMark: true
  }));

  return (
      <Card>
        <CardContent>
          <Box>
            {/* Variable toggles */}
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

            {/* Chart */}
            <Box style={{ width: '100%', height: 500 }}>
              <ScatterChart
                  series={series}
                  width={undefined}
                  height={500}
                  margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
                  xAxis={[{
                    label: 'Variable Value',
                  }]}
                  yAxis={[{
                    label: 'Depth (m)',
                    reverse: true,
                  }]}
                  grid={{ vertical: true, horizontal: true }}
                  slotProps={{
                    legend: {
                      direction: 'row',
                      position: { vertical: 'top', horizontal: 'middle' },
                      padding: 20,
                    }
                  }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>
  );
};

export default DataChart;