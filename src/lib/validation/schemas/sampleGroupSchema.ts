// lib/validation/schemas/sampleGroupSchema.ts
import { SampleGroup } from '../../types';
import { ValidationSchema } from '../types';
import {
    required,
    isDate,
    coordinateRange,
    maxLength
} from '../validators/commonValidators';

export const sampleGroupSchema: ValidationSchema<SampleGroup> = {
    name: [
        required('Sample group name is required'),
        maxLength(100, 'Name must be 100 characters or less')
    ],
    collection_date: [
        required('Collection date is required'),
        isDate('Must be a valid date')
    ],
    latitude_recorded: [
        coordinateRange(-90, 90, 'Latitude must be between -90 and 90 degrees')
    ],
    longitude_recorded: [
        coordinateRange(-180, 180, 'Longitude must be between -180 and 180 degrees')
    ],
    loc_id: [
        required('Location is required')
    ]
};