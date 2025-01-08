import React, { useState, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { ProcessedCtdRbrDataValues } from "@/lib/types";

interface DataChartProps {
  data: ProcessedCtdRbrDataValues[];
}

const colorArray = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
];

function formatLabel(variableName: string): string {
  return variableName
      .replace(/_/g, " ")
      .split(" ")
      .map((word) =>
          ["of", "a"].includes(word.toLowerCase())
              ? word.toLowerCase()
              : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ");
}

function renameKeysInData(dataArray: ProcessedCtdRbrDataValues[]): any[] {
  return dataArray.map((record) => {
    const newRecord: Record<string, any> = {};
    Object.entries(record).forEach(([key, value]) => {
      if (key.endsWith("_unit")) {
        const mainKey = key.replace("_unit", "");
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

const DataChart: React.FC<DataChartProps> = ({ data }) => {
  const transformedData = useMemo(() => renameKeysInData(data), [data]);
  const plottableFields = [
    "Depth",
    "Pressure",
    "Sea Pressure",
    "Temperature",
    "Chlorophyll a",
    "Salinity",
    "Speed of Sound",
    "Specific Conductivity",
  ];

  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  const { variableOptions, units } = useMemo(() => {
    if (transformedData.length === 0) return { variableOptions: [], units: {} };
    const firstRow = transformedData[0];

    const options = plottableFields.filter(
        (field) => typeof firstRow[field] === "number"
    );

    const extractedUnits: Record<string, string> = {};
    options.forEach((field) => {
      const unitKey = `${field}_unit`;
      extractedUnits[field] = firstRow[unitKey] || "N/A";
    });

    return {
      variableOptions: options,
      units: extractedUnits,
    };
  }, [transformedData]);

  const handleToggle = (variableName: string) => {
    setSelectedVariables((prev) =>
        prev.includes(variableName)
            ? prev.filter((v) => v !== variableName)
            : [...prev, variableName]
    );
  };

  const chartData = selectedVariables.flatMap((variableName) =>
      transformedData
          .filter((item) => item[variableName] != null && item["Depth"] != null)
          .map((item) => ({
            variable: variableName,
            value: item[variableName],
            depth: item["Depth"],
          }))
  );

  return (
      <Card className="bg-black text-white">
        <CardContent>
          {transformedData.length === 0 ? (
              <Alert>No data available to display.</Alert>
          ) : (
              <>
                <div className="flex flex-wrap mb-4">
                  {variableOptions.map((variableName) => (
                      <div key={variableName} className="mr-4">
                        <Label>
                          <Checkbox
                              checked={selectedVariables.includes(variableName)}
                              onChange={() => handleToggle(variableName)}
                          />
                          {`${variableName} (${units[variableName] || "N/A"})`}
                        </Label>
                      </div>
                  ))}
                </div>

                {selectedVariables.length === 0 ? (
                    <Alert>Please select at least one variable to display the chart.</Alert>
                ) : (
                    <ScatterChart
                        width={800}
                        height={500}
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                          dataKey="value"
                          name="Variable Value"
                          label={{
                            value:
                                selectedVariables.length === 1
                                    ? `${selectedVariables[0]} (${units[selectedVariables[0]]})`
                                    : "Variable Value",
                            position: "insideBottom",
                            offset: -10,
                          }}
                      />
                      <YAxis
                          dataKey="depth"
                          name="Depth"
                          label={{
                            value: `Depth (${units["Depth"] || "m"})`,
                            angle: -90,
                            position: "insideLeft",
                          }}
                          reversed
                      />
                      <Tooltip />
                      <Legend />
                      {selectedVariables.map((variableName, index) => (
                          <Scatter
                              key={variableName}
                              name={`${variableName} (${units[variableName] || "N/A"})`}
                              data={chartData.filter(
                                  (item) => item.variable === variableName
                              )}
                              fill={colorArray[index % colorArray.length]}
                          />
                      ))}
                    </ScatterChart>
                )}
              </>
          )}
        </CardContent>
      </Card>
  );
};

export default DataChart;
