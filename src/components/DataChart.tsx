import React, { useState, useMemo } from 'react';
import { Chart } from "react-google-charts";
import {
  Box,
  FormControlLabel,
  Checkbox,
  Typography,
  Card,
  CardContent,
  Alert,
  Stack
} from '@mui/material';
import { ProcessedCtdRbrDataValues } from '../lib/types';

interface DataChartProps {
  data: ProcessedCtdRbrDataValues[];
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

// Define which fields we want to plot (excluding metadata fields)
const plottableFields: (keyof ProcessedCtdRbrDataValues)[] = [
  'depth',
  'pressure',
  'sea_pressure',
  'temperature',
  'chlorophyll_a',
  'salinity',
  'speed_of_sound',
  'specific_conductivity'
];

const getUnitFieldName = (field: keyof ProcessedCtdRbrDataValues): keyof ProcessedCtdRbrDataValues => {
  return `${field}_unit` as keyof ProcessedCtdRbrDataValues;
};

const DataChart: React.FC<DataChartProps> = ({ data }) => {
  const [selectedVariables, setSelectedVariables] = useState<(keyof ProcessedCtdRbrDataValues)[]>([]);

  // Extract available variables and their units
  const { variableOptions, units } = useMemo(() => {
    if (data.length === 0) return { variableOptions: [], units: {} };

    const firstRow = data[0];
    const options = plottableFields.filter(field =>
        firstRow[field] !== null &&
        typeof firstRow[field] === 'number'
    );

    const extractedUnits = Object.fromEntries(
        options.map(field => {
          const unitField = getUnitFieldName(field);
          return [field, firstRow[unitField] || 'N/A'];
        })
    );

    return {
      variableOptions: options,
      units: extractedUnits
    };
  }, [data]);

  // Custom legend component
  const CustomLegend = () => (
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        {selectedVariables.map((variableName, index) => (
            <Box key={variableName} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: colorArray[index % colorArray.length],
                    mr: 1
                  }}
              />
              <Typography variant="body2" color="white">
                {`${variableName} (${units[variableName] || 'N/A'})`}
              </Typography>
            </Box>
        ))}
      </Stack>
  );

  const handleToggle = (variableName: keyof ProcessedCtdRbrDataValues) => {
    setSelectedVariables((prev) =>
        prev.includes(variableName)
            ? prev.filter((v) => v !== variableName)
            : [...prev, variableName]
    );
  };

  if (data.length === 0) {
    return (
        <Card sx={{ bgcolor: 'black', color: 'white' }}>
          <CardContent>
            <Alert severity="info">No data available to display.</Alert>
          </CardContent>
        </Card>
    );
  }

  // Show message when no variables are selected
  if (selectedVariables.length === 0) {
    return (
        <Card sx={{ bgcolor: 'black', color: 'white' }}>
          <CardContent>
            <Box>
              <Box display="flex" flexWrap="wrap" mb={2}>
                {variableOptions.map((variableName) => (
                    <FormControlLabel
                        key={variableName}
                        control={
                          <Checkbox
                              checked={false}
                              onChange={() => handleToggle(variableName)}
                              name={variableName}
                              color="primary"
                          />
                        }
                        label={`${variableName} (${units[variableName]})`}
                        sx={{ color: 'white' }}
                    />
                ))}
              </Box>
              <Alert severity="info">Please select at least one variable to display the chart.</Alert>
            </Box>
          </CardContent>
        </Card>
    );
  }

  // Prepare data for Google Charts
  const chartData = [
    ['Variable Value', 'Depth', { role: 'tooltip' }, { role: 'style' }],
    ...selectedVariables.flatMap((variableName, seriesIndex) =>
        data
            .map(item => {
              const x = item[variableName];
              const y = item.depth;
              if (x === null || y === null) return null;

              return [
                x,
                y,
                `${variableName}: ${x} ${units[variableName]}\nDepth: ${y} ${units['depth']}`,
                `point { size: 3; fill-color: ${colorArray[seriesIndex % colorArray.length]}; }`
              ];
            })
            .filter((item): item is [number, number, string, string] => item !== null)
    )
  ];

  const options = {
    backgroundColor: '#000000',
    colors: selectedVariables.map((_, index) => colorArray[index % colorArray.length]),
    hAxis: {
      title: selectedVariables.length === 1
          ? `${selectedVariables[0]} (${units[selectedVariables[0]]})`
          : 'Variable Value',
      gridlines: {
        color: '#444444'
      },
      titleTextStyle: {
        color: '#ffffff',
        italic: false,
        bold: true
      },
      textStyle: {
        color: '#ffffff'
      }
    },
    vAxis: {
      title: `Depth (${units['depth']})`,
      direction: -1,
      gridlines: {
        color: '#444444'
      },
      titleTextStyle: {
        color: '#ffffff',
        italic: false,
        bold: true
      },
      textStyle: {
        color: '#ffffff'
      }
    },
    legend: {
      position: 'none'  // Hide default legend
    },
    tooltip: {
      textStyle: {
        fontSize: 12
      }
    },
    chartArea: {
      left: 80,
      top: 50,
      right: 20,
      bottom: 60,
      width: '100%',
      height: '100%'
    }
  };

  return (
      <Card sx={{ bgcolor: 'black', color: 'white' }}>
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
                      label={`${variableName} (${units[variableName]})`}
                      sx={{ color: 'white' }}
                  />
              ))}
            </Box>

            {/* Custom Legend */}
            <CustomLegend />

            {/* Chart */}
            <Box style={{ width: '100%', height: 500 }}>
              <Chart
                  chartType="ScatterChart"
                  width="100%"
                  height="500px"
                  data={chartData}
                  options={options}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>
  );
};

export default DataChart;