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

// Helper arrays and functions (as before)
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

function formatLabel(variableName: string): string {
  let label = variableName.replace(/_/g, " ");
  let parts = label.split(" ").map(word => {
    switch (word.toLowerCase()){
      case "of":
        return "of";
      case "a":
        return "a";
      default:
        return word.charAt(0).toUpperCase() + word.slice(1);
    }
  });
  return parts.join(" ");
}

function renameKeysInData(dataArray: ProcessedCtdRbrDataValues[]): any[] {
  return dataArray.map((record) => {
    const newRecord: Record<string, any> = {};

    Object.entries(record).forEach(([key, value]) => {
      // handle special case for "_unit" suffix
      if (key.endsWith('_unit')) {
        const mainKey = key.replace('_unit', '');
        // e.g., "speed_of_sound" -> "Speed of Sound"
        const newMainKey = formatLabel(mainKey);
        newRecord[`${newMainKey}_unit`] = value;
      } else {
        const newKey = formatLabel(key);
        newRecord[newKey] = value;
      }
    });
    return newRecord;
  });
}

// Our main component
const DataChart: React.FC<DataChartProps> = ({ data }) => {
  // 1) Transform the data first (useMemo if large data for performance)
  const transformedData = useMemo(() => renameKeysInData(data), [data]);

  // Now, "transformedData" has keys like "Speed of Sound", "Chlorophyll a", etc.
  // Next, define which fields we want to plot. Notice they must match the new keys:
  const plottableFields = [
    'Depth',
    'Pressure',
    'Sea Pressure',
    'Temperature',
    'Chlorophyll a',
    'Salinity',
    'Speed of Sound',
    'Specific Conductivity'
  ];

  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  // 2) Extract available variables and their units from the transformed data
  const { variableOptions, units } = useMemo(() => {
    if (transformedData.length === 0) {
      return { variableOptions: [], units: {} };
    }
    const firstRow = transformedData[0];

    // Filter plottable fields that actually appear and have numeric values
    const options = plottableFields.filter(field =>
        typeof firstRow[field] === 'number'
    );

    // For each field, the unit key is something like "<field>_unit"
    // e.g. "Speed of Sound_unit"
    const extractedUnits: Record<string, string> = {};
    options.forEach((field) => {
      const unitKey = `${field}_unit`;
      extractedUnits[field] = firstRow[unitKey] || 'N/A';
    });

    return {
      variableOptions: options,
      units: extractedUnits
    };
  }, [transformedData]);

  // Custom legend
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

  const handleToggle = (variableName: string) => {
    setSelectedVariables((prev) =>
        prev.includes(variableName)
            ? prev.filter((v) => v !== variableName)
            : [...prev, variableName]
    );
  };

  // 3) Rendering logic
  if (transformedData.length === 0) {
    return (
        <Card sx={{ bgcolor: 'black', color: 'white' }}>
          <CardContent>
            <Alert severity="info">No data available to display.</Alert>
          </CardContent>
        </Card>
    );
  }

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

  // Prepare data for Google Charts:
  // The key for Depth is "Depth", so we reference "Depth" from each record for the Y-axis
  const chartData = [
    // column definitions
    ['Variable Value', 'Depth', { role: 'tooltip' }, { role: 'style' }],
    // all selected variables
    ...selectedVariables.flatMap((variableName, seriesIndex) =>
        transformedData
            .map(item => {
              const x = item[variableName];
              const y = item['Depth'];
              if (x == null || y == null) return null;
              return [
                x,
                y,
                `${variableName}: ${x} ${units[variableName]}\nDepth: ${y} ${units['Depth']}`,
                `point { size: 3; fill-color: ${colorArray[seriesIndex % colorArray.length]}; }`
              ];
            })
            .filter((item): item is [number, number, string, string] => item !== null)
    )
  ];

  // Chart options
  const options = {
    backgroundColor: '#000000',
    colors: selectedVariables.map((_, index) => colorArray[index % colorArray.length]),
    hAxis: {
      title:
          selectedVariables.length === 1
              ? `${selectedVariables[0]} (${units[selectedVariables[0]]})`
              : 'Variable Value',
      gridlines: { color: '#444444' },
      titleTextStyle: { color: '#ffffff', italic: false, bold: true },
      textStyle: { color: '#ffffff' }
    },
    vAxis: {
      title: `Depth (${units['Depth'] || 'm'})`,
      direction: -1, // invert Y-axis
      gridlines: { color: '#444444' },
      titleTextStyle: { color: '#ffffff', italic: false, bold: true },
      textStyle: { color: '#ffffff' }
    },
    legend: { position: 'none' },
    tooltip: { textStyle: { fontSize: 12 } },
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

            {/* Custom legend */}
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
