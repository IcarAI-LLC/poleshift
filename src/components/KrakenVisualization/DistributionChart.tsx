import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import type { BarSeriesType } from '@mui/x-charts/models';
import {
    Card,
    CardHeader,
    CardContent,
    Typography,
    Stack,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Box,
} from '@mui/material';

interface DistributionData {
    taxon: string;
    percentage: number;
    reads: number;
    taxReads: number;
    kmers: number;
    dup: number;
    cov: number;
}

interface DistributionChartProps {
    data?: DistributionData[];
    title: string;
}

interface TickParamsSelectorProps {
    tickPlacement: 'end' | 'start' | 'middle' | 'extremities';
    tickLabelPlacement: 'tick' | 'middle';
    setTickPlacement: (value: 'end' | 'start' | 'middle' | 'extremities') => void;
    setTickLabelPlacement: (value: 'tick' | 'middle') => void;
}

function TickParamsSelector({
                                tickPlacement,
                                tickLabelPlacement,
                                setTickPlacement,
                                setTickLabelPlacement,
                            }: TickParamsSelectorProps) {
    return (
        <Stack direction="column" spacing={2}>
            <FormControl component="fieldset">
                <FormLabel component="legend">Tick Placement</FormLabel>
                <RadioGroup
                    row
                    value={tickPlacement}
                    onChange={(e) => setTickPlacement(e.target.value as 'end' | 'start' | 'middle' | 'extremities')}
                >
                    <FormControlLabel value="start" control={<Radio />} label="Start" />
                    <FormControlLabel value="end" control={<Radio />} label="End" />
                    <FormControlLabel value="middle" control={<Radio />} label="Middle" />
                    <FormControlLabel value="extremities" control={<Radio />} label="Extremities" />
                </RadioGroup>
            </FormControl>

            <FormControl component="fieldset">
                <FormLabel component="legend">Tick Label Placement</FormLabel>
                <RadioGroup
                    row
                    value={tickLabelPlacement}
                    onChange={(e) => setTickLabelPlacement(e.target.value as 'tick' | 'middle')}
                >
                    <FormControlLabel value="tick" control={<Radio />} label="Tick" />
                    <FormControlLabel value="middle" control={<Radio />} label="Middle" />
                </RadioGroup>
            </FormControl>
        </Stack>
    );
}

const DistributionChart: React.FC<DistributionChartProps> = ({ data = [], title }) => {
    const [tickPlacement, setTickPlacement] = React.useState<'end' | 'start' | 'middle' | 'extremities'>('middle');
    const [tickLabelPlacement, setTickLabelPlacement] = React.useState<'tick' | 'middle'>('middle');

    if (!Array.isArray(data) || data.length === 0) {
        return (
            <Card>
                <CardHeader title={title} />
                <CardContent>
                    <Typography variant="body1" color="textSecondary" align="center">
                        No data available for visualization
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    // Take top 20 taxa and process data
    const chartData = data.slice(0, 20).map((item) => ({
        taxon: item.taxon
            ? (item.taxon.length > 20 ? `${item.taxon.substring(0, 17)}...` : item.taxon)
            : 'Unknown',
        percentage: item.percentage ?? 0,
        reads: item.reads ?? 0,
        taxReads: item.taxReads ?? 0,
    }));

    const xAxisData = {
        scaleType: 'band' as const,
        dataKey: 'taxon',
        tickPlacement,
        tickLabelPlacement,
        label: 'Taxon'
    };

    const yAxisData = {
        label: 'Percentage (%)',
        min: 0,
        max: Math.ceil(Math.max(...chartData.map(item => item.percentage)) * 1.1)
    };

    const series: BarSeriesType[] = [{
        type: 'bar',
        dataKey: 'percentage',
        label: 'Percentage',
        valueFormatter: (value: number | null) => value != null ? `${value.toFixed(2)}%` : '',
        color: '#2196f3'
    }];

    return (
        <Card>
            <CardHeader title={title} />
            <CardContent>
                <TickParamsSelector
                    tickPlacement={tickPlacement}
                    tickLabelPlacement={tickLabelPlacement}
                    setTickPlacement={setTickPlacement}
                    setTickLabelPlacement={setTickLabelPlacement}
                />

                <Box style={{ width: '100%', height: 400 }}>
                    <BarChart
                        dataset={chartData}
                        xAxis={[xAxisData]}
                        yAxis={[yAxisData]}
                        series={series}
                        width={undefined}
                        height={350}
                        margin={{ top: 20, right: 30, bottom: 40, left: 50 }}
                    />
                </Box>
            </CardContent>
        </Card>
    );
};

export default DistributionChart;