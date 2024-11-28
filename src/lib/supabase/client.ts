// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://poleshift.icarai.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWt3a25ueGN1dWhpd3VuZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg0NTQ0MDMsImV4cCI6MjA0NDAzMDQwM30._qVQAlYoL5jtSVCAKIznQ_5pI73Ke08YzZnoy_50Npg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: window.localStorage
    }
});