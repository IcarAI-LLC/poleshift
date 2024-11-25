// lib/hooks/useDataVisualization.ts
import { useMemo } from 'react';
import { SampleGroup } from '../types';
import { useProcessedData } from './useProcessedData';

interface ChartDataPoint {
    depth: number;
    [key: string]: number | string;
}

interface ChannelMetadata {
    channelID: number;
    longName: string;
    units: string;
}

export interface ChartData {
    data: ChartDataPoint[];
    channels: ChannelMetadata[];
    variableUnits: Record<string, string>;
}

export function useDataVisualization(sampleGroup: SampleGroup | null) {
    const { processedData } = useProcessedData();

    const ctdData = useMemo((): ChartData | null => {
        if (!sampleGroup?.human_readable_sample_id) return null;

        const ctdDataItem = processedData[`${sampleGroup.human_readable_sample_id}:ctd_data`];
        if (!ctdDataItem?.data) return null;

        const channelsArray = ctdDataItem.data.channels;
        const dataArray = ctdDataItem.data.data;

        // Build channel mapping
        const variableUnits: Record<string, string> = {};
        const channelMapping: Record<string, string> = {};

        channelsArray.forEach((channel: ChannelMetadata) => {
            const channelKey = `channel${String(channel.channelID).padStart(2, '0')}`;
            channelMapping[channel.longName] = channelKey;
            variableUnits[channel.longName] = channel.units;
        });

        // Transform data for charting
        const transformedData = dataArray.map((point: Record<string, number>) => {
            const transformed: ChartDataPoint = { depth: point[channelMapping['Depth']] };
            Object.entries(channelMapping).forEach(([longName, key]) => {
                transformed[longName] = point[key];
            });
            return transformed;
        });

        return {
            data: transformedData,
            channels: channelsArray,
            variableUnits
        };
    }, [sampleGroup, processedData]);

    return {
        ctdData
    };
}