// lib/contexts/ValidationContext.tsx
import React, { createContext, useContext, useCallback } from 'react';
import { ValidationSchema, ValidationResult } from '../validation/types';
import { validateSchema } from '../validation/validators/validateSchema';

interface ValidationContextType {
    validateData: <T>(data: Partial<T>, schema: ValidationSchema<T>) => ValidationResult;
}

const ValidationContext = createContext<ValidationContextType | undefined>(undefined);

export const ValidationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const validateData = useCallback(<T extends Record<string, any>>(
        data: Partial<T>,
        schema: ValidationSchema<T>
    ): ValidationResult => {
        return validateSchema(data, schema);
    }, []);

    return (
        <ValidationContext.Provider value={{ validateData }}>
            {children}
        </ValidationContext.Provider>
    );
};

export const useValidation = () => {
    const context = useContext(ValidationContext);
    if (!context) {
        throw new Error('useValidation must be used within a ValidationProvider');
    }
    return context;
};