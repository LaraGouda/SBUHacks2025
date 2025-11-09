import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, Trash2, Clock, TrendingUp, Calendar, Mail, AlertCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  meetingId?: string;
}

interface DashboardStats {
  totalMeetings: number;
  totalTasks: number;
  completedTasks: number;
  pendingEmails: number;
  upcomingEvents: number;
}

interface RecentMeeting {
  id: string;
  title: string;
  summary: string | null;
  created_at: string;
}

export const Dashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [recentMeeting, setRecentMeeting] = useState<RecentMeeting | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalMeetings: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingEmails: 0,
    upcomingEvents: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchStats();
      fetchRecentMeeting();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch tasks from the tasks table
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('id, description, completed, completed_at, meeting_id, created_at')
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
      }));
      
      setTasks(allTasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
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
        const [meetingsRes, tasksRes, emailsRes, eventsRes] = await Promise.all([
          supabase.from('meetings').select('id', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('tasks').select('id, completed', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('email_drafts').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'draft'),
          supabase.from('calendar_events').select('id', { count: 'exact' }).eq('user_id', user.id).gt('start_time', new Date().toISOString()),
        ]);

        const totalMeetings = meetingsRes.count || 0;
        const totalTasks = tasksRes.count || 0;
        const completedTasks = tasksRes.data?.filter(t => t.completed).length || 0;
        const pendingEmails = emailsRes.count || 0;
        const upcomingEvents = eventsRes.count || 0;

        setStats({
          totalMeetings,
          totalTasks,
          completedTasks,
          pendingEmails,
          upcomingEvents,
        });
        return;
      }

      if (statsData) {
        setStats({
          totalMeetings: statsData.total_meetings || 0,
          totalTasks: statsData.total_tasks || 0,
          completedTasks: statsData.completed_tasks || 0,
          pendingEmails: statsData.pending_emails || 0,
          upcomingEvents: statsData.upcoming_events || 0,
        });
      }
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentMeeting = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, summary, created_at')
        .eq('user_id', user.id)
        .not('summary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching recent meeting:', error);
        return;
      }

      if (data) {
        setRecentMeeting(data);
      }
    } catch (error: any) {
      console.error('Error fetching recent meeting:', error);
    }
  };

  const addTask = async () => {
    if (!newTask.trim() || !user?.id) return;

    try {
      const { data: newTaskData, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          description: newTask.trim(),
          completed: false,
        })
        .select()
        .single();

      if (error) throw error;

      const task: Task = {
        id: newTaskData.id,
        text: newTaskData.description,
        completed: false,
        createdAt: newTaskData.created_at,
      };

      setTasks([task, ...tasks]);
      setNewTask("");
      fetchStats(); // Refresh stats
      toast({
        title: "Task Added",
        description: "New task has been added to your list.",
      });
    } catch (error: any) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task. Please try again.",
        variant: "destructive",
      });
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

  const deleteTask = async (taskId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.filter(task => task.id !== taskId));
      fetchStats();
      
      toast({
        title: "Task Deleted",
        description: "Task has been removed from your list.",
      });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  if (loading) {
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
        <Card className="hover:shadow-lg transition-shadow duration-300 animate-fade-in" style={{ animationDelay: '0ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMeetings}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 animate-fade-in" style={{ animationDelay: '100ms' }}>
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

        <Card className="hover:shadow-lg transition-shadow duration-300 animate-fade-in" style={{ animationDelay: '200ms' }}>
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

        <Card className="hover:shadow-lg transition-shadow duration-300 animate-fade-in" style={{ animationDelay: '300ms' }}>
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

        <Card className="hover:shadow-lg transition-shadow duration-300 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTasks > 0 
                ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Completion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Meeting Summary */}
        <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Recent Meeting Summary
            </CardTitle>
            <CardDescription>
              {recentMeeting 
                ? `From: ${recentMeeting.title}`
                : "No meeting summaries available yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentMeeting?.summary ? (
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {recentMeeting.summary}
                </p>
                <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                  {format(new Date(recentMeeting.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Analyze a meeting transcript to see summaries here.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Temporarily hidden To-Do List */}
        {/* <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              To-Do List
            </CardTitle>
            <CardDescription>Manage your action items from meetings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a new task..."
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={addTask} size="sm" className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {pendingTasks.length > 0 ? (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-all animate-fade-in"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="w-5 h-5 border-2 border-primary rounded hover:bg-primary/10 transition-colors"
                    />
                    <span className="flex-1 text-sm">{task.text}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTask(task.id)}
                      className="h-7 w-7 p-0 hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending tasks. Great job! 🎉
              </p>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Completed</h4>
                {completedTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 opacity-75 animate-fade-in"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="w-5 h-5 border-2 border-green-500 bg-green-500 rounded flex items-center justify-center"
                    >
                      <CheckSquare className="w-3 h-3 text-white" />
                    </button>
                    <span className="flex-1 text-sm line-through text-muted-foreground">
                      {task.text}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTask(task.id)}
                      className="h-7 w-7 p-0 hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card> */}

        {/* Quick Actions */}
        <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Quick Insights
            </CardTitle>
            <CardDescription>Your meeting activity overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Recent Activity</span>
                </div>
                <Badge variant="secondary">{stats.totalMeetings} meetings</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/20">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium">Task Completion</span>
                </div>
                <Badge variant="secondary">
                  {stats.totalTasks > 0 
                    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                    : 0}%
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Email Drafts</span>
                </div>
                <Badge variant="secondary">{stats.pendingEmails} ready</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Calendar Events</span>
                </div>
                <Badge variant="secondary">{stats.upcomingEvents} scheduled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

