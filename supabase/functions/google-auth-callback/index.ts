import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

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

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(
      `<html><body><script>window.opener.postMessage({ type: 'google-oauth-error', error: '${error}' }, '*'); window.close();</script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }

  if (!code) {
    return new Response('No authorization code received', { 
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    // Get Supabase URL from environment or construct from request
    let supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL');
    
    if (!supabaseUrl) {
      // Try to construct from request URL
      const url = new URL(req.url);
      // The request URL is like: https://[project-ref].supabase.co/functions/v1/google-auth-callback
      // We need: https://[project-ref].supabase.co
      supabaseUrl = url.origin;
    }
    
    // Ensure no trailing slash and validate format
    supabaseUrl = supabaseUrl.replace(/\/$/, '');
    
    // Validate that we have a proper Supabase URL
    if (!supabaseUrl.includes('supabase.co')) {
      console.error('Invalid Supabase URL:', supabaseUrl);
      throw new Error('Invalid Supabase URL configuration');
    }
    
    console.log('Using Supabase URL:', supabaseUrl);
    const redirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

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
      const errorMsg = tokenData.error_description || tokenData.error || 'Failed to get access token';
      throw new Error(errorMsg);
    }

    if (!tokenData.access_token) {
      throw new Error('No access token received from Google');
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    let userInfo = null;
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    // Always redirect to home page after OAuth, not back to auth page
    // Get frontend URL from state parameter or environment variable
    const stateParam = url.searchParams.get('state') || '';
    let redirectUrl: string;
    
    // If state is a full URL, extract just the origin (home page)
    if (stateParam && (stateParam.startsWith('http://') || stateParam.startsWith('https://'))) {
      try {
        const stateUrl = new URL(stateParam);
        redirectUrl = `${stateUrl.origin}/`;
      } catch {
        // If parsing fails, use as-is
        redirectUrl = stateParam.endsWith('/') ? stateParam : `${stateParam}/`;
      }
    } else {
      // Try environment variable
      const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('APP_URL');
      if (frontendUrl && (frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://'))) {
        redirectUrl = frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`;
      } else {
        // Fallback: use localhost for development
        redirectUrl = 'http://localhost:8080/';
      }
    }

    // Create or sign in Supabase user using Admin API
    let supabaseSession = null;
    let userId: string | null = null;
    
    if (userInfo?.email) {
      try {
        // Try multiple possible secret names
        const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || 
                               Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
                               Deno.env.get('SUPABASE_SERVICE_KEY');
        if (!serviceRoleKey) {
          console.error('Service role key not set in edge function secrets. Please set SERVICE_ROLE_KEY, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SERVICE_KEY');
          throw new Error('Service role key not configured');
        }
        
        if (!supabaseUrl) {
          console.error('SUPABASE_URL not set');
          throw new Error('SUPABASE_URL not configured');
        }
        
        // Initialize Supabase client for database operations
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

          // First, try to find existing user
          const adminUrl = `${supabaseUrl}/auth/v1/admin/users`;
          const userResponse = await fetch(`${adminUrl}?email=${encodeURIComponent(userInfo.email)}`, {
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (userResponse.ok) {
            const users = await userResponse.json();
            if (users.users && users.users.length > 0) {
              // Existing user found - link Google account and create session
              const existingUser = users.users[0];
              userId = existingUser.id;
              
              // Update user metadata to include Google info if not already present
              const updateUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  user_metadata: {
                    ...existingUser.user_metadata,
                    full_name: existingUser.user_metadata?.full_name || userInfo.name,
                    avatar_url: existingUser.user_metadata?.avatar_url || userInfo.picture,
                    google_connected: true,
                  },
                  app_metadata: {
                    ...existingUser.app_metadata,
                    provider: existingUser.app_metadata?.provider || 'google',
                  }
                })
              });

              if (updateUserResponse.ok) {
                console.log('Updated existing user with Google info');
              }
              
              // Create session for existing user using Supabase Admin API
              // Try using the Supabase client's admin methods first
              try {
                // Use Supabase client admin to generate a session
                const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                  type: 'magiclink',
                  email: userInfo.email,
                });
                
                if (linkError) {
                  console.error('Error generating link:', linkError);
                  throw linkError;
                }
                
                // The generateLink doesn't create a session directly, so we need to use the token
                // Instead, let's try the direct API endpoint with the correct format
                const sessionEndpoint = `${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`;
                console.log('Creating session at:', sessionEndpoint);
                console.log('Using service role key (first 20 chars):', serviceRoleKey.substring(0, 20));
                
                const sessionResponse = await fetch(sessionEndpoint, {
                  method: 'POST',
                  headers: {
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    expires_in: 3600
                  })
                });

                if (sessionResponse.ok) {
                  supabaseSession = await sessionResponse.json();
                  console.log('Created session for existing user:', {
                    hasAccessToken: !!supabaseSession?.access_token,
                    hasRefreshToken: !!supabaseSession?.refresh_token,
                    userId: supabaseSession?.user?.id,
                    sessionKeys: Object.keys(supabaseSession || {})
                  });
                } else {
                  const errorText = await sessionResponse.text();
                  let errorData;
                  try {
                    errorData = JSON.parse(errorText);
                  } catch {
                    errorData = { message: errorText };
                  }
                  console.error('Failed to create session for existing user:', {
                    status: sessionResponse.status,
                    statusText: sessionResponse.statusText,
                    error: errorData,
                    endpoint: sessionEndpoint,
                    userId: userId,
                    supabaseUrl: supabaseUrl,
                    hasServiceRoleKey: !!serviceRoleKey
                  });
                }
              } catch (sessionError) {
                console.error('Session creation error:', sessionError);
                // Continue without session - frontend will handle it
              }
            } else {
              // No existing user found - create new user with Google OAuth
              const createUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
                method: 'POST',
                headers: {
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  email: userInfo.email,
                  email_confirm: true,
                  user_metadata: {
                    full_name: userInfo.name,
                    avatar_url: userInfo.picture,
                    google_connected: true,
                  },
                  app_metadata: {
                    provider: 'google',
                  }
                })
              });

              if (createUserResponse.ok) {
                const newUser = await createUserResponse.json();
                userId = newUser.id;
                
                // Create session for new user
                const sessionEndpoint = `${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`;
                console.log('Creating session for new user at:', sessionEndpoint);
                
                const sessionResponse = await fetch(sessionEndpoint, {
                  method: 'POST',
                  headers: {
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    expires_in: 3600
                  })
                });

                if (sessionResponse.ok) {
                  supabaseSession = await sessionResponse.json();
                  console.log('Created new user and session:', {
                    hasAccessToken: !!supabaseSession?.access_token,
                    hasRefreshToken: !!supabaseSession?.refresh_token,
                    userId: supabaseSession?.user?.id,
                    sessionKeys: Object.keys(supabaseSession || {})
                  });
                } else {
                  const errorText = await sessionResponse.text();
                  let errorData;
                  try {
                    errorData = JSON.parse(errorText);
                  } catch {
                    errorData = { message: errorText };
                  }
                  console.error('Failed to create session for new user:', {
                    status: sessionResponse.status,
                    statusText: sessionResponse.statusText,
                    error: errorData,
                    endpoint: sessionEndpoint,
                    userId: userId,
                    supabaseUrl: supabaseUrl
                  });
                }
              }
            }

            // Store OAuth tokens in database
            if (userId && tokenData.access_token) {
              const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
              
              // Upsert OAuth token
              const { error: tokenError } = await supabase
                .from('oauth_tokens')
                .upsert({
                  user_id: userId,
                  provider: 'google',
                  access_token: tokenData.access_token,
                  refresh_token: tokenData.refresh_token || null,
                  expires_at: expiresAt,
                  scope: tokenData.scope || null
                }, {
                  onConflict: 'user_id,provider'
                });

              if (tokenError) {
                console.error('Error storing OAuth token:', tokenError);
              } else {
                console.log('OAuth token stored successfully');
              }
            }
            } else {
              console.warn('userResponse not ok:', userResponse.status);
            }
      } catch (error) {
        console.error('Error creating Supabase session:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If it's a connection error, log it but continue
        if (errorMessage.includes('Service role key') || errorMessage.includes('SUPABASE_URL')) {
          console.error('Configuration error - check edge function secrets:', errorMessage);
          // Continue anyway - will redirect with Google tokens, user can sign in manually
        } else {
          console.error('Unexpected error creating session:', errorMessage);
        }
        // Continue anyway - will redirect with Google tokens
      }
    }

    // Encode tokens for URL
    const accessTokenEncoded = encodeURIComponent(tokenData.access_token);
    const refreshTokenEncoded = tokenData.refresh_token ? encodeURIComponent(tokenData.refresh_token) : '';
    const expiry = new Date(Date.now() + 3600000).toISOString();
    const expiryEncoded = encodeURIComponent(expiry);
    
    // If we have a Supabase session, include it in the redirect
    let sessionParams = '';
    if (supabaseSession) {
      // Admin API returns session in different format - check both possible structures
      const accessToken = supabaseSession.access_token || supabaseSession.session?.access_token;
      const refreshToken = supabaseSession.refresh_token || supabaseSession.session?.refresh_token;
      
      if (accessToken) {
        const supabaseAccessToken = encodeURIComponent(accessToken);
        const supabaseRefreshToken = refreshToken ? encodeURIComponent(refreshToken) : '';
        sessionParams = `&supabase_access_token=${supabaseAccessToken}${supabaseRefreshToken ? `&supabase_refresh_token=${supabaseRefreshToken}` : ''}`;
        console.log('Including Supabase session in redirect');
      } else {
        console.error('Supabase session missing access_token:', JSON.stringify(supabaseSession).substring(0, 200));
      }
    } else {
      console.warn('No Supabase session created - user will need to sign in manually');
    }
    
    // Build redirect URL with tokens in hash
    const redirectUrlWithHash = `${redirectUrl}#google_oauth_callback=1&access_token=${accessTokenEncoded}&expiry=${expiryEncoded}${refreshTokenEncoded ? `&refresh_token=${refreshTokenEncoded}` : ''}${sessionParams}`;
    
    // Redirect immediately (302 redirect)
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrlWithHash,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const errorMsg = error.message || 'An unexpected error occurred';
    const escapedError = errorMsg.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    return new Response(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'google-oauth-error', 
            error: '${escapedError}' 
          }, '*');
          window.close();
        } else {
          document.body.innerHTML = '<h1>OAuth Error</h1><p>${escapedError}</p>';
        }
      </script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});
