import { useContext } from 'react';
import { ProcessedDataContext } from '../contexts/ProcessedDataContext';
import { ProcessedDataContextType } from '../types/processed-data';

export const useProcessedData = (): ProcessedDataContextType => {
    const context = useContext(ProcessedDataContext);
    if (context === undefined) {
        throw new Error('useProcessedData must be used within a ProcessedDataProvider');
    }
    return context;
};

export default useProcessedData;