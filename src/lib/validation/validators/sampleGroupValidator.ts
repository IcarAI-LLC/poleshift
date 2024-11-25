// lib/validation/validators/sampleGroupValidator.ts
import { SampleGroup } from '../../types';
import { ValidationResult } from '../types';
import { sampleGroupSchema } from '../schemas/sampleGroupSchema';
import { validateSchema } from './validateSchema';

export class SampleGroupValidator {
    public static validate(sample: Partial<SampleGroup>): ValidationResult {
        return validateSchema(sample, sampleGroupSchema);
    }

    public static validateLocation(lat?: number | null, long?: number | null): ValidationResult {
        const errors = [];

        if (lat !== undefined && lat !== null) {
            if (lat < -90 || lat > 90) {
                errors.push({
                    field: 'latitude_recorded',
                    message: 'Latitude must be between -90 and 90 degrees',
                    code: 'RANGE'
                });
            }
        }

        if (long !== undefined && long !== null) {
            if (long < -180 || long > 180) {
                errors.push({
                    field: 'longitude_recorded',
                    message: 'Longitude must be between -180 and 180 degrees',
                    code: 'RANGE'
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
