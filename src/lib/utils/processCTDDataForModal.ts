interface CTDData {
    channels: CTDChannel[];
    data: Record<string, number>[];
}

export interface ProcessedCTDData {
    processedData: Record<string, number>[];
    variableUnits: Record<string, string>;
}

interface CTDChannel {
    channel_id: number;
    short_name: string;
    long_name: string;
    units: string;
    is_derived: boolean;
    is_visible: boolean;
}

export const processCTDDataForModal = (dataItem: CTDData): ProcessedCTDData => {
    if (!dataItem) {
        throw new Error("No data provided");
    }
    const { channels, data } = dataItem;
    const dataRows = data;
    console.log(channels);
    // Create mapping of channel keys to their info
    const channelKeyToInfo = channels.reduce(
        (acc: Record<string, CTDChannel>, channel) => {
            // Use the correct property name 'channel_id'
            const key = `channel${String(channel.channel_id).padStart(2, '0')}`;
            acc[key] = { ...channel };
            return acc;
        },
        {},
    );
    console.log("Channel key to info: ", channelKeyToInfo);
    // Process data rows
    const processedData = dataRows.map((item) => {
        const newItem: Record<string, number> = {};

        // Ensure 'channel06' exists for depth
        if ('channel06' in item) {
            newItem['depth'] = item['channel06'];
        } else {
            console.warn("Depth data ('channel06') is missing in item:", item);
            newItem['depth'] = NaN; // Assign NaN or a default value
        }

        for (const key in item) {
            if (key.startsWith('channel') && key !== 'channel06') {
                const channelInfo = channelKeyToInfo[key];
                const variableName = channelInfo.long_name;
                newItem[variableName] = item[key];
            }
        }

        return newItem;
    });
    // Create units mapping
    const variableUnits: Record<string, string> = {};
    for (const key in channelKeyToInfo) {
        if (key !== 'channel06') {
            const channelInfo = channelKeyToInfo[key];
            variableUnits[channelInfo.long_name] = channelInfo.units;
        }
    }

    return { processedData, variableUnits };
};
