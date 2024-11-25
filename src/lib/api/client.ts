// src/lib/api/client.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://poleshift.icarai.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWt3a25ueGN1dWhpd3VuZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg0NTQ0MDMsImV4cCI6MjA0NDAzMDQwM30._qVQAlYoL5jtSVCAKIznQ_5pI73Ke08YzZnoy_50Npg';

class APIClient {
    private client: SupabaseClient;
    private static instance: APIClient;

    private constructor() {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    public static getInstance(): APIClient {
        if (!APIClient.instance) {
            APIClient.instance = new APIClient();
        }
        return APIClient.instance;
    }

    public getClient(): SupabaseClient {
        return this.client;
    }

    public isOnline(): boolean {
        return navigator.onLine;
    }
}

export const apiClient = APIClient.getInstance();