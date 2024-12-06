// functions/check-connection/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

console.log(`Function "check-connection" up and running!`);

serve(async (req) => {
  // Define CORS headers as per Supabase's recommendation
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Since we're just checking network status, we can return a simple response
    const data = {
      status: 'online',
    };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
        JSON.stringify({ error: (error as Error).message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
    );
  }
});
