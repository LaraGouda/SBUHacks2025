import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect to home if already signed in
  // Supabase's built-in OAuth handles the callback automatically
  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // Debug: Log Supabase configuration
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      console.log('Supabase Key prefix:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20) + '...');
      
      // Use Supabase's built-in Google OAuth
      const redirectUrl = `${window.location.origin}/`;
      
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
        console.error('Error signing in with Google:', error);
        const errorMessage = error.message || "Failed to connect to Google. Please check your configuration.";
        
        // Check for specific error types
        if (errorMessage.includes('not configured') || errorMessage.includes('provider')) {
          setError("Google OAuth is not configured in Supabase. Please enable Google OAuth in your Supabase Dashboard. See SETUP_GOOGLE_OAUTH.md for instructions.");
        } else if (errorMessage.includes('Failed to send a request') || errorMessage.includes('fetch')) {
          setError("Cannot connect to Supabase. Please check your internet connection and try again.");
        } else if (errorMessage.includes('JWT') || errorMessage.includes('API key')) {
          setError("Supabase API key is missing or incorrect. Please check your .env file.");
        } else {
          setError(errorMessage + " Check browser console for details.");
        }
        setIsLoading(false);
        return;
      }

      // The signInWithOAuth will redirect automatically
      
      // Don't set loading to false here as the user will be redirected
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      
      let errorMsg = err.message || "Failed to sign in with Google. Please try again.";
      
      // Provide more specific error messages
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        errorMsg = "Network error. Check your internet connection and try again.";
      } else if (err.message?.includes('CORS') || err.message?.includes('CSP')) {
        errorMsg = "CORS/CSP error. The app may need to be restarted. Try refreshing the page.";
      } else if (!err.message) {
        errorMsg = "Failed to connect to Supabase. Check your .env file and restart the dev server.";
      }
      
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validation
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("Invalid email or password");
          } else {
            setError(error.message);
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You've successfully signed in.",
          });
          navigate("/");
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes("User already registered")) {
            setError("An account with this email already exists");
          } else {
            setError(error.message);
          }
        } else {
          toast({
            title: "Account created!",
            description: "You've successfully signed up and are now logged in.",
          });
          navigate("/");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="FollowUp" className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl text-center">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin
              ? "Sign in to access your meeting insights"
              : "Sign up to start analyzing your meetings"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full bg-white text-gray-900 border border-gray-300 hover:bg-gray-50"
                  disabled={isLoading || loading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
                  {isLoading || loading ? "Connecting to Google..." : "Continue with Google"}
            </Button>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                Or continue with email
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || loading}
                required
                minLength={6}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-primary"
                  disabled={isLoading || loading}
            >
                  {isLoading || loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                <>{isLogin ? "Sign In" : "Sign Up"}</>
              )}
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-primary hover:underline"
                  disabled={isLoading || loading}
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
