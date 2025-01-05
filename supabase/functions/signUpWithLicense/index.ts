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
const DEFAULT_ROLE = 'viewer';

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

    console.log("License key is valid. Attaching user role...");

    // Check if user role exists
    const { error: roleCheckError } = await supabaseAdmin
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (roleCheckError && roleCheckError.details?.includes("0 rows")) {
      // No role exists, create one
      const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            user_role: DEFAULT_ROLE
          });

      if (roleInsertError) {
        console.error("Error assigning user role:", roleInsertError);
        return corsResponse(JSON.stringify({ error: 'Failed to create user role' }), 400);
      }

      console.log(`User role assigned successfully for user: ${userId}`);
      return corsResponse(JSON.stringify({ message: 'License activated and role created successfully' }), 200);

    }

    // Check if user organization exists
    const { error: orgCheckError } = await supabaseAdmin
        .from('user_organizations')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (orgCheckError && orgCheckError.details?.includes("0 rows")) {
      // No org is attached to this user, attach one
      const { error: orgInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            organization_id: orgId
          });

      if (orgInsertError) {
        console.error("Error assigning user org:", orgInsertError);
        return corsResponse(JSON.stringify({ error: 'Failed to create user org' }), 400);
      }

      console.log(`User org assigned successfully for user: ${userId}`);
      return corsResponse(JSON.stringify({ message: 'License activated and org attached successfully' }), 200);

    }

    // Check if user profile exists
    const { error: profileCheckError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileCheckError && profileCheckError.details?.includes("0 rows")) {
      // No org is attached to this user, attach one
      const { error: profileInsertError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: userId,
            organization_id: orgId,
            user_role: DEFAULT_ROLE
          });

      if (profileInsertError) {
        console.error("Error creating user profile:", profileInsertError);
        return corsResponse(JSON.stringify({ error: 'Failed to create user profile' }), 400);
      }

      console.log(`User profile created successfully for user: ${userId}`);
      return corsResponse(JSON.stringify({ message: 'License activated and profile attached successfully' }), 200);
    }
  } catch (error) {
    console.error('Error in activateLicense function:', error);
    return corsResponse(JSON.stringify({ error: 'Internal Server Error' }), 500);
  }
});
