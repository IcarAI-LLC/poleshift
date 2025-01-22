// src/lib/hooks/useTauriDataProcessor.ts

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { usePowerSync } from '@powersync/react';
import { wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';

import { useAuthStore } from '@/stores/authStore.ts';
import {
    TauriProcessingFunctions,
    RawDataImproved,
    RawNutrientAmmoniaData,
    ProcessedNutrientAmmoniaData,
    HandleCtdDataResult,
    HandleSequenceDataResult,
    ProgressPayload, RawFastqData, ProcessedKrakenUniqReport, ProcessedKrakenUniqStdout
} from '@/types';

import {
    DataType,
    processed_ctd_rbr_data_values,
    processed_data_improved,
    processed_nutrient_ammonia_data, ProcessingState,
    raw_ctd_rbr_data_values,
    raw_data_improved,
    raw_nutrient_ammonia_data
} from '../lib/powersync/DrizzleSchema.ts';

const BATCH_SIZE = 2048;

/**
 * Helper to create a placeholder in the `processed_data_improved` table.
 */
async function createProcessedDataPlaceholder(
    db: ReturnType<typeof wrapPowerSyncWithDrizzle>,
    {
        id,
        dataType,
        userId,
        orgId,
        sampleId,
        statusMessage = 'Initiating...'
    }: {
        id: string;
        dataType: DataType;
        userId: string;
        orgId: string;
        sampleId: string;
        statusMessage?: string;
    }
) {
    return db.insert(processed_data_improved).values({
        id,
        data_type: dataType,
        user_id: userId,
        org_id: orgId,
        sample_id: sampleId,
        created_at: DateTime.now().toISO(),
        processing_state: ProcessingState.Initiated,
        status_message: statusMessage,
        progress_percentage: 0
    }).run();
}


/**
 * Helper to update the processing state in `processed_data_improved`.
 */
async function updateProcessingState(
    db: ReturnType<typeof wrapPowerSyncWithDrizzle>,
    processedDataId: string,
    progressPercentage: number,
    statusMessage: string | null,
    processingState: ProcessingState
) {
    await db
        .update(processed_data_improved)
        .set({
            progress_percentage: progressPercentage,
            status_message: statusMessage,
            processing_state: processingState
        })
        .where(eq(processed_data_improved.id, processedDataId))
        .run();
}

/**
 * Hook that provides functions to process various data types via Tauri commands.
 */
export function useTauriDataProcessor() {
    const { userId, organizationId } = useAuthStore.getState();
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db);

    async function bulkInsertJSON1(
        tableName: string,
        columns: string[],
        data: RawFastqData[] | ProcessedKrakenUniqReport[] | ProcessedKrakenUniqStdout[]
    ): Promise<void> {
        if (data.length === 0) {
            console.info(`bulkInsertJSON1: No data provided for table '${tableName}'. Skipping insertion.`);
            return;
        }

        // Log the start of the bulk insert process
        console.info(`bulkInsertJSON1: Starting bulk insert into table '${tableName}'. Number of records: ${data.length}`);

        // Serialize data to JSON
        let jsonData: string;
        try {
            jsonData = JSON.stringify(data);
            const byteLength = new TextEncoder().encode(jsonData).length;
            console.debug(`bulkInsertJSON1: Serialized data to JSON. Size: ${byteLength} bytes.`);
        } catch (serializationError) {
            console.error(`bulkInsertJSON1: Failed to serialize data to JSON for table '${tableName}'. Error:`, serializationError);
            throw serializationError; // Re-throw after logging
        }

        // Construct column mappings for the SELECT statement, referencing 'e.value'
        const columnMappings = columns.map(col => `e.value ->> '${col}' AS ${col}`).join(', ');
        console.debug(`bulkInsertJSON1: Column mappings: ${columnMappings}`);

        // Construct the SQL query with a CTE and alias 'e' for json_each
        const sql = `
            WITH data AS (
                SELECT ${columnMappings}
                FROM json_each(?) AS e
            )
            INSERT INTO ${tableName} (${columns.join(', ')})
            SELECT ${columns.join(', ')}
            FROM data;
        `;

        console.debug(`bulkInsertJSON1: Constructed SQL query: ${sql}`);

        // Execute the query with timing
        const startTime = Date.now();
        try {
            console.debug(`bulkInsertJSON1: Executing SQL query for table '${tableName}' with JSON data.`);
            await db.execute(sql, [jsonData]);
            const duration = Date.now() - startTime;
            console.info(`bulkInsertJSON1: Successfully inserted ${data.length} records into '${tableName}' in ${duration}ms.`);
        } catch (executionError) {
            console.error(`bulkInsertJSON1: Failed to execute bulk insert for table '${tableName}'. Error:`, executionError);
            throw executionError;
        }
    }

    /**
     * Process CTD data files via Tauri command and save to database.
     */
    async function processCtdData(
        sampleGroupId: string,
        filePaths: string[]
    ): Promise<void> {
        if (!userId || !organizationId) {
            throw new Error('User credentials could not be found.');
        }
        if (!filePaths.length) {
            throw new Error('No CTD file paths provided.');
        }

        // Generate IDs
        const rawDataId = uuidv4();
        const processedDataId = uuidv4();

        // Create a placeholder for the processed data
        await createProcessedDataPlaceholder(drizzleDB, {
            id: processedDataId,
            dataType: DataType.CTD,
            userId,
            orgId: organizationId,
            sampleId: sampleGroupId,
            statusMessage: 'Waiting for Tauri to start...'
        });

        // Prepare a raw-data entry (not yet inserted)
        const rawDataEntry: RawDataImproved = {
            id: rawDataId,
            data_type: DataType.CTD,
            user_id: userId,
            org_id: organizationId,
            sample_id: sampleGroupId,
            created_at: DateTime.now().toISO()
        };

        let progressUnlisten: UnlistenFn | undefined;

        try {
            // Listen to progress events
            progressUnlisten = await listen<ProgressPayload>(
                'progress',
                async ({ payload }) => {
                    const { progress_percentage, status_message, processing_state } = payload;
                    await updateProcessingState(
                        drizzleDB,
                        processedDataId,
                        progress_percentage,
                        status_message,
                        processing_state
                    );
                }
            );

            // Invoke the Tauri command
            const result: HandleCtdDataResult = await invoke(TauriProcessingFunctions.CTD, {
                sample_id: sampleGroupId,
                org_id: organizationId,
                user_id: userId,
                raw_data_id: rawDataId,
                processed_data_id: processedDataId,
                file_paths: filePaths
            });

            console.debug('CTD processing result:', result);
            if (result.status !== 'Success') {
                throw new Error(`CTD processing failed: ${result.status}`);
            }

            if (!result.report.rawData || result.report.rawData.length === 0) {
                throw new Error('CTD file is empty or invalid.');
            }

            // Update to "Saving" phase
            await updateProcessingState(
                drizzleDB,
                processedDataId,
                0,
                'Saving CTD data to the database...',
                ProcessingState.Saving
            );

            // Insert raw_data_improved
            await drizzleDB.insert(raw_data_improved).values(rawDataEntry).run();

            // Insert raw data in batches
            const { rawData, processedData } = result.report;

            for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
                const batch = rawData.slice(i, i + BATCH_SIZE);
                await drizzleDB.insert(raw_ctd_rbr_data_values).values(batch).run();
            }

            // Insert processed data in batches
            for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
                const batch = processedData.slice(i, i + BATCH_SIZE);
                await drizzleDB.insert(processed_ctd_rbr_data_values).values(batch).run();
            }

            // Finally set to "Complete"
            await updateProcessingState(
                drizzleDB,
                processedDataId,
                100,
                'CTD data successfully saved.',
                ProcessingState.Complete
            );
        } finally {
            // Clean up event listener
            if (progressUnlisten) {
                progressUnlisten();
            }
        }
    }

    /**
     * Process nutrient ammonia data and save to database.
     * (No Tauri invocation needed, purely handled in the frontend.)
     */
    async function processNutrientAmmoniaData(
        sampleGroupId: string,
        ammoniaValue:number,
    ): Promise<void> {
        if (!userId || !organizationId) {
            throw new Error('User credentials could not be found.');
        }

        // Generate IDs
        const rawDataId = uuidv4();
        const processedDataId = uuidv4();
        const rawAmmoniaId = uuidv4();
        const processedAmmoniaId = uuidv4();

        // Create a placeholder for the processed data
        await createProcessedDataPlaceholder(drizzleDB, {
            id: processedDataId,
            dataType: DataType.NutrientAmmonia,
            userId,
            orgId: organizationId,
            sampleId: sampleGroupId,
            statusMessage: 'Initiating...'
        });

        // Prepare data
        const rawDataEntry: RawDataImproved = {
            id: rawDataId,
            data_type: DataType.NutrientAmmonia,
            user_id: userId,
            org_id: organizationId,
            sample_id: sampleGroupId,
            created_at: DateTime.now().toISO()
        };

        const rawAmmoniaEntry: RawNutrientAmmoniaData = {
            id: rawAmmoniaId,
            ammonia: ammoniaValue,
            org_id: organizationId,
            raw_data_id: rawDataId,
            sample_id: sampleGroupId,
            user_id: userId
        };

        // Convert ammonia to ammonium
        const ammoniumValue = ammoniaValue * 55.43;

        const processedAmmoniaEntry: ProcessedNutrientAmmoniaData = {
            id: processedAmmoniaId,
            ammonia: ammoniaValue,
            ammonium: ammoniumValue,
            org_id: organizationId,
            processed_data_id: processedDataId,
            sample_id: sampleGroupId,
            user_id: userId
        };

        // Update to "Saving" phase
        await updateProcessingState(
            drizzleDB,
            processedDataId,
            0,
            'Saving ammonia data to the database...',
            ProcessingState.Saving
        );

        // Insert raw and processed ammonia data
        await drizzleDB.insert(raw_data_improved).values(rawDataEntry).run();
        await drizzleDB.insert(raw_nutrient_ammonia_data).values(rawAmmoniaEntry).run();
        await drizzleDB.insert(processed_nutrient_ammonia_data).values(processedAmmoniaEntry).run();

        // Finally set to "Complete"
        await updateProcessingState(
            drizzleDB,
            processedDataId,
            100,
            'Nutrient (ammonia) data successfully saved.',
            ProcessingState.Complete
        );
    }

    /**
     * Process sequence data files (FASTQ) via Tauri command and save to database.
     */
    async function processSequenceData(
        sampleGroupId: string,
        filePaths: string[]
    ): Promise<void> {
        if (!userId || !organizationId) {
            throw new Error('User credentials could not be found.');
        }
        if (!filePaths.length) {
            throw new Error('No sequence file paths provided.');
        }

        // Generate IDs
        const rawDataId = uuidv4();
        const processedDataId = uuidv4();

        // Create a placeholder for the processed data
        await createProcessedDataPlaceholder(drizzleDB, {
            id: processedDataId,
            dataType: DataType.Sequence,
            userId,
            orgId: organizationId,
            sampleId: sampleGroupId,
            statusMessage: 'Waiting for Tauri to start...'
        });

        // Prepare a raw-data entry (not yet inserted)
        const rawDataEntry: RawDataImproved = {
            id: rawDataId,
            data_type: DataType.Sequence,
            user_id: userId,
            org_id: organizationId,
            sample_id: sampleGroupId,
            created_at: DateTime.now().toISO()
        };

        let progressUnlisten: UnlistenFn | undefined;

        try {
            // Listen to progress events
            progressUnlisten = await listen<ProgressPayload>(
                'progress',
                async ({ payload }) => {
                    const { progress_percentage, status_message, processing_state } = payload;
                    await updateProcessingState(
                        drizzleDB,
                        processedDataId,
                        progress_percentage,
                        status_message,
                        processing_state
                    );
                }
            );

            // Invoke the Tauri command
            const { report, status }: HandleSequenceDataResult = await invoke(
                TauriProcessingFunctions.Sequence,
                {
                    file_paths: filePaths,
                    processed_data_id: processedDataId,
                    raw_data_id: rawDataId,
                    user_id: userId,
                    org_id: organizationId,
                    sample_id: sampleGroupId
                }
            );

            if (status !== 'Success') {
                throw new Error(`Sequence processing failed: ${status}`);
            }

            // Update to "Saving" phase
            await updateProcessingState(
                drizzleDB,
                processedDataId,
                0,
                'Saving sequence data to the database...',
                ProcessingState.Saving
            );

            // Insert raw_data_improved
            await drizzleDB.insert(raw_data_improved).values(rawDataEntry).run();

            // Insert raw FASTQ data in batches
            const { rawSequences, processedKrakenUniqReport, processedKrakenUniqStdout } = report;

            // Bulk insert raw FASTQ data
            await bulkInsertJSON1('raw_fastq_data', ['id', 'feature_id', 'sequence', 'quality', 'run_id', 'read', 'ch', 'start_time', 'sample_id_fastq', 'barcode', 'barcode_alias', 'parent_read_id', 'basecall_model_version_id', 'quality_median', 'flow_cell_id', 'protocol_group_id', 'raw_data_id', 'user_id', 'org_id', 'sample_id'], rawSequences);

            await bulkInsertJSON1('processed_kraken_uniq_report', ['id', 'percentage', 'reads', 'tax_reads', 'kmers', 'duplication', 'coverage', 'tax_id', 'rank', 'tax_name', 'parent_id', 'children_ids', 'processed_data_id', 'user_id', 'org_id', 'sample_id', 'e_score'], processedKrakenUniqReport);

            await bulkInsertJSON1('processed_kraken_uniq_stdout', ['id', 'user_id', 'org_id', 'sample_id', 'processed_data_id', 'classified', 'feature_id', 'tax_id', 'read_length', 'hit_data'], processedKrakenUniqStdout);

            // Finally set to "Complete"
            await updateProcessingState(
                drizzleDB,
                processedDataId,
                100,
                'Sequence data successfully saved.',
                ProcessingState.Complete
            );
        } finally {
            // Clean up event listener
            if (progressUnlisten) {
                progressUnlisten();
            }
        }
    }

    return {
        processSequenceData,
        processCtdData,
        processNutrientAmmoniaData
    };
}
