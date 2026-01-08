import { useEffect, useState } from "react";
import { Hero } from "@/components/Hero";
import { TranscriptInput } from "@/components/TranscriptInput";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { Dashboard } from "@/components/Dashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { parseAnalysisResults, type AnalysisResults } from "@/lib/parseAnalysisResults";
import { buildResultsFromMeeting, type MeetingWithRelations } from "@/lib/buildResultsFromMeeting";
import { AppHeader } from "@/components/AppHeader";

type IndexProps = {
  initialView?: "dashboard";
};

const Index = ({ initialView }: IndexProps) => {
  const [showInput, setShowInput] = useState(false);
  const [showDashboard, setShowDashboard] = useState(initialView === "dashboard");
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [analysisMeeting, setAnalysisMeeting] = useState<MeetingWithRelations | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAuthed = Boolean(user);

  useEffect(() => {
    if (!isAuthed) {
      setShowDashboard(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    if (initialView === "dashboard") {
      setShowDashboard(true);
      setShowInput(false);
      setResults(null);
      setAnalysisMeeting(null);
    }
  }, [initialView]);

  const handleSignOut = async () => {
    await signOut();
    handleReset();
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
    setAnalysisMeeting(null);
    
    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      // Call the edge function to analyze the transcript
      const { data, error } = await supabase.functions.invoke('analyze-meeting', {
        body: { 
          transcript,
          title: `Meeting ${new Date().toLocaleDateString()}`
        },
        headers: Object.keys(headers).length > 0 ? headers : undefined
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

      if (data?.meetingId) {
        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .select(`
            id,
            title,
            transcript,
            summary,
            raw_analysis,
            status,
            created_at,
            tasks (id, description, completed, priority),
            email_drafts (id, subject, body, recipient, status),
            calendar_events (id, title, description, start_time, end_time, timezone, status),
            blockers (id, description, severity, resolved)
          `)
          .eq('id', data.meetingId)
          .single();

        if (meetingError) {
          console.error('Error fetching saved meeting:', meetingError);
        } else if (meeting) {
          setAnalysisMeeting(meeting);
        }
      }

      // Meeting is automatically saved by the edge function for signed-in users
      toast({
        title: "Success",
        description: data?.meetingId
          ? "Meeting analyzed and saved to history!"
          : "Meeting analyzed. Sign in to save results to your history.",
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
    setAnalysisMeeting(null);
  };

  const handleReset = () => {
    setShowInput(false);
    setResults(null);
    setAnalysisMeeting(null);
    setShowDashboard(false);
  };

  const handleTaskToggle = async (taskId: string, nextValue: boolean) => {
    if (!user) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          completed: nextValue,
          completed_at: nextValue ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setAnalysisMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map(task =>
            task.id === taskId ? { ...task, completed: nextValue } : task
          ),
        };
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleTaskDecline = async (taskId: string) => {
    if (!user) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setAnalysisMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.filter(task => task.id !== taskId),
        };
      });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleBlockerResolve = async (blockerId: string, nextValue: boolean) => {
    if (!user) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blockers')
        .update({
          resolved: nextValue,
          resolved_at: nextValue ? new Date().toISOString() : null,
        })
        .eq('id', blockerId)
        .eq('user_id', user.id);

      if (error) throw error;

      setAnalysisMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          blockers: prev.blockers.map(blocker =>
            blocker.id === blockerId ? { ...blocker, resolved: nextValue } : blocker
          ),
        };
      });
    } catch (error: any) {
      console.error('Error updating blocker:', error);
      toast({
        title: "Error",
        description: "Failed to update blocker.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleBlockerDecline = async (blockerId: string) => {
    if (!user) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blockers')
        .delete()
        .eq('id', blockerId)
        .eq('user_id', user.id);

      if (error) throw error;

      setAnalysisMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          blockers: prev.blockers.filter(blocker => blocker.id !== blockerId),
        };
      });
    } catch (error: any) {
      console.error('Error deleting blocker:', error);
      toast({
        title: "Error",
        description: "Failed to delete blocker.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleEmailDecline = async (emailId: string) => {
    if (!user) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_drafts')
        .delete()
        .eq('id', emailId)
        .eq('user_id', user.id);

      if (error) throw error;

      setAnalysisMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          email_drafts: prev.email_drafts.filter(draft => draft.id !== emailId),
        };
      });
    } catch (error: any) {
      console.error('Error deleting email draft:', error);
      toast({
        title: "Error",
        description: "Failed to delete email draft.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleMeetingTitleUpdate = async (nextTitle: string) => {
    if (!analysisMeeting) {
      return;
    }

    const { error } = await supabase
      .from('meetings')
      .update({ title: nextTitle })
      .eq('id', analysisMeeting.id);

    if (error) {
      throw error;
    }

    setAnalysisMeeting(prev => (prev ? { ...prev, title: nextTitle } : prev));
  };

  const handleShowDashboard = () => {
    if (!isAuthed) {
      toast({
        title: "Sign in required",
        description: "Please sign in to access your dashboard.",
      });
      navigate("/auth");
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader
        showBack={showInput || Boolean(results) || showDashboard}
        onBack={handleReset}
        onDashboard={handleShowDashboard}
        onSignOut={handleSignOut}
      />

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
            <ResultsDisplay
              results={analysisMeeting ? buildResultsFromMeeting(analysisMeeting, results || undefined) : results}
              onTaskToggle={analysisMeeting ? handleTaskToggle : undefined}
              onTaskDecline={analysisMeeting ? handleTaskDecline : undefined}
              onBlockerResolve={analysisMeeting ? handleBlockerResolve : undefined}
              onBlockerDecline={analysisMeeting ? handleBlockerDecline : undefined}
              onEmailDecline={analysisMeeting ? handleEmailDecline : undefined}
              meetingId={analysisMeeting?.id}
              meetingTitle={analysisMeeting?.title}
              onMeetingTitleChange={analysisMeeting ? handleMeetingTitleUpdate : undefined}
            />
          </div>
        )}
      </main>

      <footer className="border-t mt-0 py-1">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 FollowUp. Transform your meetings into actionable insights.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
