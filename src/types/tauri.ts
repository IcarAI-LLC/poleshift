import {
  RawCtdRbrDataValues,
  ProcessedCtdRbrDataValues,
  RawFastqData,
  ProcessedKrakenUniqReport,
  ProcessedKrakenUniqStdout,
} from './database.ts';
import { ProcessingState } from '@/lib/powersync/DrizzleSchema.ts';

export enum TauriProcessingFunctions {
  CTD = 'handle_ctd_data',
  Sequence = 'handle_sequence_data',
  RangeFinder = 'handle_range_finder',
}

export interface HandleCtdDataResult {
  status: string;
  report: {
    raw_data: RawCtdRbrDataValues[];
    processed_data: ProcessedCtdRbrDataValues[];
  };
}

export interface HandleSequenceDataResult {
  status: string;
  report: {
    processed_kraken_uniq_report: ProcessedKrakenUniqReport[];
    processed_kraken_uniq_stdout: ProcessedKrakenUniqStdout[];
    raw_sequences: RawFastqData[];
  };
}

export interface ProgressPayload {
  progress_percentage: number;
  status_message: string | null;
  processing_state: ProcessingState;
}
