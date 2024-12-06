// src/lib/services/licenseService.ts

import { supabaseConnector } from '../powersync/SupabaseConnector';
import { Organization } from '../types';

export const processLicenseKey = async (licenseKey: string): Promise<Organization | null> => {
    // Validate the license key
    const { data, error } = await supabaseConnector.client
        .from('license_keys')
        .select('organization_id')
        .eq('key', licenseKey)
        .eq('is_active', 1)
        .single();

    if (error) {
        console.error('License key validation failed:', error.message);
        throw new Error('Invalid or inactive license key.');
    }

    // Fetch the associated organization
    const { data: orgData, error: orgError } = await supabaseConnector.client
        .from('organizations')
        .select('*')
        .eq('id', data.organization_id)
        .single();

    if (orgError) {
        console.error('Organization fetch failed:', orgError.message);
        throw new Error('Failed to fetch organization for license key.');
    }

    return orgData;
};
