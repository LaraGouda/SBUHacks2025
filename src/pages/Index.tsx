import { useState } from "react";
import { Hero } from "@/components/Hero";
import { TranscriptInput } from "@/components/TranscriptInput";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { Dashboard } from "@/components/Dashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, History, User, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { parseAnalysisResults, type AnalysisResults } from "@/lib/parseAnalysisResults";

const Index = () => {
  const [showInput, setShowInput] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
  };

  const handleGetStarted = () => {
    setShowInput(true);
  };

  const handleAnalyze = async (transcript: string) => {
    setIsAnalyzing(true);
    setCurrentTranscript(transcript);
    
    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      
      // Call the edge function to analyze the transcript
      const { data, error } = await supabase.functions.invoke('analyze-meeting', {
        body: { 
          transcript,
          title: `Meeting ${new Date().toLocaleDateString()}`
        },
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`
        }
      });

      if (error) {
        console.error('Error analyzing transcript:', error);
        toast({
          title: "Analysis Failed",
          description: error.message || "Failed to analyze transcript. Please try again.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }

      // Use the centralized helper function to parse analysis results
      const analysisResults = parseAnalysisResults(data);

      setResults(analysisResults);

      // Meeting is automatically saved by the edge function
      toast({
        title: "Success",
        description: "Meeting analyzed and saved to history!",
      });
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBack = () => {
    setResults(null);
  };

  const handleReset = () => {
    setShowInput(false);
    setResults(null);
    setShowDashboard(false);
  };

  const handleShowDashboard = () => {
    setShowDashboard(true);
    setShowInput(false);
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FollowUp" className="w-10 h-10" />
            <span className="text-xl font-bold text-foreground">FollowUp</span>
          </div>
          <div className="flex items-center gap-2">
            {(showInput || results || showDashboard) && (
              <Button variant="ghost" onClick={handleReset}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            )}
            <Button variant="outline" onClick={handleShowDashboard}>
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/meetings')}>
              <History className="w-4 h-4 mr-2" />
              History
            </Button>
            <Button variant="outline" onClick={() => navigate('/profile')}>
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {!showInput && !results && !showDashboard && <Hero onGetStarted={handleGetStarted} />}
        
        {showDashboard && !showInput && !results && (
          <div className="animate-fade-in">
            <Dashboard />
          </div>
        )}
        
        {showInput && !results && !showDashboard && (
          <div className="animate-fade-in">
            <TranscriptInput onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
          </div>
        )}
        
        {results && !showDashboard && (
          <div className="space-y-6">
            <Button variant="outline" onClick={handleBack} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Analyze Another Transcript
            </Button>
            <ResultsDisplay results={results} />
          </div>
        )}
      </main>

      <footer className="border-t mt-20 py-8 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 FollowUp. Transform your meetings into actionable insights.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
