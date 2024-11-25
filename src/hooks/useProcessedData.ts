// src/renderer/hooks/useData.ts

import { useContext } from 'react';
import { ProcessedDataContext } from '../contexts/ProcessedDataContext.tsx';

const useProcessedData = (): any => {
    const context = useContext(ProcessedDataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export default useProcessedData;
