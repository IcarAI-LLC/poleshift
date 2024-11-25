// lib/validation/validators/commonValidators.ts
import {ValidationRule} from "../types";

export const required = <T>(message = 'This field is required'): ValidationRule<T> => ({
    validate: (value: T) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    },
    message,
    code: 'REQUIRED'
});

export const maxLength = (max: number, message = `Maximum length is ${max}`): ValidationRule<string> => ({
    validate: (value: string) => !value || value.length <= max,
    message,
    code: 'MAX_LENGTH'
});

export const minLength = (min: number, message = `Minimum length is ${min}`): ValidationRule<string> => ({
    validate: (value: string) => !value || value.length >= min,
    message,
    code: 'MIN_LENGTH'
});

export const isNumber = (message = 'Must be a number'): ValidationRule<any> => ({
    validate: (value: any) => !value || !isNaN(Number(value)),
    message,
    code: 'NUMBER'
});

export const range = (
    min: number,
    max: number,
    message = `Value must be between ${min} and ${max}`
): ValidationRule<number | null> => ({
    validate: (value: number | null) =>
        // If value is null, consider it valid (use required() separately if the field is mandatory)
        value === null || (value >= min && value <= max),
    message,
    code: 'RANGE'
});

// Optional: Add a specific validator for coordinates that handles null values
export const coordinateRange = (
    min: number,
    max: number,
    message = `Coordinate must be between ${min} and ${max}`
): ValidationRule<number | null> => ({
    validate: (value: number | null) => {
        if (value === null) return true;
        return value >= min && value <= max;
    },
    message,
    code: 'COORDINATE_RANGE'
});

export const isDate = (message = 'Must be a valid date'): ValidationRule<any> => ({
    validate: (value: any) => !value || !isNaN(Date.parse(value)),
    message,
    code: 'DATE'
});