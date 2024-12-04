import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { db } from '../powersync/db';
import type { SampleGroupMetadata } from '../types';
import type { DropboxConfigItem } from '../../config/dropboxConfig';

// Progress event payload from Tauri
interface ProgressEvent {
    progress: number;
    status: string;
}

// Common interfaces for processed data
export interface ProcessedResult<T = any> {
    data: T;
    metadata: {
        processedAt: string;
        orgId: string;
        [key: string]: any;
    };
}

export interface ProcessOptions {
    onProgress?: (progress: number, status: string) => void;
    retryAttempts?: number;
    retryDelay?: number;
}

class ProcessDataService {
    private static instance: ProcessDataService;
    private readonly DEFAULT_RETRY_ATTEMPTS = 3;
    private readonly DEFAULT_RETRY_DELAY = 1000;

    private constructor() {}

    static getInstance(): ProcessDataService {
        if (!ProcessDataService.instance) {
            ProcessDataService.instance = new ProcessDataService();
        }
        return ProcessDataService.instance;
    }

    /**
     * Process data using Tauri backend commands with progress tracking
     */
    async processData<T>(
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        inputs: Record<string, any>,
        filePaths: string[],
        options: ProcessOptions = {}
    ): Promise<ProcessedResult<T>> {
        const {
            onProgress,
            retryAttempts = this.DEFAULT_RETRY_ATTEMPTS,
            retryDelay = this.DEFAULT_RETRY_DELAY
        } = options;

        let progressUnlisten: UnlistenFn | undefined;

        try {
            // Set up progress listener if callback provided
            if (onProgress) {
                progressUnlisten = await listen<ProgressEvent>('progress', (event) => {
                    onProgress(event.payload.progress, event.payload.status);
                });
            }

            // Process with retry logic
            const result = await this.withRetry(
                () => invoke<T>(processFunctionName, {
                    sampleId: sampleGroup.id,
                    modalInputs: inputs,
                    filePaths
                }),
                retryAttempts,
                retryDelay
            );

            // Save to database
            await this.saveProcessedData(sampleGroup.id, processFunctionName, result);

            return {
                data: result,
                metadata: {
                    processedAt: new Date().toISOString(),
                    orgId: sampleGroup.org_id
                }
            };
        } finally {
            if (progressUnlisten) {
                await progressUnlisten();
            }
        }
    }

    /**
     * Retry helper for processing operations
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        maxAttempts: number,
        delayMs: number
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
                }
            }
        }

        throw lastError || new Error('Processing failed after retries');
    }

    /**
     * Save processed data to PowerSync database
     */
    private async saveProcessedData<T>(
        sampleId: string,
        processFunctionName: string,
        data: T
    ): Promise<void> {
        const timestamp = Date.now();

        await db.execute(`
            INSERT INTO processed_data (
                key,
                sample_id,
                data,
                timestamp,
                process_function_name,
                status
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            `${sampleId}:${processFunctionName}:${timestamp}`,
            sampleId,
            JSON.stringify(data),
            timestamp,
            processFunctionName,
            'completed'
        ]);
    }

    /**
     * Get processed data from the database
     */
    async getProcessedData<T>(
        sampleId: string,
        processFunctionName: string
    ): Promise<ProcessedResult<T> | null> {
        const results = await db.execute(`
            SELECT * FROM processed_data 
            WHERE sample_id = ? 
            AND process_function_name = ?
            AND status = 'completed'
            ORDER BY timestamp DESC
            LIMIT 1
        `, [sampleId, processFunctionName]);

        if (results.length === 0) return null;

        const result = results[0];
        return {
            data: JSON.parse(result.data),
            metadata: {
                processedAt: new Date(result.timestamp).toISOString(),
                orgId: result.org_id
            }
        };
    }

    /**
     * Check if data has been processed
     */
    async hasProcessedData(
        sampleId: string,
        processFunctionName: string
    ): Promise<boolean> {
        const results = await db.execute(`
            SELECT COUNT(*) as count
            FROM processed_data 
            WHERE sample_id = ? 
            AND process_function_name = ?
            AND status = 'completed'
        `, [sampleId, processFunctionName]);

        return results[0].count > 0;
    }

    /**
     * Delete processed data from the database
     */
    async deleteProcessedData(
        sampleId: string,
        processFunctionName: string
    ): Promise<void> {
        await db.execute(`
            DELETE FROM processed_data 
            WHERE sample_id = ? 
            AND process_function_name = ?
        `, [sampleId, processFunctionName]);
    }
}

export const processData = ProcessDataService.getInstance();