//src/lib/hooks/useTauriDataProcessor.ts

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
const BATCH_SIZE = 999;

import {
    DataType,
    TauriProcessingFunctions,
    RawDataImproved,
    RawNutrientAmmoniaData,
    ProcessedNutrientAmmoniaData,
    ProcessingState
} from '../types';
import {useAuthStore} from "../stores/authStore.ts";
import {HandleCtdDataResult, HandleSequenceDataResult} from "../types/tauri.ts";
import { v4 as uuidv4 } from 'uuid';
import {DateTime} from "luxon";
import {usePowerSync} from "@powersync/react";
import {wrapPowerSyncWithDrizzle} from "@powersync/drizzle-driver";
import {
    processed_ctd_rbr_data_values,
    processed_data_improved,
    processed_kraken_uniq_report,
    processed_kraken_uniq_stdout,
    processed_nutrient_ammonia_data,
    raw_ctd_rbr_data_values,
    raw_data_improved,
    raw_fastq_data,
    raw_nutrient_ammonia_data
} from "../powersync/DrizzleSchema.ts";
import {eq} from "drizzle-orm";

/**
 * useFileProcessor
 * Encapsulates file reading, uploading, Tauri invocation, and progress tracking.
 */
export function useTauriDataProcessor() {
    const { userId, organizationId } = useAuthStore.getState();
    const db = usePowerSync();
    const drizzleDB = wrapPowerSyncWithDrizzle(db);

    const processCtdData =
        async (sampleGroupId: string, filePaths: string[]) => {
            if (!userId || !organizationId) throw new Error('User credentials could not be found');

            // Create IDs for raw and processed table entries
            const rawDataId = uuidv4();
            const processedDataId = uuidv4();

            // Insert a "placeholder" row in processed_data_improved
            await drizzleDB.insert(processed_data_improved).values({
                id: processedDataId,
                data_type: DataType.CTD,
                user_id: userId,
                org_id: organizationId,
                sample_id: sampleGroupId,
                created_at: DateTime.now().toISO(),
                processing_state: ProcessingState.Initiated,
                status_message: 'Waiting for Tauri to start...',
                progress_percentage: 0,
            }).run();

            let rawDataEntry: RawDataImproved = {
                id: rawDataId,
                data_type: DataType.CTD,
                user_id: userId,
                org_id: organizationId,
                sample_id: sampleGroupId,
                created_at: DateTime.now().toISO()
            };

            let progressUnlisten: UnlistenFn | undefined;
            try {
                // Register the event listener *before* invoking the command
                progressUnlisten = await listen('progress', async (event) => {
                    const { progress, status } = event.payload as { progress: number; status: string };

                    // Decide the new processing_state
                    let nextState = ProcessingState.Processing;
                    // Once Tauri signals >= 100% progress, we plan to move on to saving
                    if (progress >= 100) {
                        nextState = ProcessingState.Saving;
                    }

                    try {
                        // Update the DB row for *this* processedDataId
                        await drizzleDB
                            .update(processed_data_improved)
                            .set({
                                progress_percentage: progress,
                                status_message: status,
                                processing_state: nextState,
                            })
                            .where(eq(processed_data_improved.id, processedDataId))
                            .run();
                    } catch (error) {
                        console.error("Failed updating process state:", error);
                    }
                });

                // Invoke the Tauri command
                const result: HandleCtdDataResult = await invoke(TauriProcessingFunctions.CTD, {
                    sample_id: sampleGroupId,
                    org_id: organizationId,
                    user_id: userId,
                    raw_data_id: rawDataId,
                    processed_data_id: processedDataId,
                    file_paths: filePaths,
                });

                console.debug("CTD processing result: ", result);
                console.debug("CTD processing raw entry: ", rawDataEntry);

                if (result.status !== 'Success') {
                    throw new Error('Processing failed.');
                }
                if (!(result.report.rawData.length > 0)) {
                    throw new Error('CTD file is empty.');
                }

                // --- Begin "Saving" phase ---
                await drizzleDB
                    .update(processed_data_improved)
                    .set({
                        processing_state: ProcessingState.Saving,
                        status_message: 'Saving CTD data to the database...',
                    })
                    .where(eq(processed_data_improved.id, processedDataId))
                    .run();

                // Insert raw_data_improved
                const raw = await drizzleDB
                    .insert(raw_data_improved)
                    .values({
                        id: rawDataId,
                        data_type: rawDataEntry.data_type,
                        user_id: rawDataEntry.user_id,
                        org_id: rawDataEntry.org_id,
                        sample_id: rawDataEntry.sample_id,
                        created_at: rawDataEntry.created_at,
                    })
                    .returning({ id: raw_data_improved.id });
                console.debug("CTD processing raw entry id: ", raw);

                // Insert raw data in batches
                for (let i = 0; i < result.report.rawData.length; i += BATCH_SIZE) {
                    const batch = result.report.rawData.slice(i, i + BATCH_SIZE);
                    await drizzleDB
                        .insert(raw_ctd_rbr_data_values)
                        .values(batch)
                        .run();
                }

                // Insert processed data in batches
                for (let i = 0; i < result.report.processedData.length; i += BATCH_SIZE) {
                    const batch = result.report.processedData.slice(i, i + BATCH_SIZE);
                    await drizzleDB
                        .insert(processed_ctd_rbr_data_values)
                        .values(batch)
                        .run();
                }

                // Finally set to "Complete"
                await drizzleDB
                    .update(processed_data_improved)
                    .set({
                        processing_state: ProcessingState.Complete,
                        status_message: 'CTD data successfully saved.',
                        progress_percentage: 100,
                    })
                    .where(eq(processed_data_improved.id, processedDataId))
                    .run();

            } finally {
                if (progressUnlisten) {
                    progressUnlisten();
                }
            }
        }

    const processNutrientAmmoniaData =
        async (
            sampleGroupId: string,
            modalInputs: Record<string, any>,
            _onStatusUpdate?: (statusMessage: string) => void,
        ) => {
            if (!userId || !organizationId) throw new Error('User credentials could not be found');

            const ammoniaValue: number = parseFloat(modalInputs['ammoniaValue']);
            if (!ammoniaValue) throw new Error('No ammonia input');

            // Create IDs for raw and processed table entries
            const rawDataId = uuidv4();
            const processedDataId = uuidv4();

            // Insert a "placeholder" row in processed_data_improved
            await drizzleDB.insert(processed_data_improved).values({
                id: processedDataId,
                data_type: DataType.NutrientAmmonia,
                user_id: userId,
                org_id: organizationId,
                sample_id: sampleGroupId,
                created_at: DateTime.now().toISO(),
                processing_state: ProcessingState.Initiated,
                status_message: 'Initiating...',
                progress_percentage: 0,
            }).run();

            // We'll also keep the standard "raw" + "processed" IDs for ammonia
            const rawAmmoniaId = uuidv4();
            const processedAmmoniaId = uuidv4();

            let rawDataEntry: RawDataImproved = {
                id: rawDataId,
                data_type: DataType.NutrientAmmonia,
                user_id: userId,
                org_id: organizationId,
                sample_id: sampleGroupId,
                created_at: DateTime.now().toISO()
            };

            // Calculate ammonium from ammonia
            let ammoniumValue = ammoniaValue * 55.43;

            let rawAmmoniaEntry: RawNutrientAmmoniaData = {
                id: rawAmmoniaId,
                ammonia: ammoniaValue,
                org_id: organizationId,
                raw_data_id: rawDataId,
                sample_id: sampleGroupId,
                user_id: userId,
            };
            let processedAmmoniaEntry: ProcessedNutrientAmmoniaData = {
                id: processedAmmoniaId,
                ammonia: ammoniaValue,
                ammonium: ammoniumValue,
                org_id: organizationId,
                processed_data_id: processedDataId,
                sample_id: sampleGroupId,
                user_id: userId,
            };

            // --- Begin "Saving" phase ---
            await drizzleDB
                .update(processed_data_improved)
                .set({
                    processing_state: ProcessingState.Saving,
                    status_message: 'Saving ammonia data to the database...',
                })
                .where(eq(processed_data_improved.id, processedDataId))
                .run();

            await drizzleDB
                .insert(raw_data_improved)
                .values([rawDataEntry])
                .run();
            await drizzleDB
                .insert(raw_nutrient_ammonia_data)
                .values([rawAmmoniaEntry])
                .run();
            await drizzleDB
                .insert(processed_nutrient_ammonia_data)
                .values([processedAmmoniaEntry])
                .run();

            // Finally set to "Complete"
            await drizzleDB
                .update(processed_data_improved)
                .set({
                    progress_percentage: 100,
                    status_message: 'Nutrient (ammonia) data successfully saved.',
                    processing_state: ProcessingState.Complete,
                })
                .where(eq(processed_data_improved.id, processedDataId))
                .run();
        }

    const processSequenceData =
        async (sampleGroupId: string, filePaths: string[]) => {
            if (!userId || !organizationId) throw new Error('User credentials could not be found');

            // Create IDs for raw and processed table entries
            const rawDataId = uuidv4();
            const processedDataId = uuidv4();

            // Insert a "placeholder" row in processed_data_improved
            await drizzleDB.insert(processed_data_improved).values({
                id: processedDataId,
                data_type: DataType.Sequence,
                user_id: userId,
                org_id: organizationId,
                sample_id: sampleGroupId,
                created_at: DateTime.now().toISO(),
                processing_state: ProcessingState.Initiated,
                status_message: 'Waiting for Tauri to start...',
                progress_percentage: 0,
            }).run();

            let rawDataEntry: RawDataImproved = {
                id: rawDataId,
                data_type: DataType.Sequence,
                user_id: userId,
                org_id: organizationId,
                sample_id: sampleGroupId,
                created_at: DateTime.now().toISO()
            };

            let progressUnlisten: UnlistenFn | undefined;
            try {
                // Register the event listener *before* invoking the command
                progressUnlisten = await listen('progress', async (event) => {
                    const { progress, status } = event.payload as { progress: number; status: string };

                    let nextState = ProcessingState.Processing;
                    // Once Tauri signals >= 100% progress, we plan to move on to saving
                    if (progress >= 100) {
                        nextState = ProcessingState.Saving;
                    }

                    try {
                        // Update the DB row for *this* processedDataId
                        await drizzleDB
                            .update(processed_data_improved)
                            .set({
                                progress_percentage: progress,
                                status_message: status,
                                processing_state: nextState,
                            })
                            .where(eq(processed_data_improved.id, processedDataId))
                            .run();
                    } catch (error) {
                        console.error("Failed updating process state:", error);
                    }
                });

                // Invoke the Tauri command
                const { report, status }: HandleSequenceDataResult = await invoke(
                    TauriProcessingFunctions.Sequence,
                    {
                        file_paths: filePaths,
                        processed_data_id: processedDataId,
                        raw_data_id: rawDataId,
                        user_id: userId,
                        org_id: organizationId,
                        sample_id: sampleGroupId,
                    }
                );

                const { rawSequences, processedKrakenUniqReport, processedKrakenUniqStdout } = report;

                if (status !== 'Success') {
                    throw new Error(status);
                }
                console.debug("Kraken report: ", report);

                // --- Begin "Saving" phase ---
                await drizzleDB
                    .update(processed_data_improved)
                    .set({
                        processing_state: ProcessingState.Saving,
                        status_message: 'Saving sequence data to the database...',
                    })
                    .where(eq(processed_data_improved.id, processedDataId))
                    .run();

                // Insert raw_data_improved
                await drizzleDB
                    .insert(raw_data_improved)
                    .values(rawDataEntry)
                    .run();

                // Insert raw FASTQ data in batches
                for (let i = 0; i < rawSequences.length; i += BATCH_SIZE) {
                    const batch = rawSequences.slice(i, i + BATCH_SIZE);
                    await drizzleDB
                        .insert(raw_fastq_data)
                        .values(batch)
                        .run();
                }

                // Insert processed Kraken (uniq) report data
                for (let i = 0; i < processedKrakenUniqReport.length; i += BATCH_SIZE) {
                    const batch = processedKrakenUniqReport.slice(i, i + BATCH_SIZE);
                    await drizzleDB
                        .insert(processed_kraken_uniq_report)
                        .values(batch)
                        .run();
                }

                // Insert processed Kraken (uniq) stdout data
                for (let i = 0; i < processedKrakenUniqStdout.length; i += BATCH_SIZE) {
                    const batch = processedKrakenUniqStdout.slice(i, i + BATCH_SIZE);
                    await drizzleDB
                        .insert(processed_kraken_uniq_stdout)
                        .values(batch)
                        .run();
                }

                // Finally set to "Complete"
                await drizzleDB
                    .update(processed_data_improved)
                    .set({
                        progress_percentage: 100,
                        status_message: 'Sequence data successfully saved.',
                        processing_state: ProcessingState.Complete,
                    })
                    .where(eq(processed_data_improved.id, processedDataId))
                    .run();

            } finally {
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
