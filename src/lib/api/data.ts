// src/lib/api/data.ts

import { apiClient } from './client';
import {
    SampleGroup,
    ResearchLocation,
    SampleMetadata,
} from '../types';

export const data = {
    // Sample Group Methods
    async getSampleGroups(orgId: string): Promise<SampleGroup[]> {
        const { data: sampleGroups, error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .select('*')
            .eq('org_id', orgId);

        if (error) throw error;
        return sampleGroups;
    },

    async createSampleGroup(sampleGroup: SampleGroup): Promise<SampleGroup> {
        const { data: createdSampleGroup, error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .insert(sampleGroup)
            .select()
            .single();

        if (error) throw error;
        return createdSampleGroup;
    },

    async updateSampleGroup(id: string, updates: Partial<SampleGroup>): Promise<SampleGroup> {
        const { data: updatedSampleGroup, error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return updatedSampleGroup;
    },

    async deleteSampleGroup(id: string): Promise<void> {
        const { error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Location Methods
    async getLocations(): Promise<ResearchLocation[]> {
        const { data: locations, error } = await apiClient
            .getClient()
            .from('sample_locations')
            .select('*')
            .eq('is_enabled', true);

        if (error) throw error;
        return locations;
    },

    // Processed Data Methods
    async getProcessedDataEntries(sampleGroupId: string): Promise<SampleMetadata[]> {
        const { data: processedDataEntries, error } = await apiClient
            .getClient()
            .from('sample_metadata')
            .select('id, created_at, data_type, process_function_name, processed_storage, updated_at')
            .eq('sample_group_id', sampleGroupId);

        if (error) throw error;

        return processedDataEntries;
    },

    // General Data Insertion Method
    async insertData(tableName: string, record: any): Promise<any> {
        const { data: insertedRecord, error } = await apiClient
            .getClient()
            .from(tableName)
            .insert(record)
            .select()
            .single();

        if (error) throw error;
        return insertedRecord;
    },
};