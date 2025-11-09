import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GoogleAuthContextType {
  isGoogleConnected: boolean;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => void;
  accessToken: string | null;
  refreshToken: () => Promise<boolean>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export const GoogleAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { toast } = useToast();

  // Define refreshToken function first using useCallback
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const refreshTokenValue = localStorage.getItem('google_refresh_token');
      if (!refreshTokenValue) {
        console.log('No refresh token available');
        return false;
      }

      // Try to get new token using refresh token via edge function
      const { data, error } = await supabase.functions.invoke('google-auth', {
        body: {
          action: 'refreshToken',
          refreshToken: refreshTokenValue,
        }
      });

      if (error || !data?.access_token) {
        console.error('Failed to refresh token:', error);
        return false;
      }

      setAccessToken(data.access_token);
      localStorage.setItem('google_access_token', data.access_token);
      
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);
      localStorage.setItem('google_token_expiry', expiry.toISOString());

      if (data.refresh_token) {
        localStorage.setItem('google_refresh_token', data.refresh_token);
      }

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    // With Supabase's built-in OAuth, the callback is handled automatically
    // We just need to listen for auth state changes to get Google tokens
    
    // Check if we have a Google access token from OAuth or localStorage
    const checkGoogleSession = async () => {
      try {
        // First check localStorage for stored token
        const storedToken = localStorage.getItem('google_access_token');
        if (storedToken) {
          // Verify token is still valid by checking if it's expired
          const tokenExpiry = localStorage.getItem('google_token_expiry');
          if (tokenExpiry && new Date(tokenExpiry) > new Date()) {
            setAccessToken(storedToken);
            setIsGoogleConnected(true);
            return;
          } else {
            // Token expired, try to refresh it
            const refreshTokenValue = localStorage.getItem('google_refresh_token');
            if (refreshTokenValue) {
              // Try to refresh the token
              const refreshed = await refreshToken();
              if (refreshed) {
                return;
              }
            }
            // If refresh failed, remove expired tokens
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
            localStorage.removeItem('google_refresh_token');
          }
        }

        // Then check Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          return;
        }
        
        // Check for provider_token from Supabase OAuth
        if (session?.provider_token) {
          console.log('Found provider token from Supabase OAuth');
          setAccessToken(session.provider_token);
          setIsGoogleConnected(true);
          localStorage.setItem('google_access_token', session.provider_token);
          
          // Store expiry if available (typically 1 hour)
          const expiry = new Date();
          expiry.setHours(expiry.getHours() + 1);
          localStorage.setItem('google_token_expiry', expiry.toISOString());
        } else if (session?.user) {
          // User is logged in but no provider token
          // Check if user signed in with Google (has google provider metadata)
          const provider = session.user.app_metadata?.provider;
          if (provider === 'google') {
            // User signed in with Google but no provider_token
            // This might happen if scopes weren't requested properly
            console.log('User signed in with Google but no provider token available');
            setIsGoogleConnected(false);
            setAccessToken(null);
          } else {
            // User signed in with email/password
            setIsGoogleConnected(false);
            setAccessToken(null);
          }
        } else {
          setIsGoogleConnected(false);
          setAccessToken(null);
        }
      } catch (error) {
        console.error('Error checking Google session:', error);
        setIsGoogleConnected(false);
        setAccessToken(null);
      }
    };
    
    checkGoogleSession();

    // Listen for auth state changes to capture OAuth tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'Provider token:', session?.provider_token);
      
      // With Supabase's built-in OAuth, the provider_token contains the Google access token
      if (session?.provider_token) {
        setAccessToken(session.provider_token);
        setIsGoogleConnected(true);
        localStorage.setItem('google_access_token', session.provider_token);
        
        // Store token expiry (Google tokens typically expire in 1 hour)
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 1);
        localStorage.setItem('google_token_expiry', expiryDate.toISOString());
        
        // If we have a provider_refresh_token, store it
        if (session.provider_refresh_token) {
          localStorage.setItem('google_refresh_token', session.provider_refresh_token);
        }
        
        toast({
          title: "Google Connected",
          description: "Successfully connected to Google services.",
        });
      } else if (event === 'SIGNED_IN') {
        // User signed in - check if they have a stored token
        const storedToken = localStorage.getItem('google_access_token');
        const tokenExpiry = localStorage.getItem('google_token_expiry');
        
        if (storedToken && tokenExpiry && new Date(tokenExpiry) > new Date()) {
          // Token is still valid
          setAccessToken(storedToken);
          setIsGoogleConnected(true);
        } else if (session?.provider_token) {
          // Got provider token from session
          setAccessToken(session.provider_token);
          setIsGoogleConnected(true);
          localStorage.setItem('google_access_token', session.provider_token);
          
          const expiry = new Date();
          expiry.setHours(expiry.getHours() + 1);
          localStorage.setItem('google_token_expiry', expiry.toISOString());
        } else {
          // No token available
          setIsGoogleConnected(false);
          setAccessToken(null);
        }
      } else if (event === 'SIGNED_OUT') {
        setIsGoogleConnected(false);
        setAccessToken(null);
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        localStorage.removeItem('google_refresh_token');
      } else if (event === 'TOKEN_REFRESHED') {
        // Token was refreshed, check for new provider_token
        if (session?.provider_token) {
          setAccessToken(session.provider_token);
          setIsGoogleConnected(true);
          localStorage.setItem('google_access_token', session.provider_token);
          
          const expiry = new Date();
          expiry.setHours(expiry.getHours() + 1);
          localStorage.setItem('google_token_expiry', expiry.toISOString());
        }
      }
    });

        return () => subscription.unsubscribe();
      }, [toast, refreshToken]);

  const connectGoogle = async () => {
    try {
      // Use Supabase's built-in Google OAuth
      const redirectUrl = window.location.origin + window.location.pathname;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Error connecting to Google:', error);
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to connect to Google. Please enable Google OAuth in Supabase Dashboard.",
          variant: "destructive",
        });
        return;
      }

      // The signInWithOAuth will redirect automatically
    } catch (error: any) {
      console.error('Error connecting to Google:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Google",
        variant: "destructive",
      });
    }
  };

  const disconnectGoogle = () => {
    setAccessToken(null);
    setIsGoogleConnected(false);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    localStorage.removeItem('google_refresh_token');
    toast({
      title: "Disconnected",
      description: "Google account disconnected successfully.",
    });
  };

  return (
    <GoogleAuthContext.Provider value={{ isGoogleConnected, connectGoogle, disconnectGoogle, accessToken, refreshToken }}>
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error("useGoogleAuth must be used within a GoogleAuthProvider");
  }
  return context;
};
