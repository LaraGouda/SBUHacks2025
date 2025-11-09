import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);

  useEffect(() => {
    // Check if we're processing an OAuth callback
    const hash = window.location.hash;
    const isProcessingOAuth = hash.includes('google_oauth_callback=1') || 
                              sessionStorage.getItem('google_oauth_processed') === 'true';
    
    if (isProcessingOAuth) {
      setIsOAuthCallback(true);
      // Give OAuth callback time to process (up to 10 seconds)
      const timeout = setTimeout(() => {
        setIsOAuthCallback(false);
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    // Don't redirect if we're processing OAuth callback
    if (isOAuthCallback) {
      return;
    }
    
    // Give extra time for session to be established after OAuth
    if (!loading && !user) {
      const timeout = setTimeout(() => {
        // Double-check session one more time before redirecting
        const checkSession = async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            // Check if we just processed OAuth (give it more time)
            const justProcessedOAuth = sessionStorage.getItem('google_oauth_processed') === 'true';
            if (justProcessedOAuth) {
              // Wait a bit more for OAuth session to be established
              setTimeout(() => {
                supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
                  if (!retrySession?.user) {
                    navigate("/auth", { replace: true });
                  }
                });
              }, 2000);
            } else {
              navigate("/auth", { replace: true });
            }
          }
        };
        checkSession();
      }, 2000); // Increased timeout to 2 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [user, loading, navigate, isOAuthCallback]);

  // Show loading state if loading or processing OAuth callback
  if (loading || isOAuthCallback) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">
            {isOAuthCallback ? "Completing sign in..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
