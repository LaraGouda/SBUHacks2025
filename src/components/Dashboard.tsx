import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckSquare, Calendar, Mail, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleAuth } from "@/contexts/GoogleAuthContext";
import { format } from "date-fns";
import { parseAnalysisResults } from "@/lib/parseAnalysisResults";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  meetingId?: string;
  meetingTitle?: string;
  priority?: string | null;
}

interface DashboardStats {
  totalMeetings: number;
  totalTasks: number;
  completedTasks: number;
  pendingEmails: number;
  upcomingEvents: number;
  openBlockers: number;
}

interface MeetingSummary {
  id: string;
  title: string;
  summary: string | null;
  created_at: string;
  status: string | null;
}

interface EmailDraft {
  id: string;
  subject: string | null;
  body: string;
  recipient: string | null;
  status: string;
  createdAt: string;
  meetingTitle?: string;
}

interface CalendarEventItem {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  timezone: string | null;
  location: string | null;
  status: string;
  meetingTitle?: string;
}

type CalendarOverride = {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  location?: string;
};

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Australia/Sydney",
];

const toDateTimeLocalValue = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
};

interface BlockerItem {
  id: string;
  description: string;
  severity: string;
  resolved: boolean;
  createdAt: string;
  meetingTitle?: string;
}

export const Dashboard = () => {
  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOptions = TIMEZONE_OPTIONS.includes(defaultTimezone)
    ? TIMEZONE_OPTIONS
    : [defaultTimezone, ...TIMEZONE_OPTIONS];
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [blockers, setBlockers] = useState<BlockerItem[]>([]);
  const [expandedPanel, setExpandedPanel] = useState<"summaries" | "tasks" | "emails" | "events" | "blockers" | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalMeetings: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingEmails: 0,
    upcomingEvents: 0,
    openBlockers: 0,
  });
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingBlockers, setLoadingBlockers] = useState(true);
  const [emailSending, setEmailSending] = useState<{ [key: string]: boolean }>({});
  const [emailApproved, setEmailApproved] = useState<{ [key: string]: boolean }>({});
  const [calendarCreating, setCalendarCreating] = useState<{ [key: string]: boolean }>({});
  const [calendarApproved, setCalendarApproved] = useState<{ [key: string]: boolean }>({});
  const [calendarOverrides, setCalendarOverrides] = useState<{ [key: string]: CalendarOverride }>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const { isGoogleConnected, accessToken, refreshToken, disconnectGoogle } = useGoogleAuth();

  useEffect(() => {
    if (!user) {
      return;
    }
    fetchTasks();
    fetchStats();
    fetchMeetings();
    fetchEmails();
    fetchEvents();
    fetchBlockers();
  }, [user]);

  const fetchTasks = async () => {
    if (!user?.id) {
      setLoadingTasks(false);
      return;
    }

    try {
      // Fetch tasks from the tasks table
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('id, description, completed, completed_at, meeting_id, created_at, priority, meetings ( title )')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      const allTasks: Task[] = (tasksData || []).map((task) => ({
        id: task.id,
        text: task.description,
        completed: task.completed,
        createdAt: task.created_at,
        meetingId: task.meeting_id || undefined,
        meetingTitle: task.meetings?.title || undefined,
        priority: task.priority || null,
      }));
      
      setTasks(allTasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchStats = async () => {
    if (!user?.id) return;

    try {
      // Use the database function for better performance
      const { data: statsData, error } = await supabase.rpc('get_user_dashboard_stats', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching stats:', error);
        // Fallback to manual queries
        const [meetingsRes, tasksRes, emailsRes, eventsRes, blockersRes] = await Promise.all([
          supabase.from('meetings').select('id', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('tasks').select('id, completed', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('email_drafts').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'draft'),
          supabase.from('calendar_events').select('id', { count: 'exact' }).eq('user_id', user.id).gt('start_time', new Date().toISOString()),
          supabase.from('blockers').select('id', { count: 'exact' }).eq('user_id', user.id).eq('resolved', false),
        ]);

        const totalMeetings = meetingsRes.count || 0;
        const totalTasks = tasksRes.count || 0;
        const completedTasks = tasksRes.data?.filter(t => t.completed).length || 0;
        const pendingEmails = emailsRes.count || 0;
        const upcomingEvents = eventsRes.count || 0;
        const openBlockers = blockersRes.count || 0;

        setStats({
          totalMeetings,
          totalTasks,
          completedTasks,
          pendingEmails,
          upcomingEvents,
          openBlockers,
        });
        return;
      }

      if (statsData) {
        const { count: blockersCount, error: blockersError } = await supabase
          .from('blockers')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('resolved', false);

        if (blockersError) {
          console.error('Error fetching blockers count:', blockersError);
        }

        setStats({
          totalMeetings: statsData.total_meetings || 0,
          totalTasks: statsData.total_tasks || 0,
          completedTasks: statsData.completed_tasks || 0,
          pendingEmails: statsData.pending_emails || 0,
          upcomingEvents: statsData.upcoming_events || 0,
          openBlockers: blockersCount || 0,
        });
      }
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchMeetings = async () => {
    if (!user?.id) {
      setLoadingMeetings(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, summary, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching meetings:', error);
        throw error;
      }

      setMeetings(data || []);
    } catch (error: any) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const fetchEmails = async () => {
    if (!user?.id) {
      setLoadingEmails(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('email_drafts')
        .select('id, subject, body, recipient, status, created_at, meeting_id, meetings ( title )')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching emails:', error);
        throw error;
      }

      const mapped: EmailDraft[] = (data || []).map((draft) => ({
        id: draft.id,
        subject: draft.subject,
        body: draft.body,
        recipient: draft.recipient,
        status: draft.status,
        createdAt: draft.created_at,
        meetingTitle: draft.meetings?.title || undefined,
      }));

      setEmails(mapped);
    } catch (error: any) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchEvents = async () => {
    if (!user?.id) {
      setLoadingEvents(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, description, start_time, end_time, timezone, location, status, meeting_id, meetings ( title )')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }

      const mapped: CalendarEventItem[] = (data || []).map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.start_time,
        endTime: event.end_time,
        timezone: event.timezone,
        location: event.location,
        status: event.status,
        meetingTitle: event.meetings?.title || undefined,
      }));

      setEvents(mapped);
    } catch (error: any) {
      console.error('Error fetching events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchBlockers = async () => {
    if (!user?.id) {
      setLoadingBlockers(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('blockers')
        .select('id, description, severity, resolved, created_at, meeting_id, meetings ( title )')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching blockers:', error);
        throw error;
      }

      const mapped: BlockerItem[] = (data || []).map((blocker) => ({
        id: blocker.id,
        description: blocker.description,
        severity: blocker.severity,
        resolved: blocker.resolved,
        createdAt: blocker.created_at,
        meetingTitle: blocker.meetings?.title || undefined,
      }));

      setBlockers(mapped);
    } catch (error: any) {
      console.error('Error fetching blockers:', error);
    } finally {
      setLoadingBlockers(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !user?.id) return;

    const newCompleted = !task.completed;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, completed: newCompleted } : t
      ));

      fetchStats();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const activeMeetings = meetings.filter(meeting => meeting.status !== 'resolved');
  const pendingEmails = emails.filter(email => email.status !== 'sent');
  const pendingEvents = events.filter(event => event.status !== 'created');
  const sortedTasks = [...tasks].sort((a, b) => {
    const rank = (value?: string | null) => {
      if (!value) return 0;
      const normalized = value.toLowerCase();
      if (normalized === "urgent" || normalized === "high") return 3;
      if (normalized === "medium" || normalized === "normal") return 2;
      if (normalized === "low") return 1;
      return 0;
    };
    return rank(b.priority) - rank(a.priority);
  });
  const sortedPendingTasks = sortedTasks.filter(task => !task.completed);
  const sortedBlockers = [...blockers].sort((a, b) => {
    const rank = (value?: string) => {
      if (!value) return 0;
      const normalized = value.toLowerCase();
      if (normalized === "critical" || normalized === "high") return 3;
      if (normalized === "medium") return 2;
      if (normalized === "low") return 1;
      return 0;
    };
    return rank(b.severity) - rank(a.severity);
  });
  const sortedPendingBlockers = sortedBlockers.filter(blocker => !blocker.resolved);
  const isLoading = loadingTasks || loadingMeetings || loadingEmails || loadingEvents || loadingBlockers;
  const completionRate = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;
  const meetingBadgeClass =
    "ml-auto shrink-0 rounded-full bg-gradient-primary px-3 py-1 text-[10px] font-semibold text-white shadow-sm max-w-[160px] truncate";
  const resolvedBadgeClass =
    "bg-green-100 text-green-700 border-green-200 hover:bg-green-100";
  const getPriorityClasses = (value?: string | null) => {
    if (!value) {
      return "border-muted-foreground/30 text-muted-foreground";
    }
    const normalized = value.toLowerCase();
    if (normalized === "high" || normalized === "critical" || normalized === "urgent") {
      return "border-red-900 bg-red-900 text-white";
    }
    if (normalized === "medium" || normalized === "normal") {
      return "border-red-700 bg-red-600 text-white";
    }
    if (normalized === "low") {
      return "border-red-300 bg-red-200 text-red-900";
    }
    return "border-muted-foreground/30 text-muted-foreground";
  };

  const handleApproveEmail = async (draft: EmailDraft) => {
    if (!isGoogleConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect your Google account first.",
        variant: "destructive",
      });
      return;
    }

    setEmailSending(prev => ({ ...prev, [draft.id]: true }));

    try {
      let tokenToUse = accessToken;
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      if (tokenExpiry && new Date(tokenExpiry) <= new Date()) {
        const refreshed = await refreshToken();
        if (refreshed) {
          tokenToUse = localStorage.getItem('google_access_token');
        }
      }

      if (!tokenToUse) {
        throw new Error('No valid access token available. Please reconnect your Google account.');
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionsUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-gmail`;

      const resp = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_PUBLISHABLE_KEY || '',
        },
        body: JSON.stringify({
          accessToken: tokenToUse,
          to: draft.recipient || '',
          subject: draft.subject || 'Meeting Follow-up',
          body: draft.body || '',
        }),
      });

      let respBody: any = null;
      try {
        respBody = await resp.json();
      } catch (err) {
        respBody = { raw: await resp.text() };
      }

      if (!resp.ok) {
        const message = respBody?.error || respBody?.message || `Edge function returned status ${resp.status}`;
        throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
      }

      try {
        const mailParams = new URLSearchParams();
        mailParams.set('view', 'cm');
        mailParams.set('fs', '1');
        if (draft.recipient) {
          mailParams.set('to', draft.recipient);
        }
        mailParams.set('su', draft.subject || 'Meeting Follow-up');
        mailParams.set('body', draft.body || '');
        const composeUrl = `https://mail.google.com/mail/?${mailParams.toString()}`;
        window.open(composeUrl, '_blank');
      } catch (err) {
        console.warn('Unable to open compose tab:', err);
      }

      setEmailApproved(prev => ({ ...prev, [draft.id]: true }));
      toast({
        title: "Draft Saved",
        description: "Email draft has been saved to your Gmail drafts folder!",
      });
    } catch (error: any) {
      console.error('Error saving email draft:', error);
      toast({
        title: "Failed to Save",
        description: error.message || "Could not save email draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setEmailSending(prev => ({ ...prev, [draft.id]: false }));
    }
  };

  const handleApproveCalendar = async (event: CalendarEventItem) => {
    if (!isGoogleConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect your Google account first.",
        variant: "destructive",
      });
      return;
    }

    const overrides = calendarOverrides[event.id] || {};
    const title = (overrides.title ?? event.title ?? "").trim();
    const description = (overrides.description ?? event.description ?? "Created from meeting analysis").trim();
    const startInput = overrides.startTime;
    const endInput = overrides.endTime;
    const timezone = (overrides.timezone ?? event.timezone ?? defaultTimezone ?? "").trim();
    const location = (overrides.location ?? event.location ?? "").trim();
    const startDate = startInput ? new Date(startInput) : null;
    const endDate = endInput ? new Date(endInput) : null;

    const missingDetails: string[] = [];
    if (!title) missingDetails.push("title");
    if (!startInput || Number.isNaN(startDate?.getTime() ?? NaN)) missingDetails.push("start time");
    if (!endInput || Number.isNaN(endDate?.getTime() ?? NaN)) missingDetails.push("end time");
    if (!timezone) missingDetails.push("timezone");

    if (missingDetails.length > 0) {
      toast({
        title: "Missing Details",
        description: `Please add ${missingDetails.join(", ")} before creating the event.`,
        variant: "destructive",
      });
      return;
    }

    if (startDate && endDate && endDate <= startDate) {
      toast({
        title: "Invalid Time Range",
        description: "End time must be after the start time.",
        variant: "destructive",
      });
      return;
    }

    setCalendarCreating(prev => ({ ...prev, [event.id]: true }));

    try {
      let tokenToUse = accessToken;
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      if (tokenExpiry && new Date(tokenExpiry) <= new Date()) {
        const refreshed = await refreshToken();
        if (refreshed) {
          tokenToUse = localStorage.getItem('google_access_token');
        }
      }

      if (!tokenToUse) {
        throw new Error('No valid access token available. Please reconnect your Google account.');
      }

      const { data, error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          accessToken: tokenToUse,
          summary: title || "Meeting Follow-up",
          description: description || "Created from meeting analysis",
          startTime: new Date(startInput as string).toISOString(),
          endTime: new Date(endInput as string).toISOString(),
          timezone: timezone || undefined,
          location: location || undefined,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create calendar event');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setCalendarApproved(prev => ({ ...prev, [event.id]: true }));
      if (user?.id) {
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({ status: 'created' })
          .eq('id', event.id)
          .eq('user_id', user.id);
        if (updateError) {
          console.warn('Failed to update calendar event status:', updateError);
        } else {
          setEvents(prev =>
            prev.map(item =>
              item.id === event.id ? { ...item, status: 'created' } : item
            )
          );
        }
      }
      toast({
        title: "Event Created",
        description: "Calendar event has been created successfully!",
      });
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      if (error?.message?.toLowerCase?.().includes('insufficient authentication scopes')) {
        disconnectGoogle();
        toast({
          title: "Reconnect Google",
          description: "Calendar permission is missing. Please reconnect Google to grant calendar access.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Failed to Create",
        description: error.message || "Could not create calendar event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCalendarCreating(prev => ({ ...prev, [event.id]: false }));
    }
  };

  const handleResolveCalendar = async (event: CalendarEventItem) => {
    await handleApproveCalendar(event);
  };

  const handleDeclineEmail = async (draft: EmailDraft) => {
    if (!user?.id) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_drafts')
        .delete()
        .eq('id', draft.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setEmails(prev => prev.filter(item => item.id !== draft.id));
      toast({
        title: "Email Declined",
        description: "Email draft has been removed.",
      });
    } catch (error: any) {
      console.error('Error deleting email draft:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to remove email draft.",
        variant: "destructive",
      });
    }
  };

  const handleResolveBlocker = async (blockerId: string) => {
    if (!user?.id) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blockers')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', blockerId)
        .eq('user_id', user.id);

      if (error) throw error;

      setBlockers(prev =>
        prev.map(blocker =>
          blocker.id === blockerId ? { ...blocker, resolved: true } : blocker
        )
      );
      setStats(prev => ({
        ...prev,
        openBlockers: Math.max(0, prev.openBlockers - 1),
      }));
      toast({
        title: "Blocker Resolved",
        description: "Blocker has been marked as resolved.",
      });
    } catch (error: any) {
      console.error('Error resolving blocker:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to resolve blocker.",
        variant: "destructive",
      });
    }
  };

  const handleDeclineBlocker = async (blockerId: string) => {
    if (!user?.id) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blockers')
        .delete()
        .eq('id', blockerId)
        .eq('user_id', user.id);

      if (error) throw error;

      setBlockers(prev => prev.filter(blocker => blocker.id !== blockerId));
      setStats(prev => ({
        ...prev,
        openBlockers: Math.max(0, prev.openBlockers - 1),
      }));
      toast({
        title: "Blocker Declined",
        description: "Blocker has been removed.",
      });
    } catch (error: any) {
      console.error('Error deleting blocker:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to remove blocker.",
        variant: "destructive",
      });
    }
  };

  const getSummaryPreview = (summary: string | null) => {
    if (!summary) return "No summary available";
    const parsed = parseAnalysisResults({ summary });
    return parsed.summary.text || "No summary available";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className="relative cursor-pointer hover:shadow-lg transition-all duration-300 animate-fade-in"
          style={{ animationDelay: '0ms' }}
          onClick={() =>
            setExpandedPanel(prev => (prev === "summaries" ? null : "summaries"))
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMeetings.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Unresolved</p>
          </CardContent>
        </Card>

        <Card
          className="relative cursor-pointer hover:shadow-lg transition-all duration-300 animate-fade-in"
          style={{ animationDelay: '100ms' }}
          onClick={() =>
            setExpandedPanel(prev => (prev === "tasks" ? null : "tasks"))
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completedTasks} completed
            </p>
          </CardContent>
        </Card>

        <Card
          className="relative cursor-pointer hover:shadow-lg transition-all duration-300 animate-fade-in"
          style={{ animationDelay: '200ms' }}
          onClick={() =>
            setExpandedPanel(prev => (prev === "emails" ? null : "emails"))
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Pending Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingEmails}</div>
            <p className="text-xs text-muted-foreground mt-1">Drafts ready</p>
          </CardContent>
        </Card>

        <Card
          className="relative cursor-pointer hover:shadow-lg transition-all duration-300 animate-fade-in"
          style={{ animationDelay: '300ms' }}
          onClick={() =>
            setExpandedPanel(prev => (prev === "events" ? null : "events"))
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">Upcoming</p>
          </CardContent>
        </Card>

        <Card
          className="relative cursor-pointer hover:shadow-lg transition-all duration-300 animate-fade-in"
          style={{ animationDelay: '400ms' }}
          onClick={() =>
            setExpandedPanel(prev => (prev === "blockers" ? null : "blockers"))
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Blockers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openBlockers}</div>
            <p className="text-xs text-muted-foreground mt-1">Open items</p>
          </CardContent>
        </Card>
      </div>

      {/* Expanded Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          hidden={expandedPanel !== "summaries"}
          aria-hidden={expandedPanel !== "summaries"}
          className="transition-all duration-500 lg:col-span-2 shadow-lg ring-1 ring-primary/10"
        >
          <CardHeader
            className="cursor-pointer"
            onClick={() => setExpandedPanel(null)}
          >
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Meeting Summaries
            </CardTitle>
            <CardDescription>Review summaries from your meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all">All Meetings</TabsTrigger>
                <TabsTrigger value="active">Non-Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-3">
                {meetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Analyze a meeting transcript to see summaries here.
                  </p>
                ) : (
                  meetings.map((meeting) => (
                    <div key={meeting.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(meeting.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-auto">
                          <span className={meetingBadgeClass} title={meeting.title}>
                            {meeting.title}
                          </span>
                          {meeting.status === 'resolved' && (
                            <Badge variant="outline" className={resolvedBadgeClass}>
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {getSummaryPreview(meeting.summary)}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="active" className="space-y-3">
                {activeMeetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No active meetings right now.
                  </p>
                ) : (
                  activeMeetings.map((meeting) => (
                    <div key={meeting.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(meeting.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-auto">
                          <span className={meetingBadgeClass} title={meeting.title}>
                            {meeting.title}
                          </span>
                          {meeting.status === 'resolved' && (
                            <Badge variant="outline" className={resolvedBadgeClass}>
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {getSummaryPreview(meeting.summary)}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card
          hidden={expandedPanel !== "tasks"}
          aria-hidden={expandedPanel !== "tasks"}
          className="transition-all duration-500 lg:col-span-2 shadow-lg ring-1 ring-primary/10"
        >
          <CardHeader
            className="cursor-pointer"
            onClick={() => setExpandedPanel(null)}
          >
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              To-Do List
            </CardTitle>
            <CardDescription>Your action items from meetings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completion</span>
                <span>{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats.completedTasks} of {stats.totalTasks} tasks completed
              </p>
            </div>
            <Tabs defaultValue="all">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all">All Tasks</TabsTrigger>
                <TabsTrigger value="pending">Non-Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-3">
                {sortedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No tasks yet. Analyze a meeting to generate action items.
                  </p>
                ) : (
                  sortedTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                        task.completed ? 'bg-muted/30' : 'hover:bg-muted/50'
                        }`}
                      >
                        <button
                          onClick={() => toggleTask(task.id)}
                          className={`mt-0.5 h-5 w-5 rounded border-2 transition-colors ${
                            task.completed
                              ? 'border-green-500 bg-green-500'
                              : 'border-primary hover:bg-primary/10'
                          }`}
                          aria-label="Toggle task completion"
                        />
                        <div className="flex-1 space-y-1">
                          <p className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.text}
                          </p>
                          {task.priority && (
                            <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${getPriorityClasses(task.priority)}`}>
                              {task.priority} priority
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(task.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-auto">
                          {task.completed && (
                              <Badge variant="outline" className={resolvedBadgeClass}>
                                Resolved
                              </Badge>
                          )}
                          <span className={meetingBadgeClass} title={task.meetingTitle || "No meeting"}>
                            {task.meetingTitle || "No meeting"}
                          </span>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
              <TabsContent value="pending" className="space-y-3">
                {sortedPendingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No active tasks right now.
                  </p>
                ) : (
                  sortedPendingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50"
                      >
                        <button
                          onClick={() => toggleTask(task.id)}
                          className="mt-0.5 h-5 w-5 rounded border-2 border-primary hover:bg-primary/10 transition-colors"
                          aria-label="Toggle task completion"
                        />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm">{task.text}</p>
                          {task.priority && (
                            <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${getPriorityClasses(task.priority)}`}>
                              {task.priority} priority
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(task.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <span className={meetingBadgeClass} title={task.meetingTitle || "No meeting"}>
                          {task.meetingTitle || "No meeting"}
                        </span>
                      </div>
                    ))
                  )}
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card
          hidden={expandedPanel !== "emails"}
          aria-hidden={expandedPanel !== "emails"}
          className="transition-all duration-500 lg:col-span-2 shadow-lg ring-1 ring-primary/10"
        >
          <CardHeader
            className="cursor-pointer"
            onClick={() => setExpandedPanel(null)}
          >
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Drafts
            </CardTitle>
            <CardDescription>Follow-ups ready to send</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all">All Emails</TabsTrigger>
                <TabsTrigger value="pending">Non-Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-3">
                {loadingEmails ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading emails...</p>
                ) : emails.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No email drafts yet.
                  </p>
                ) : (
                  emails.map((draft) => {
                    const isSending = emailSending[draft.id];
                    const isApproved = emailApproved[draft.id];

                    return (
                      <div key={draft.id} className="space-y-3 border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            {draft.recipient && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">To:</p>
                                <p className="text-sm">{draft.recipient}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Subject:</p>
                              <p className="text-sm font-medium">{draft.subject || "Untitled draft"}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-auto">
                            <Badge
                              variant="outline"
                              className={draft.status === "sent" ? resolvedBadgeClass : "border-muted-foreground/30"}
                            >
                              {draft.status}
                            </Badge>
                            <span className={meetingBadgeClass} title={draft.meetingTitle || "No meeting"}>
                              {draft.meetingTitle || "No meeting"}
                            </span>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg border">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                            {draft.body}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(draft.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                          <div className="flex items-center gap-2">
                            {!isApproved && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveEmail(draft)}
                                  disabled={isSending || !isGoogleConnected}
                                  className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  {isSending ? "Saving..." : "Save to Drafts"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeclineEmail(draft)}
                                  className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                            {isApproved && (
                              <Badge variant="outline" className={resolvedBadgeClass}>
                                Draft Saved
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
              <TabsContent value="pending" className="space-y-3">
                {loadingEmails ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading emails...</p>
                ) : pendingEmails.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No pending email drafts.
                  </p>
                ) : (
                  pendingEmails.map((draft) => {
                    const isSending = emailSending[draft.id];
                    const isApproved = emailApproved[draft.id];

                    return (
                      <div key={draft.id} className="space-y-3 border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            {draft.recipient && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">To:</p>
                                <p className="text-sm">{draft.recipient}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Subject:</p>
                              <p className="text-sm font-medium">{draft.subject || "Untitled draft"}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-auto">
                            <Badge variant="outline" className="border-muted-foreground/30">
                              {draft.status}
                            </Badge>
                            <span className={meetingBadgeClass} title={draft.meetingTitle || "No meeting"}>
                              {draft.meetingTitle || "No meeting"}
                            </span>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg border">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                            {draft.body}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(draft.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                          <div className="flex items-center gap-2">
                            {!isApproved && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveEmail(draft)}
                                  disabled={isSending || !isGoogleConnected}
                                  className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  {isSending ? "Saving..." : "Save to Drafts"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeclineEmail(draft)}
                                  className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                            {isApproved && (
                              <Badge variant="outline" className={resolvedBadgeClass}>
                                Draft Saved
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card
          hidden={expandedPanel !== "events"}
          aria-hidden={expandedPanel !== "events"}
          className="transition-all duration-500 lg:col-span-2 shadow-lg ring-1 ring-primary/10"
        >
          <CardHeader
            className="cursor-pointer"
            onClick={() => setExpandedPanel(null)}
          >
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Calendar Events
            </CardTitle>
            <CardDescription>Scheduled items from meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all">All Events</TabsTrigger>
                <TabsTrigger value="pending">Non-Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-3">
                {loadingEvents ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading events...</p>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No calendar events yet.
                  </p>
                ) : (
                  events.map((event) => {
                    const isCreating = calendarCreating[event.id];
                    const isApproved = calendarApproved[event.id] || event.status === "created";
                    const overrides = calendarOverrides[event.id] || {};
                    const displayStartTime = overrides.startTime;
                    const displayEndTime = overrides.endTime;
                    const needsStartEnd = true;
                    const needsTimezone = !event.timezone && !overrides.timezone;

                    return (
                      <div key={event.id} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <p className="text-sm font-semibold">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {displayStartTime && (
                                <span>
                                  <span className="font-semibold">Start:</span>{" "}
                                  {format(new Date(displayStartTime), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              )}
                              {displayEndTime && (
                                <span>
                                  <span className="font-semibold">End:</span>{" "}
                                  {format(new Date(displayEndTime), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              )}
                              {(overrides.timezone || event.timezone) && (
                                <span>
                                  <span className="font-semibold">TZ:</span> {overrides.timezone ?? event.timezone}
                                </span>
                              )}
                              {event.location && (
                                <span>
                                  <span className="font-semibold">Loc:</span> {event.location}
                                </span>
                              )}
                            </div>
                            {(needsStartEnd || needsTimezone) && !isApproved && (
                              <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 bg-background/70 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Missing details
                                </p>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-muted-foreground">Start</label>
                                  <Input
                                    type="datetime-local"
                                    value={overrides.startTime ?? ""}
                                    onChange={(e) =>
                                      setCalendarOverrides(prev => ({
                                        ...prev,
                                        [event.id]: { ...prev[event.id], startTime: e.target.value },
                                      }))
                                    }
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-muted-foreground">End</label>
                                  <div className="flex flex-wrap gap-2">
                                    {[
                                      { label: "+15 min", minutes: 15 },
                                      { label: "+30 min", minutes: 30 },
                                      { label: "+2 hours", minutes: 120 },
                                    ].map((option) => {
                                      const base = overrides.startTime;
                                      const disabled = !base || Number.isNaN(new Date(base).getTime());
                                      return (
                                        <button
                                          key={option.label}
                                          type="button"
                                          disabled={disabled}
                                          onClick={() => {
                                            if (!base) return;
                                            const next = new Date(base);
                                            if (Number.isNaN(next.getTime())) return;
                                            next.setMinutes(next.getMinutes() + option.minutes);
                                            setCalendarOverrides(prev => ({
                                              ...prev,
                                              [event.id]: { ...prev[event.id], endTime: toDateTimeLocalValue(next.toISOString()) },
                                            }));
                                          }}
                                          className="rounded-md border border-muted-foreground/30 px-2 py-1 text-[11px] text-muted-foreground transition hover:border-muted-foreground/60 hover:text-foreground disabled:opacity-50"
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <Input
                                    type="datetime-local"
                                    value={overrides.endTime ?? ""}
                                    onChange={(e) =>
                                      setCalendarOverrides(prev => ({
                                        ...prev,
                                        [event.id]: { ...prev[event.id], endTime: e.target.value },
                                      }))
                                    }
                                    className="h-8 text-xs"
                                  />
                                </div>
                                {needsTimezone && (
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground">Timezone</label>
                                    <select
                                      value={overrides.timezone ?? event.timezone ?? defaultTimezone}
                                      onChange={(e) =>
                                        setCalendarOverrides(prev => ({
                                          ...prev,
                                          [event.id]: { ...prev[event.id], timezone: e.target.value },
                                        }))
                                      }
                                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                      {timezoneOptions.map((tz) => (
                                        <option key={tz} value={tz}>
                                          {tz}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-auto">
                            <Badge
                              variant="outline"
                              className={isApproved ? resolvedBadgeClass : "border-muted-foreground/30"}
                            >
                              {event.status}
                            </Badge>
                            <span className={meetingBadgeClass} title={event.meetingTitle || "No meeting"}>
                              {event.meetingTitle || "No meeting"}
                            </span>
                          </div>
                        </div>
                        {!isApproved && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveCalendar(event)}
                              disabled={isCreating || !isGoogleConnected}
                              className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                            >
                              {isCreating ? "Creating..." : "Add to Calendar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveCalendar(event)}
                              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                        {isApproved && (
                          <Badge variant="outline" className={resolvedBadgeClass}>
                            Added
                          </Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </TabsContent>
              <TabsContent value="pending" className="space-y-3">
                {loadingEvents ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading events...</p>
                ) : pendingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No pending calendar events.
                  </p>
                ) : (
                  pendingEvents.map((event) => {
                    const isCreating = calendarCreating[event.id];
                    const isApproved = calendarApproved[event.id];
                    const overrides = calendarOverrides[event.id] || {};
                    const displayStartTime = overrides.startTime;
                    const displayEndTime = overrides.endTime;
                    const needsStartEnd = true;
                    const needsTimezone = !event.timezone && !overrides.timezone;

                    return (
                      <div key={event.id} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <p className="text-sm font-semibold">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {displayStartTime && (
                                <span>
                                  <span className="font-semibold">Start:</span>{" "}
                                  {format(new Date(displayStartTime), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              )}
                              {displayEndTime && (
                                <span>
                                  <span className="font-semibold">End:</span>{" "}
                                  {format(new Date(displayEndTime), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              )}
                              {(overrides.timezone || event.timezone) && (
                                <span>
                                  <span className="font-semibold">TZ:</span> {overrides.timezone ?? event.timezone}
                                </span>
                              )}
                              {event.location && (
                                <span>
                                  <span className="font-semibold">Loc:</span> {event.location}
                                </span>
                              )}
                            </div>
                            {(needsStartEnd || needsTimezone) && !isApproved && (
                              <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 bg-background/70 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Missing details
                                </p>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-muted-foreground">Start</label>
                                  <Input
                                    type="datetime-local"
                                    value={overrides.startTime ?? ""}
                                    onChange={(e) =>
                                      setCalendarOverrides(prev => ({
                                        ...prev,
                                        [event.id]: { ...prev[event.id], startTime: e.target.value },
                                      }))
                                    }
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-muted-foreground">End</label>
                                  <div className="flex flex-wrap gap-2">
                                    {[
                                      { label: "+15 min", minutes: 15 },
                                      { label: "+30 min", minutes: 30 },
                                      { label: "+2 hours", minutes: 120 },
                                    ].map((option) => {
                                      const base = overrides.startTime;
                                      const disabled = !base || Number.isNaN(new Date(base).getTime());
                                      return (
                                        <button
                                          key={option.label}
                                          type="button"
                                          disabled={disabled}
                                          onClick={() => {
                                            if (!base) return;
                                            const next = new Date(base);
                                            if (Number.isNaN(next.getTime())) return;
                                            next.setMinutes(next.getMinutes() + option.minutes);
                                            setCalendarOverrides(prev => ({
                                              ...prev,
                                              [event.id]: { ...prev[event.id], endTime: toDateTimeLocalValue(next.toISOString()) },
                                            }));
                                          }}
                                          className="rounded-md border border-muted-foreground/30 px-2 py-1 text-[11px] text-muted-foreground transition hover:border-muted-foreground/60 hover:text-foreground disabled:opacity-50"
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <Input
                                    type="datetime-local"
                                    value={overrides.endTime ?? ""}
                                    onChange={(e) =>
                                      setCalendarOverrides(prev => ({
                                        ...prev,
                                        [event.id]: { ...prev[event.id], endTime: e.target.value },
                                      }))
                                    }
                                    className="h-8 text-xs"
                                  />
                                </div>
                                {needsTimezone && (
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground">Timezone</label>
                                    <select
                                      value={overrides.timezone ?? event.timezone ?? defaultTimezone}
                                      onChange={(e) =>
                                        setCalendarOverrides(prev => ({
                                          ...prev,
                                          [event.id]: { ...prev[event.id], timezone: e.target.value },
                                        }))
                                      }
                                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                      {timezoneOptions.map((tz) => (
                                        <option key={tz} value={tz}>
                                          {tz}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-auto">
                            <Badge variant="outline" className="border-muted-foreground/30">
                              {event.status}
                            </Badge>
                            <span className={meetingBadgeClass} title={event.meetingTitle || "No meeting"}>
                              {event.meetingTitle || "No meeting"}
                            </span>
                          </div>
                        </div>
                        {!isApproved && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveCalendar(event)}
                              disabled={isCreating || !isGoogleConnected}
                              className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                            >
                              {isCreating ? "Creating..." : "Add to Calendar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveCalendar(event)}
                              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                        {isApproved && (
                          <Badge variant="outline" className={resolvedBadgeClass}>
                            Added
                          </Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card
          hidden={expandedPanel !== "blockers"}
          aria-hidden={expandedPanel !== "blockers"}
          className="transition-all duration-500 lg:col-span-2 shadow-lg ring-1 ring-primary/10"
        >
          <CardHeader
            className="cursor-pointer"
            onClick={() => setExpandedPanel(null)}
          >
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              Blockers
            </CardTitle>
            <CardDescription>Issues that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all">All Blockers</TabsTrigger>
                <TabsTrigger value="open">Non-Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-3">
                {loadingBlockers ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading blockers...</p>
                ) : sortedBlockers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No blockers found.
                  </p>
                ) : (
                  sortedBlockers.map((blocker) => (
                    <div key={blocker.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{blocker.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(blocker.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-auto">
                          {blocker.resolved ? (
                            <Badge variant="outline" className={resolvedBadgeClass}>
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${getPriorityClasses(blocker.severity)}`}>
                              {blocker.severity}
                            </Badge>
                          )}
                          <span className={meetingBadgeClass} title={blocker.meetingTitle || "No meeting"}>
                            {blocker.meetingTitle || "No meeting"}
                          </span>
                        </div>
                      </div>
                      {!blocker.resolved && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolveBlocker(blocker.id)}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineBlocker(blocker.id)}
                            className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="open" className="space-y-3">
                {loadingBlockers ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading blockers...</p>
                ) : sortedPendingBlockers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No open blockers.
                  </p>
                ) : (
                  sortedPendingBlockers.map((blocker) => (
                    <div key={blocker.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{blocker.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(blocker.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-auto">
                          <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${getPriorityClasses(blocker.severity)}`}>
                            {blocker.severity}
                          </Badge>
                          <span className={meetingBadgeClass} title={blocker.meetingTitle || "No meeting"}>
                            {blocker.meetingTitle || "No meeting"}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveBlocker(blocker.id)}
                          className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineBlocker(blocker.id)}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
