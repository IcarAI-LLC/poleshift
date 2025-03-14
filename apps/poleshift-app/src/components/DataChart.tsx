import { useState, useMemo, FC } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ProcessedCtdRbrDataValues } from 'src/types';

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

function formatLabel(variableName: string): string {
  return variableName
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) =>
      ['of', 'a'].includes(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

function renameKeysInData(
  dataArray: ProcessedCtdRbrDataValues[]
): Record<string, string | number | null>[] {
  return dataArray.map((record) => {
    const newRecord: Record<string, string | number | null> = {};
    Object.entries(record).forEach(([key, value]) => {
      if (key.endsWith('_unit')) {
        const mainKey = key.replace('_unit', '');
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

const DataChart: FC<DataChartProps> = ({ data }) => {
  // Transform the data once when the component mounts or data changes
  const transformedData = useMemo(() => renameKeysInData(data), [data]);

  const plottableFields = [
    'Depth',
    'Pressure',
    'Sea Pressure',
    'Temperature',
    'Chlorophyll a',
    'Salinity',
    'Speed of Sound',
    'Specific Conductivity',
  ];

  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  // Extract variable options and their units from the first row of data
  const { variableOptions, units } = useMemo(() => {
    if (transformedData.length === 0) return { variableOptions: [], units: {} };
    const firstRow = transformedData[0];

    const options = plottableFields.filter(
      (field) => typeof firstRow[field] === 'number'
    );

    const extractedUnits: Record<string, string> = {};
    options.forEach((field) => {
      const unitKey = `${field}_unit`;
      extractedUnits[field] = (firstRow[unitKey] as string) || 'N/A';
    });

    return {
      variableOptions: options,
      units: extractedUnits,
    };
  }, [transformedData]);

  // Toggle selection of variables
  const handleToggle = (variableName: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variableName)
        ? prev.filter((v) => v !== variableName)
        : [...prev, variableName]
    );
  };
  console.log(transformedData);
  return (
    <Card>
      <CardContent className='m-1'>
        {/* Variable Selection Section */}
        <div className='flex flex-wrap m-4'>
          {variableOptions.map((variableName) => (
            <div key={variableName} className='mr-4 mb-2'>
              <Label>
                <Checkbox
                  checked={selectedVariables.includes(variableName)}
                  onCheckedChange={() => handleToggle(variableName)}
                />
                {`${variableName} (${units[variableName] || 'N/A'})`}
              </Label>
            </div>
          ))}
        </div>

        {/* Wrap the chart or fallback content in a ResponsiveContainer */}
        <div className={'flex flex-1 align-top justify-center h-[500px]'}>
          <ResponsiveContainer>
            <ScatterChart>
              <Legend
                className='p-4 pb-4'
                verticalAlign='top'
                align='center'
                iconType={'line'}
              />
              <CartesianGrid strokeDasharray='3 3' className={'pt-4'} />
              <XAxis
                type='number'
                dataKey='value'
                domain={['auto', 'dataMax']}
                name='Variable Value'
                label={{
                  value:
                    selectedVariables.length === 1
                      ? `${selectedVariables[0]} (${units[selectedVariables[0]]})`
                      : 'Variable Value',
                  position: 'bottom',
                  align: 'center',
                  offset: -10,
                  margin: { top: 50 },
                }}
              />
              <YAxis
                type='number'
                dataKey='depth'
                name='Depth'
                reversed
                label={{
                  value: `Depth (${units['Depth'] || 'm'})`,
                  angle: -90,
                  position: 'insideLeft',
                }}
              />
              <Tooltip />

              {selectedVariables.map((variableName, index) => {
                const scatterData = transformedData
                  .filter(
                    (item) =>
                      item[variableName] != null && item['Depth'] != null
                  )
                  .map((item) => ({
                    variable: variableName,
                    value: item[variableName],
                    depth: item['Depth'],
                  }))
                  // Sort primarily by x (value), then y (depth)
                  .sort((a, b) => {
                    if (a.value === b.value) {
                      return (a?.depth as number) - (b?.depth as number);
                    }
                    return (a?.value as number) - (b.value as number);
                  });

                return (
                  <Scatter
                    key={variableName}
                    name={`${variableName} (${units[variableName] || 'N/A'})`}
                    data={scatterData}
                    fill={colorArray[index % colorArray.length]}
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataChart;
