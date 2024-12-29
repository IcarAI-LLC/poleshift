import {
    RawCtdRbrDataValues,
    ProcessedCtdRbrDataValues,
    RawFastqData,
    ProcessedKrakenUniqReport,
    ProcessedKrakenUniqStdout
} from "./db_types.ts";
import {ProcessingState} from "./enums.ts";

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

export interface ProgressPayload {
    progress_percentage: number;
    status_message: string | null;
    processing_state: ProcessingState;
}