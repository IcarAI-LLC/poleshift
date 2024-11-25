// lib/validation/validators/validateSchema.ts
import { ValidationResult, ValidationSchema } from '../types';

export function validateSchema<T extends Record<string, any>>(
    data: Partial<T>,
    schema: ValidationSchema<T>
): ValidationResult {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
        if (!rules) continue;

        const value = data[field];
        for (const rule of rules) {
            if (!rule.validate(value)) {
                errors.push({
                    field,
                    message: rule.message,
                    code: rule.code
                });
                break; // Stop on first error for this field
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}