import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  transcript: string;
  summary: string | null;
  created_at: string;
  next_tasks: any;
  calendar_events: any;
  blockers: any;
  email_draft: string | null;
}

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
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
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMeetings(meetings.filter(m => m.id !== id));
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
        description: "Failed to delete meeting",
        variant: "destructive",
      });
    }
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FollowUp" className="w-10 h-10" />
            <span className="text-xl font-bold text-foreground">Meeting History</span>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

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
              meetings.map((meeting) => (
                <Card
                  key={meeting.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedMeeting?.id === meeting.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedMeeting(meeting)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{meeting.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {format(new Date(meeting.created_at), 'MMM d, yyyy')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {meeting.summary || 'No summary available'}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Meeting Details */}
          <div className="lg:col-span-2">
            {selectedMeeting ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>{selectedMeeting.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(selectedMeeting.created_at), 'MMMM d, yyyy h:mm a')}
                      </CardDescription>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMeeting(selectedMeeting.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Summary</h3>
                      <p className="text-muted-foreground">{selectedMeeting.summary || 'No summary available'}</p>
                    </div>

                    {selectedMeeting.next_tasks && Array.isArray(selectedMeeting.next_tasks) && selectedMeeting.next_tasks.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Next Tasks</h3>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          {selectedMeeting.next_tasks.map((task: string, idx: number) => (
                            <li key={idx}>{task}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedMeeting.blockers && Array.isArray(selectedMeeting.blockers) && selectedMeeting.blockers.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Blockers</h3>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          {selectedMeeting.blockers.map((blocker: string, idx: number) => (
                            <li key={idx}>{blocker}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedMeeting.calendar_events && Array.isArray(selectedMeeting.calendar_events) && selectedMeeting.calendar_events.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Calendar Events</h3>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          {selectedMeeting.calendar_events.map((event: string, idx: number) => (
                            <li key={idx}>{event}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedMeeting.email_draft && (
                      <div>
                        <h3 className="font-semibold mb-2">Email Draft</h3>
                        <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                          {selectedMeeting.email_draft}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="font-semibold mb-2">Transcript</h3>
                      <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto text-sm">
                        {selectedMeeting.transcript}
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
