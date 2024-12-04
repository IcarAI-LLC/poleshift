import { supabase } from '../supabaseClient';
import { db } from '../powersync/db.ts';
import type { SampleGroupMetadata } from '../types';

class APIService {
    private baseUrl: string;
    private headers: HeadersInit;

    constructor() {
        this.baseUrl = import.meta.env.VITE_API_URL;
        this.headers = {
            'Content-Type': 'application/json',
        };
    }

    // Update headers with authentication token
    private async getAuthHeaders(): Promise<HeadersInit> {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            throw new Error('No authentication session');
        }

        return {
            ...this.headers,
            'Authorization': `Bearer ${session.access_token}`
        };
    }

    // Generic API request method
    private async request<T>(
        endpoint: string,
        method: string = 'GET',
        data?: any,
        customHeaders: HeadersInit = {}
    ): Promise<T> {
        const authHeaders = await this.getAuthHeaders();

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: {
                ...authHeaders,
                ...customHeaders
            },
            body: data ? JSON.stringify(data) : undefined
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || 'API request failed');
        }

        return response.json();
    }

    // Function to handle data processing
    async processData(
        processFunctionName: string,
        sampleGroup: SampleGroupMetadata,
        inputs: Record<string, any>,
        filePaths: string[]
    ): Promise<any> {
        try {
            // First, check if processing is already in progress
            const existingProcess = await db.execute(`
                SELECT status FROM processed_data 
                WHERE sample_id = ? AND status = 'processing'
                LIMIT 1
            `, [sampleGroup.id]);

            if (existingProcess.length > 0) {
                throw new Error('Processing already in progress for this sample');
            }

            // Send processing request to API
            const response = await this.request('/process', 'POST', {
                processFunctionName,
                sampleId: sampleGroup.id,
                inputs,
                filePaths
            });

            return response;
        } catch (error) {
            console.error('Processing error:', error);
            throw error;
        }
    }

    // Function to check processing status
    async checkProcessingStatus(processId: string): Promise<any> {
        return this.request(`/process/${processId}/status`);
    }

    // Function to cancel processing
    async cancelProcessing(processId: string): Promise<void> {
        await this.request(`/process/${processId}/cancel`, 'POST');
    }

    // Function to fetch processing history
    async getProcessingHistory(sampleId: string): Promise<any[]> {
        return this.request(`/process/history/${sampleId}`);
    }

    // Function to validate input parameters
    async validateInputs(
        processFunctionName: string,
        inputs: Record<string, any>
    ): Promise<{ valid: boolean; errors?: string[] }> {
        return this.request('/validate-inputs', 'POST', {
            processFunctionName,
            inputs
        });
    }

    // Function to get available processing functions
    async getAvailableProcessingFunctions(): Promise<string[]> {
        return this.request('/processing-functions');
    }

    // Function to get function metadata
    async getProcessingFunctionMetadata(functionName: string): Promise<any> {
        return this.request(`/processing-functions/${functionName}/metadata`);
    }
}

// Export singleton instance
export const api = new APIService();