// lib/services/SampleGroupService.ts
import { storage } from '../storage';
import { api } from '../api';
import { SampleGroup } from '../types';
import { sampleGroupSchema } from '../validation/schemas/sampleGroupSchema';
import { validateSchema } from '../validation/validators/validateSchema';
import { APIError, StorageError, ValidationError } from '../types';
import { convertValidationErrors } from '../validation/types';

export class SampleGroupService {
    public static async createSampleGroup(data: Omit<SampleGroup, 'id'>): Promise<SampleGroup> {
        // Validate before proceeding
        const validationResult = validateSchema(data, sampleGroupSchema);
        if (!validationResult.isValid) {
            throw new ValidationError(
                'Invalid sample group data',
                convertValidationErrors(validationResult.errors)
            );
        }

        try {
            // If online, create on server first
            if (navigator.onLine) {
                const sampleGroup = await api.data.createSampleGroup(data);
                await storage.saveSampleGroup(sampleGroup);
                return sampleGroup;
            }

            // If offline, save to local storage and queue for sync
            const sampleGroup: SampleGroup = {
                ...data,
                id: crypto.randomUUID()
            };

            await storage.saveSampleGroup(sampleGroup);
            await storage.addPendingOperation({
                type: 'insert',
                table: 'sample_group_metadata',
                data: sampleGroup,
                timestamp: Date.now()
            });

            return sampleGroup;
        } catch (error) {
            if (error instanceof Error) {
                throw new APIError('Failed to create sample group', error);
            }
            throw error;
        }
    }

    public static async updateSampleGroup(
        id: string,
        updates: Partial<Omit<SampleGroup, 'id'>>
    ): Promise<SampleGroup> {
        // Get current group to merge with updates for validation
        const currentGroup = await storage.getSampleGroup(id);
        if (!currentGroup) {
            throw new StorageError('Sample group not found');
        }

        // Merge current data with updates for validation
        const mergedData = { ...currentGroup, ...updates };

        // Validate the merged data
        const validationResult = validateSchema(mergedData, sampleGroupSchema);
        if (!validationResult.isValid) {
            throw new ValidationError(
                'Invalid sample group updates',
                convertValidationErrors(validationResult.errors)
            );
        }

        try {
            // Update local storage
            const updatedGroup = { ...currentGroup, ...updates };
            await storage.saveSampleGroup(updatedGroup);

            // If online, update server
            if (navigator.onLine) {
                const serverGroup = await api.data.updateSampleGroup(id, updates);
                await storage.saveSampleGroup(serverGroup);
                return serverGroup;
            }

            // If offline, queue for sync
            await storage.addPendingOperation({
                type: 'update',
                table: 'sample_group_metadata',
                data: { id, updates },
                timestamp: Date.now()
            });

            return updatedGroup;
        } catch (error) {
            if (error instanceof Error) {
                throw new APIError('Failed to update sample group', error);
            }
            throw error;
        }
    }
}