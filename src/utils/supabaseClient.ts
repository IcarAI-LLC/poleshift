// src/renderer/utils/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

const REACT_APP_SUPABASE_URL = 'https://poleshift.icarai.cloud';
const REACT_APP_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aWt3a25ueGN1dWhpd3VuZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg0NTQ0MDMsImV4cCI6MjA0NDAzMDQwM30._qVQAlYoL5jtSVCAKIznQ_5pI73Ke08YzZnoy_50Npg';

// Define types for URL and Anon Key if needed
const supabaseUrl: string = REACT_APP_SUPABASE_URL;
const supabaseAnonKey: string = REACT_APP_SUPABASE_ANON_KEY;

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
