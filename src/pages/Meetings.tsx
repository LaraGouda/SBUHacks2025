import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Check, Clock, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { parseAnalysisResults } from "@/lib/parseAnalysisResults";
import { buildResultsFromMeeting, type MeetingWithRelations } from "@/lib/buildResultsFromMeeting";
import { AppHeader } from "@/components/AppHeader";

type Meeting = MeetingWithRelations;

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      console.error('Error fetching meetings:', error);
      toast({
        title: "Error",
        description: "Failed to load meetings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteMeeting = async (id: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to delete meetings.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMeetings(prev => prev.filter(m => m.id !== id));
      if (selectedMeeting?.id === id) {
        setSelectedMeeting(null);
      }
      
      toast({
        title: "Success",
        description: "Meeting deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting meeting:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete meeting",
        variant: "destructive",
      });
    }
  };

  const toggleTaskCompleted = async (taskId: string, nextValue: boolean) => {
    if (!user || !selectedMeeting) {
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

      setMeetings(prev =>
        prev.map(meeting => {
          if (meeting.id !== selectedMeeting.id) return meeting;
          return {
            ...meeting,
            tasks: meeting.tasks.map(task =>
              task.id === taskId ? { ...task, completed: nextValue } : task
            ),
          };
        })
      );

      setSelectedMeeting(prev => {
        if (!prev || prev.id !== selectedMeeting.id) return prev;
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
    }
  };

  const declineTask = async (taskId: string) => {
    if (!user || !selectedMeeting) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setMeetings(prev =>
        prev.map(meeting => {
          if (meeting.id !== selectedMeeting.id) return meeting;
          return {
            ...meeting,
            tasks: meeting.tasks.filter(task => task.id !== taskId),
          };
        })
      );

      setSelectedMeeting(prev => {
        if (!prev || prev.id !== selectedMeeting.id) return prev;
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

  const resolveBlocker = async (blockerId: string, nextValue: boolean) => {
    if (!user || !selectedMeeting) {
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

      setMeetings(prev =>
        prev.map(meeting => {
          if (meeting.id !== selectedMeeting.id) return meeting;
          return {
            ...meeting,
            blockers: meeting.blockers.map(blocker =>
              blocker.id === blockerId ? { ...blocker, resolved: nextValue } : blocker
            ),
          };
        })
      );

      setSelectedMeeting(prev => {
        if (!prev || prev.id !== selectedMeeting.id) return prev;
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

  const declineBlocker = async (blockerId: string) => {
    if (!user || !selectedMeeting) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blockers')
        .delete()
        .eq('id', blockerId)
        .eq('user_id', user.id);

      if (error) throw error;

      setMeetings(prev =>
        prev.map(meeting => {
          if (meeting.id !== selectedMeeting.id) return meeting;
          return {
            ...meeting,
            blockers: meeting.blockers.filter(blocker => blocker.id !== blockerId),
          };
        })
      );

      setSelectedMeeting(prev => {
        if (!prev || prev.id !== selectedMeeting.id) return prev;
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

  const declineEmail = async (emailId: string) => {
    if (!user || !selectedMeeting) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_drafts')
        .delete()
        .eq('id', emailId)
        .eq('user_id', user.id);

      if (error) throw error;

      setMeetings(prev =>
        prev.map(meeting => {
          if (meeting.id !== selectedMeeting.id) return meeting;
          return {
            ...meeting,
            email_drafts: meeting.email_drafts.filter(draft => draft.id !== emailId),
          };
        })
      );

      setSelectedMeeting(prev => {
        if (!prev || prev.id !== selectedMeeting.id) return prev;
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

  const toggleResolved = async () => {
    if (!user || !selectedMeeting) {
      return;
    }

    const nextStatus = selectedMeeting.status === 'resolved' ? 'analyzed' : 'resolved';

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ status: nextStatus })
        .eq('id', selectedMeeting.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setMeetings(prev =>
        prev.map(meeting =>
          meeting.id === selectedMeeting.id ? { ...meeting, status: nextStatus } : meeting
        )
      );

      setSelectedMeeting(prev =>
        prev ? { ...prev, status: nextStatus } : prev
      );

      toast({
        title: nextStatus === 'resolved' ? "Marked Resolved" : "Marked Active",
        description: nextStatus === 'resolved' ? "Meeting marked as resolved." : "Meeting marked as active.",
      });
    } catch (error: any) {
      console.error('Error updating meeting status:', error);
      toast({
        title: "Error",
        description: "Failed to update meeting status.",
        variant: "destructive",
      });
    }
  };

  const beginTitleEdit = (meeting: Meeting) => {
    setEditingMeetingId(meeting.id);
    setTitleDraft(meeting.title);
  };

  const cancelTitleEdit = () => {
    setEditingMeetingId(null);
    setTitleDraft("");
  };

  const commitTitleEdit = async () => {
    if (!editingMeetingId || !user) {
      cancelTitleEdit();
      return;
    }

    const trimmed = titleDraft.trim();
    if (!trimmed) {
      toast({
        title: "Invalid Title",
        description: "Meeting title can't be empty.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ title: trimmed })
        .eq('id', editingMeetingId);

      if (error) throw error;

      setMeetings(prev =>
        prev.map(meeting =>
          meeting.id === editingMeetingId ? { ...meeting, title: trimmed } : meeting
        )
      );

      setSelectedMeeting(prev =>
        prev && prev.id === editingMeetingId ? { ...prev, title: trimmed } : prev
      );

      cancelTitleEdit();
    } catch (error: any) {
      console.error('Error updating meeting title:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update meeting title.",
        variant: "destructive",
      });
    }
  };

  const getSummaryPreview = (summary: string | null) => {
    if (!summary) return "No summary available";
    const parsed = parseAnalysisResults({ summary });
    return parsed.summary.text || "No summary available";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader showBack />

      <main className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meetings List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-2xl font-bold mb-4">Your Meetings</h2>
            {meetings.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No meetings yet. Analyze your first meeting transcript to get started!
                </CardContent>
              </Card>
            ) : (
              meetings.map((meeting) => {
                const isResolved = meeting.status === 'resolved';
                return (
                  <Card
                    key={meeting.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedMeeting?.id === meeting.id ? 'ring-2 ring-primary' : ''
                    } ${isResolved ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedMeeting(meeting)}
                  >
                    <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {editingMeetingId === meeting.id ? (
                        <div
                          className="flex items-center gap-2 w-full"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitTitleEdit();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelTitleEdit();
                              }
                            }}
                            className="w-full bg-transparent border-b border-border text-lg font-semibold focus:outline-none focus:border-primary"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              commitTitleEdit();
                            }}
                            className="p-1 rounded hover:bg-muted"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              cancelTitleEdit();
                            }}
                            className="p-1 rounded hover:bg-muted"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-left hover:text-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginTitleEdit(meeting);
                          }}
                        >
                          {meeting.title}
                        </button>
                      )}
                      {isResolved && (
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                          Resolved
                        </Badge>
                      )}
                    </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {format(new Date(meeting.created_at), 'MMM d, yyyy')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {getSummaryPreview(meeting.summary)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Meeting Details */}
          <div className="lg:col-span-2">
            {selectedMeeting ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {editingMeetingId === selectedMeeting.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              value={titleDraft}
                              onChange={(event) => setTitleDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitTitleEdit();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelTitleEdit();
                                }
                              }}
                              className="w-full bg-transparent border-b border-border text-xl font-semibold focus:outline-none focus:border-primary"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={commitTitleEdit}
                              className="p-1 rounded hover:bg-muted"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelTitleEdit}
                              className="p-1 rounded hover:bg-muted"
                            >
                              <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-left hover:text-primary"
                            onClick={() => beginTitleEdit(selectedMeeting)}
                          >
                            {selectedMeeting.title}
                          </button>
                        )}
                        {selectedMeeting.status === 'resolved' && (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                            Resolved
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(selectedMeeting.created_at), 'MMMM d, yyyy h:mm a')}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleResolved}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {selectedMeeting.status === 'resolved' ? 'Mark Active' : 'Mark Resolved'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMeeting(selectedMeeting.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                <ResultsDisplay
                  results={buildResultsFromMeeting(selectedMeeting)}
                  onTaskToggle={toggleTaskCompleted}
                  onTaskDecline={declineTask}
                  onBlockerResolve={resolveBlocker}
                  onBlockerDecline={declineBlocker}
                  onEmailDecline={declineEmail}
                  layout="stacked"
                  showHeader={false}
                />
              </div>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                  Select a meeting to view details
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
