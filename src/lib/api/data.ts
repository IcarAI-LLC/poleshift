// src/lib/api/data.ts

import { apiClient } from './client';
import { SampleGroup, Location } from '../types';

export const data = {
    async getSampleGroups(orgId: string): Promise<SampleGroup[]> {
        const { data, error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .select('*')
            .eq('org_id', orgId);

        if (error) throw error;
        return data;
    },

    async createSampleGroup(sampleGroup: Omit<SampleGroup, 'id'>): Promise<SampleGroup> {
        const { data, error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .insert(sampleGroup)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateSampleGroup(id: string, updates: Partial<SampleGroup>): Promise<SampleGroup> {
        const { data, error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteSampleGroup(id: string): Promise<void> {
        const { error } = await apiClient
            .getClient()
            .from('sample_group_metadata')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getLocations(): Promise<Location[]> {
        const { data, error } = await apiClient
            .getClient()
            .from('sample_locations')
            .select('*')
            .eq('is_enabled', true);

        if (error) throw error;
        return data;
    }
};