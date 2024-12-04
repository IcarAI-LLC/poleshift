// Re-export everything from major subsystems
export * from './stores';
export * from './services';
export * from './hooks';
export * from './utils';
export * from './types';

// Export supabase client
export {
    supabase,
    handleSupabaseError,
    isSupabaseAuthError,
    isSupabaseNetworkError
} from './supabase/client';
export type { SupabaseClient } from './supabase/client';

// Export the initialized services
import { storage } from './services/storage/IndexedDBStorageService';
import { SupabaseApiService } from './services/api/SupabaseApiService';
import { createServices } from './services';
import { supabase } from './supabase/client';

// Initialize core services
const api = new SupabaseApiService(supabase, storage);
export const services = createServices(storage, api);

// Initialize stores (if needed)
// The stores are already self-initializing through the use of create()