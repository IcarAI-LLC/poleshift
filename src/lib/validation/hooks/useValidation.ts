// lib/validation/hooks/useValidation.ts
import { useState, useCallback } from 'react';
import { ValidationResult, ValidationSchema } from '../types';
import { validateSchema } from '../validators/validateSchema';

export function useValidation<T extends Record<string, any>>(
    schema: ValidationSchema<T>
) {
    const [validationResult, setValidationResult] = useState<ValidationResult>({
        isValid: true,
        errors: []
    });

    const validate = useCallback(
        (data: Partial<T>): boolean => {
            const result = validateSchema(data, schema);
            setValidationResult(result);
            return result.isValid;
        },
        [schema]
    );

    const getFieldError = useCallback(
        (field: keyof T): string | undefined => {
            const error = validationResult.errors.find(err => err.field === field);
            return error?.message;
        },
        [validationResult]
    );

    const clearValidation = useCallback(() => {
        setValidationResult({
            isValid: true,
            errors: []
        });
    }, []);

    return {
        validate,
        getFieldError,
        clearValidation,
        isValid: validationResult.isValid,
        errors: validationResult.errors
    };
}