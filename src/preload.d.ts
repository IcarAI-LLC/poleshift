// src/main/preload.d.ts
export {};

// Progress tracking types
type ProgressCallback = (data: { progress: number; status: string }) => void;
type ProgressCleanup = () => void;

// ProcessedData types
interface ProcessedDataResult<T> {
  result: Promise<T>;
  onProgress: (callback: ProgressCallback) => ProgressCleanup;
}

interface ProcessAndUploadParams {
  functionName: string;
  sampleGroup: {
    id: string;
    human_readable_sample_id: string;
    storage_folder: string;
    org_id: string;
    user_id: string;
  };
  modalInputs: Record<string, string>;
  filePaths: string[];
  configItem: {
    id: string;
    [key: string]: any;
  };
}

interface ProcessedDataResponse {
  success: boolean;
  data?: {
    metadata: {
      id: string;
      human_readable_sample_id: string;
      data_type: string;
      processed_storage_path: string;
      raw_storage_paths: string[];
      org_id: string;
      user_id: string;
      status: string;
      processed_datetime_utc: string;
      process_function_name: string;
      sample_group_id: string;
      lat?: number;
      long?: number;
      file_name?: string;
      file_type?: string;
    };
    processedData: any;
  };
  error?: string;
}

interface ProcessFunctionResult {
  success: boolean;
  result?: {
    data: any;
    reportFile?: {
      name: string;
      type: string;
    };
  };
  message?: string;
}

declare global {
  interface Window {
    electron: {
      // Store operations
      store: {
        get: (key: string) => any;
        set: (
          key: string,
          val: any,
        ) => Promise<{ success: boolean; message?: string }>;
        delete: (
          key: string,
        ) => Promise<{ success: boolean; message?: string }>;
      };

      // ProcessedData operations
      processedData: {
        fetch: (
          sampleGroup: {
            human_readable_sample_id: string;
            [key: string]: any;
          }
        ) => ProcessedDataResult<Record<string, any> | null>;

        processAndUpload: (
          params: ProcessAndUploadParams
        ) => ProcessedDataResult<ProcessedDataResponse>;
      };

      // Process function
      processFunction: (
        functionName: string,
        sampleId: string,
        configId: string,
        modalInputs: Record<string, any>,
        filePaths?: string[],
      ) => ProcessedDataResult<ProcessFunctionResult>;

      // File operations
      saveFile: (
        data: Uint8Array,
        fileName: string,
      ) => Promise<{
        success: boolean;
        filePath?: string;
        message?: string;
      }>;

      readFile: (
        filePath: string,
      ) => Promise<{
        success: boolean;
        data?: ArrayBuffer;
        message?: string;
      }>;

      // Security operations
      encryptAndStore: (
        userId: string,
        key: string,
        value: string,
      ) => Promise<{
        success: boolean;
        message?: string;
      }>;

      retrieveAndDecrypt: (
        userId: string,
        key: string,
      ) => Promise<{
        success: boolean;
        value?: string;
        message?: string;
      }>;
    };
  }
}
