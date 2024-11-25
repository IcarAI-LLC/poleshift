// src/types/ProcessingTypes.ts

export interface ProcessingJob {
  id: string;
  sampleId: string; // human_readable_sample_id
  configId: string;
  status: ProcessingStatus;
  stage: ProcessingStage;
  progress: number;
  functionName: string;
  modalInputs: Record<string, string>;
  files: ProcessingFile[];
  outputPath?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  orgId?: string;
  userId?: string;
  processingResult?: any;
  checkpoints: ProcessingCheckpoint[];
}

export interface ProcessingFile {
  path: string;
  name: string;
  size: number;
  status: FileStatus;
  hash: string;
  compressedPath?: string;
}

export interface ProcessingCheckpoint {
  stage: ProcessingStage;
  timestamp: number;
  data: any;
}

export type ProcessingStatus =
    | 'PENDING'
    | 'COMPRESSING'
    | 'PROCESSING'
    | 'UPLOADING'
    | 'COMPLETED'
    | 'ERROR'
    | 'PAUSED';

export type ProcessingStage =
    | 'INIT'
    | 'FILE_PREP'
    | 'COMPRESSION'
    | 'PROCESSING'
    | 'SAVING'
    | 'CLEANUP'
    | 'DONE';

export type FileStatus = 'PENDING' | 'COMPRESSED' | 'PROCESSED' | 'ERROR';