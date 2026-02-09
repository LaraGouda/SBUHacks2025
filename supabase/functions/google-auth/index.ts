import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected JSON.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, code, refreshToken, state, email, userInfo } = body;

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    // Get Supabase URL from environment or construct from request
    let supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL');
    
    if (!supabaseUrl) {
      // Try to construct from request URL
      const url = new URL(req.url);
      // Remove /functions/v1/google-auth from the path
      supabaseUrl = url.origin;
    }
    
    // Ensure no trailing slash
    supabaseUrl = supabaseUrl.replace(/\/$/, '');
    const redirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'getAuthUrl') {
      // Validate client ID format (should start with numbers and contain a hyphen)
      if (!clientId || !clientId.match(/^\d+-[a-zA-Z0-9]+/)) {
        console.error('Invalid Client ID format:', clientId);
        return new Response(
          JSON.stringify({ 
            error: 'Invalid Google Client ID format. Please check your GOOGLE_CLIENT_ID secret.',
            details: {
              clientIdLength: clientId?.length || 0,
              clientIdPrefix: clientId?.substring(0, 20) || 'missing',
              hasClientId: !!clientId
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate redirect URI
      if (!redirectUri || !redirectUri.startsWith('https://')) {
        console.error('Invalid redirect URI:', redirectUri);
        return new Response(
          JSON.stringify({ 
            error: `Invalid redirect URI: ${redirectUri}. Please check your PROJECT_URL secret.`,
            details: {
              redirectUri,
              supabaseUrl,
              hasProjectUrl: !!Deno.env.get('PROJECT_URL')
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
      
      // Build OAuth URL with proper encoding
      const scopes = 'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `access_type=offline&` +
        `prompt=consent` +
        stateParam;

      return new Response(
        JSON.stringify({ 
          authUrl, 
          redirectUri, 
          clientId: clientId?.substring(0, 20) + '...',
          clientIdLength: clientId?.length,
          redirectUriForGoogle: redirectUri
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'checkConfig') {
      // Debug endpoint to check configuration
      return new Response(
        JSON.stringify({
          hasClientId: !!clientId,
          clientIdLength: clientId?.length || 0,
          clientIdPrefix: clientId?.substring(0, 20) || 'missing',
          hasClientSecret: !!clientSecret,
          clientSecretLength: clientSecret?.length || 0,
          supabaseUrl,
          redirectUri,
          redirectUriForGoogle: redirectUri,
          projectUrl: Deno.env.get('PROJECT_URL') || 'not set',
          supabaseUrlEnv: Deno.env.get('SUPABASE_URL') || 'not set',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'exchangeCode') {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || 'Failed to exchange code');
      }

      return new Response(
        JSON.stringify(tokenData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'refreshToken') {
      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: 'Refresh token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || 'Failed to refresh token');
      }

      return new Response(
        JSON.stringify(tokenData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'signInUser') {
      // Sign in existing user using admin API
      // This requires the service role key
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!serviceRoleKey) {
        return new Response(
          JSON.stringify({ error: 'Service role key not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'Email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get Supabase URL
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL');
      if (!supabaseUrl) {
        return new Response(
          JSON.stringify({ error: 'Supabase URL not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Use admin API to generate a session for the user
      // First, get the user by email
      const adminUrl = `${supabaseUrl}/auth/v1/admin/users`;
      const userResponse = await fetch(`${adminUrl}?email=${encodeURIComponent(email)}`, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('Failed to find user:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to find user', details: errorText }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const users = await userResponse.json();
      if (!users.users || users.users.length === 0) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const user = users.users[0];
      
      // Generate a session token for the user using admin API
      const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}/sessions`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expires_in: 3600 // 1 hour
        })
      });
      
      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('Failed to create session:', errorText);
        return new Response(
          JSON.stringify({ 
            error: errorData.error || 'Failed to create session',
            details: errorText,
            status: sessionResponse.status
          }),
          { status: sessionResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const sessionData = await sessionResponse.json();
      
      // The session response should contain access_token and refresh_token
      // Format it properly for the client
      return new Response(
        JSON.stringify({ 
          session: {
            access_token: sessionData.access_token || sessionData.session?.access_token,
            refresh_token: sessionData.refresh_token || sessionData.session?.refresh_token,
            expires_in: sessionData.expires_in || 3600,
            expires_at: sessionData.expires_at || sessionData.session?.expires_at,
            token_type: sessionData.token_type || 'bearer',
            user: sessionData.user || user
          },
          user: user
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in google-auth function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
