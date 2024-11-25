// lib/validation/types.ts
import { ValidationError as AppValidationError } from '../types/errors';

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationFieldError[];
}

// Rename to avoid confusion with the app's ValidationError
export interface ValidationFieldError {
    field: string;
    message: string;
    code: string;
}

export interface ValidationRule<T> {
    validate: (value: T) => boolean;
    message: string;
    code: string;
}

export type ValidationSchema<T> = {
    [K in keyof T]?: ValidationRule<T[K]>[];
};

// Helper to convert validation field errors to app validation errors
export function convertValidationErrors(fieldErrors: ValidationFieldError[]): AppValidationError[] {
    return fieldErrors.map(error => new AppValidationError(
        error.message,
        [],
        { field: error.field, code: error.code }
    ));
}
