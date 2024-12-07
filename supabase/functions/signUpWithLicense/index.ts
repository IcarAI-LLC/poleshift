import { createClient } from 'supabase'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

console.log("Environment variables:")
console.log("SUPABASE_URL:", SUPABASE_URL)
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "Loaded" : "Not found")

const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
)

// Utility function to return responses with CORS headers
function corsResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, *',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': '*',
    },
  })
}

Deno.serve(async (req: Request) => {
  console.log("Incoming request:")
  console.log("Method:", req.method)
  console.log("URL:", req.url)
  console.log("Headers:", Object.fromEntries(req.headers.entries()))

  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    console.log("Handling OPTIONS request")
    return corsResponse(JSON.stringify({ info: 'CORS preflight handled' }), 200);
  }

  try {
    if (req.method !== 'POST') {
      console.log(`Received non-POST request (method: ${req.method})`)
      return corsResponse(JSON.stringify({ error: 'Method Not Allowed' }), 405);
    }

    const requestBody = await req.json();
    console.log("Request JSON Body:", requestBody);

    const { userId, licenseKey } = requestBody;

    if (!userId || !licenseKey) {
      console.log("Missing required fields:", { userId, licenseKey })
      return corsResponse(JSON.stringify({ error: 'Missing required fields (userId, licenseKey)' }), 400);
    }

    // Validate license key by checking license_keys table
    console.log(`Validating license key: ${licenseKey}`);
    const { data: licenseRecord, error: licenseError } = await supabaseAdmin
        .from('license_keys')
        .select('organization_id')
        .eq('key', licenseKey)
        .eq('is_active', true)
        .single();

    if (licenseError || !licenseRecord) {
      console.error("Invalid license key or error fetching license record:", licenseError)
      return corsResponse(JSON.stringify({ error: 'Invalid license key' }), 400);
    }

    const orgId = licenseRecord.organization_id;

    // Now fetch the organization using the retrieved orgId
    const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

    if (orgError || !org) {
      console.error("No organization found for the given license key:", orgError)
      return corsResponse(JSON.stringify({ error: 'No organization found for the given license key' }), 400);
    }

    console.log("License key is valid. Attaching user profile...");

    // Check if user profile already exists
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileCheckError && profileCheckError.details?.includes("0 rows")) {
      // No profile exists, create one
      const { error: profileInsertError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: userId,
            organization_id: org.id,
            user_tier: 'lead' // or another default tier if needed
          });

      if (profileInsertError) {
        console.error("Error creating user profile:", profileInsertError);
        return corsResponse(JSON.stringify({ error: 'Failed to create user profile' }), 400);
      }

      console.log(`User profile created successfully for user: ${userId}`);
      return corsResponse(JSON.stringify({ message: 'License activated and profile created successfully' }), 200);

    } else if (existingProfile) {
      // Profile exists - update it if necessary
      const { error: profileUpdateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ organization_id: org.id, user_tier: 'lead' })
          .eq('id', userId);

      if (profileUpdateError) {
        console.error("Error updating user profile:", profileUpdateError);
        return corsResponse(JSON.stringify({ error: 'Failed to update user profile' }), 400);
      }

      console.log(`User profile updated successfully for user: ${userId}`);
      return corsResponse(JSON.stringify({ message: 'License activated and profile updated successfully' }), 200);
    } else {
      // Some other error fetching profile
      console.error("Unexpected error fetching profile:", profileCheckError);
      return corsResponse(JSON.stringify({ error: 'Failed to fetch user profile' }), 400);
    }

  } catch (error) {
    console.error('Error in activateLicense function:', error);
    return corsResponse(JSON.stringify({ error: 'Internal Server Error' }), 500);
  }
});
