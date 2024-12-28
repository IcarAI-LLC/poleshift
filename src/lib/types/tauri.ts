import {
    RawCtdRbrDataValues,
    ProcessedCtdRbrDataValues,
    RawFastqData,
    ProcessedKrakenUniqReport,
    ProcessedKrakenUniqStdout
} from "./db_types.ts";

export interface HandleCtdDataResult {
    status: string;
    report:
        {
            rawData: RawCtdRbrDataValues[]
            processedData: ProcessedCtdRbrDataValues[]
        }
}

export interface HandleSequenceDataResult {
    status: string;
    report:
        {
            processedKrakenUniqReport: ProcessedKrakenUniqReport[]
            processedKrakenUniqStdout: ProcessedKrakenUniqStdout[]
            rawSequences: RawFastqData[]
        }
}