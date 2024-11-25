// lib/hooks/useValidatedForm.ts
import { useState, useCallback } from 'react';
import { ValidationSchema, convertValidationErrors } from '../validation/types';
import { validateSchema } from '../validation/validators/validateSchema';
import { APIError, StorageError, ValidationError } from '../types/errors';

interface UseValidatedFormProps<T> {
    schema: ValidationSchema<T>;
    onSubmit: (data: T) => Promise<void>;
    initialData?: Partial<T>;
}

export function useValidatedForm<T extends Record<string, any>>({
                                                                    schema,
                                                                    onSubmit,
                                                                    initialData = {}
                                                                }: UseValidatedFormProps<T>) {
    const [formData, setFormData] = useState<Partial<T>>(initialData);
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    const handleChange = useCallback((
        field: keyof T,
        value: T[keyof T]
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        setIsDirty(true);
    }, []);

    const validateForm = useCallback((): boolean => {
        const result = validateSchema(formData, schema);
        if (!result.isValid) {
            setErrors(convertValidationErrors(result.errors));
        } else {
            setErrors([]);
        }
        return result.isValid;
    }, [formData, schema]);

    const handleSubmit = useCallback(async (
        e?: React.FormEvent
    ) => {
        if (e) {
            e.preventDefault();
        }

        if (!validateForm()) {
            return;
        }

        try {
            await onSubmit(formData as T);
            setIsDirty(false);
            setErrors([]);
        } catch (error) {
            if (error instanceof ValidationError) {
                setErrors(error.validationErrors);
            } else if (error instanceof APIError || error instanceof StorageError) {
                setErrors([new ValidationError(error.message, [])]);
            } else {
                throw error;
            }
        }
    }, [formData, validateForm, onSubmit]);

    return {
        formData,
        handleChange,
        handleSubmit,
        validateForm,
        errors,
        isDirty,
        setFormData
    };
}