import React from 'react';
import { Chart } from "react-google-charts";
import {
    Card,
    CardHeader,
    CardContent,
    Typography,
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

const DistributionChart: React.FC<DistributionChartProps> = ({ data = [], title }) => {
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <Card sx={{ bgcolor: 'black' }}>
                <CardHeader
                    title={title}
                    sx={{ color: 'white' }}
                />
                <CardContent>
                    <Typography variant="body1" color="white" align="center">
                        No data available for visualization
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    // Take top 20 taxa and process data
    const processedData = data.slice(0, 20).map((item) => ({
        taxon: item.taxon
            ? (item.taxon.length > 20 ? `${item.taxon.substring(0, 17)}...` : item.taxon)
            : 'Unknown',
        percentage: item.percentage ?? 0,
        reads: item.reads ?? 0,
        taxReads: item.taxReads ?? 0
    }));

    const chartData = [
        ['Taxon', 'Percentage', { role: 'tooltip', type: 'string', p: { html: true } }],
        ...processedData.map((item) => [
            item.taxon,
            item.percentage,
            `<div style="padding: 10px; background: rgba(0,0,0,0.8); color: white; border: 1px solid white;">
                <strong>${item.taxon}</strong><br/>
                Percentage: ${item.percentage.toFixed(2)}%<br/>
                Reads: ${item.reads.toLocaleString()}<br/>
                Tax Reads: ${item.taxReads.toLocaleString()}
             </div>`
        ])
    ];

    const options = {
        title,
        backgroundColor: '#000000',
        titleTextStyle: {
            color: '#ffffff'
        },
        tooltip: {
            isHtml: true,
            trigger: 'hover'
        },
        hAxis: {
            title: 'Taxon',
            titleTextStyle: {
                color: '#ffffff'
            },
            textStyle: {
                color: '#ffffff'
            },
            slantedText: true,
            slantedTextAngle: 45,
            gridlines: {
                color: '#333333'
            }
        },
        vAxis: {
            title: 'Percentage (%)',
            titleTextStyle: {
                color: '#ffffff'
            },
            textStyle: {
                color: '#ffffff'
            },
            gridlines: {
                color: '#333333'
            },
            minValue: 0,
            maxValue: Math.ceil(Math.max(...data.map(item => item.percentage ?? 0)) * 1.1),
        },
        legend: { position: 'none' },
        colors: ['#2196f3'],
        annotations: {
            textStyle: {
                color: '#ffffff',
                fontSize: 12,
            },
            alwaysOutside: false,
        },
        chartArea: {
            left: 60,
            top: 30,
            right: 20,
            bottom: 100,
            width: '100%',
            height: '100%'
        }
    };

    return (
        <Card sx={{ bgcolor: 'black' }}>
            <CardHeader
                title={title}
                sx={{ color: 'white' }}
            />
            <CardContent>
                <Box style={{ width: '100%', height: 400 }}>
                    <Chart
                        chartType="ColumnChart"
                        width="100%"
                        height="350px"
                        data={chartData}
                        options={options}
                    />
                </Box>
            </CardContent>
        </Card>
    );
};

export default DistributionChart;