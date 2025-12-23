import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  CheckSquare, 
  Mail, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  Link as LinkIcon,
  X,
  Send,
  Plus,
  Sparkles
} from "lucide-react";
import { useGoogleAuth } from "@/contexts/GoogleAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { parseAnalysisResults, type TaskItem, type BlockerItem, type CalendarEvent, type EmailData, type AnalysisResults } from "@/lib/parseAnalysisResults";

interface ResultsDisplayProps {
  results: {
    summary?: any;
    nextTasks?: any;
    email?: any;
    calendar?: any;
    blockers?: any;
  };
}

// Enhanced JSON parser that handles various formats and always returns readable text
const parseContent = (content: any): any => {
  if (content === null || content === undefined) {
    return null;
  }

  // Helper to extract text from nested objects
  const extractText = (obj: any): string => {
    if (typeof obj === 'string') return obj;
    if (obj === null || obj === undefined) return '';
    if (Array.isArray(obj)) {
      return obj.map(extractText).filter(Boolean).join('\n');
    }
    if (typeof obj === 'object') {
      // Try common text fields
      return obj.summary || obj.text || obj.content || obj.description || obj.body || obj.task || obj.title || obj.name || '';
    }
    return String(obj);
  };

  // Helper to extract tasks from nested structures
  const extractTasks = (obj: any): string[] => {
    if (Array.isArray(obj)) {
      return obj.map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          // Extract task text
          const taskText = item.task || item.description || item.text || item.title || item.summary || item.item || String(item);
          
          // Optionally include rationale and priority for richer display
          // For now, just return the task text
          return taskText;
        }
        return String(item);
      }).filter((item: string) => item && item.trim());
    }
    return [];
  };

  if (typeof content === 'string') {
    const trimmed = content.trim();
    
    // Empty string
    if (!trimmed) {
      return null;
    }

    // Try to parse JSON - be more aggressive
    let jsonString = trimmed;
    
    // Remove markdown code blocks if present
    if (trimmed.includes('```json')) {
      jsonString = trimmed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    // Try to find JSON in the string (even if not at the start)
    const jsonMatch = jsonString.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Handle nested meeting summary structure
        if (parsed.meetingSummary || parsed.meeting_summary) {
          const summaryObj = parsed.meetingSummary || parsed.meeting_summary;
          if (summaryObj.summary) {
            let summaryText = summaryObj.summary;
            
            // Also include decisions_goals_outcomes if present
            if (summaryObj.decisions_goals_outcomes && Array.isArray(summaryObj.decisions_goals_outcomes)) {
              const decisions = summaryObj.decisions_goals_outcomes
                .map((d: any) => d.item || d.text || d.description || String(d))
                .filter(Boolean);
              if (decisions.length > 0) {
                summaryText += '\n\n' + decisions.join('\n');
              }
            }
            
            return summaryText;
          }
          return extractText(summaryObj);
        }
        
        // Handle next_steps structure
        if (parsed.next_steps || parsed.nextSteps) {
          const steps = parsed.next_steps || parsed.nextSteps;
          const tasks = extractTasks(steps);
          if (tasks.length > 0) return tasks;
        }
        
        // Handle decisions_goals_outcomes at root level
        if (parsed.decisions_goals_outcomes) {
          const decisions = parsed.decisions_goals_outcomes;
          if (Array.isArray(decisions)) {
            return decisions.map((d: any) => {
              const item = d.item || d.text || d.description || String(d);
              // Include reference if present
              if (d.reference) {
                return `${item} ${d.reference}`;
              }
              return item;
            }).filter(Boolean).join('\n');
          }
        }
        
        // Handle meeting_summary at root level
        if (parsed.meeting_summary) {
          const summaryObj = parsed.meeting_summary;
          if (summaryObj.summary) {
            let summaryText = summaryObj.summary;
            
            // Include decisions if present
            if (summaryObj.decisions_goals_outcomes && Array.isArray(summaryObj.decisions_goals_outcomes)) {
              const decisions = summaryObj.decisions_goals_outcomes
                .map((d: any) => {
                  const item = d.item || d.text || d.description || String(d);
                  if (d.reference) {
                    return `${item} ${d.reference}`;
                  }
                  return item;
                })
                .filter(Boolean);
              if (decisions.length > 0) {
                summaryText += '\n\n' + decisions.join('\n');
              }
            }
            
            return summaryText;
          }
        }
        
        if (Array.isArray(parsed)) {
          const tasks = extractTasks(parsed);
          if (tasks.length > 0) return tasks;
          return parsed.map(extractText).filter(Boolean).join('\n');
        }
        
        if (typeof parsed === 'object' && parsed !== null) {
          // Try to extract meaningful text from object
          const text = parsed.summary || parsed.text || parsed.content || parsed.description || parsed.body || parsed.task || extractText(parsed);
          if (text) return text;
        }
        
        // If we can't extract text, return the stringified version
        return JSON.stringify(parsed, null, 2);
      } catch {
        // Not valid JSON, continue
      }
    }

    // Check if it's a newline-separated list
    if (trimmed.includes('\n')) {
      const lines = trimmed.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^[-*•]\s*$/) && !line.startsWith('```') && !line.match(/^[0-9]+\s*$/))
        .map(line => line.replace(/^[-*•]\s*/, '').replace(/^[0-9]+\.\s*/, ''));
      
      if (lines.length > 1) {
        return lines;
      }
    }

    // Check if it's a comma-separated list
    if (trimmed.includes(',') && !trimmed.includes('.')) {
      const items = trimmed.split(',')
        .map(item => item.trim())
        .filter(item => item);
      
      if (items.length > 1) {
        return items;
      }
    }

    return trimmed;
  }

  if (Array.isArray(content)) {
    const tasks = extractTasks(content);
    if (tasks.length > 0) return tasks;
    return content.map(extractText).filter(Boolean);
  }

  if (typeof content === 'object' && content !== null) {
    // Handle nested structures
    if (content.meetingSummary || content.meeting_summary) {
      const summaryObj = content.meetingSummary || content.meeting_summary;
      return summaryObj.summary || extractText(summaryObj);
    }
    
    if (content.next_steps || content.nextSteps) {
      const steps = content.next_steps || content.nextSteps;
      const tasks = extractTasks(steps);
      if (tasks.length > 0) return tasks;
    }
    
    if (content.decisions_goals_outcomes) {
      const decisions = content.decisions_goals_outcomes;
      if (Array.isArray(decisions)) {
        return decisions.map((d: any) => d.item || d.text || d.description || String(d)).filter(Boolean).join('\n');
      }
    }
    
    const text = content.summary || content.text || content.content || content.description || content.body || content.task || extractText(content);
    if (text) return text;
    
    // Last resort: try to stringify and extract
    return JSON.stringify(content, null, 2);
  }

  return String(content);
};

// Helper to render text content nicely
const renderText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\n\n+/g, '\n\n') // Normalize multiple newlines
    .trim();
};

// Component to render formatted text with proper line breaks
const FormattedText = ({ text }: { text: string }) => {
  if (!text) return null;
  
  // Final check: if it looks like JSON, try to extract readable text
  let finalText = text;
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const extracted = parseContent(parsed);
      if (typeof extracted === 'string' && extracted !== text) {
        finalText = extracted;
      } else if (Array.isArray(extracted) && extracted.length > 0) {
        finalText = extracted.join('\n');
      }
    } catch {
      // If parsing fails, use original text
    }
  }
  
  const formatted = renderText(finalText);
  const paragraphs = formatted.split('\n\n').filter(p => p.trim());
  
  if (paragraphs.length > 1) {
    return (
      <div className="space-y-3">
        {paragraphs.map((paragraph, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {paragraph.split('\n').map((line, j) => (
              <span key={j}>
                {line}
                {j < paragraph.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        ))}
      </div>
    );
  }
  
  return (
    <p className="text-sm leading-relaxed">
      {formatted.split('\n').map((line, i) => (
        <span key={i}>
          {line}
          {i < formatted.split('\n').length - 1 && <br />}
        </span>
      ))}
    </p>
  );
};

export const ResultsDisplay = ({ results }: ResultsDisplayProps) => {
  const { isGoogleConnected, connectGoogle, accessToken, refreshToken } = useGoogleAuth();
  const { toast } = useToast();
  const [emailSending, setEmailSending] = useState(false);
  const [emailApproved, setEmailApproved] = useState(false);
  const [emailDeclined, setEmailDeclined] = useState(false);
  const [calendarCreating, setCalendarCreating] = useState<{ [key: number]: boolean }>({});
  const [calendarApproved, setCalendarApproved] = useState<{ [key: number]: boolean }>({});
  const [calendarDeclined, setCalendarDeclined] = useState<{ [key: number]: boolean }>({});

  // Use the centralized helper function to parse analysis results
  // This ensures consistent parsing across the app
  const parsedResults = parseAnalysisResults(results);

  const handleApproveEmail = async () => {
    if (!isGoogleConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect your Google account first.",
        variant: "destructive",
      });
      return;
    }

    setEmailApproved(true);
    setEmailSending(true);
    
    try {
      // Try to refresh token if needed
      let tokenToUse = accessToken;
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      if (tokenExpiry && new Date(tokenExpiry) <= new Date()) {
        // Token expired, try to refresh
        const refreshed = await refreshToken();
        if (refreshed) {
          tokenToUse = localStorage.getItem('google_access_token');
        }
      }

      if (!tokenToUse) {
        throw new Error('No valid access token available. Please reconnect your Google account.');
      }

      // Use structured email data
      const emailData = parsedResults.email;
      const emailBody = emailData.body || '';
      const emailSubject = emailData.subject || 'Meeting Follow-up';
      const recipients = emailData.recipients || [];
      const recipient = recipients.length > 0 ? recipients[0] : 'recipient@example.com';

      console.log('Sending email with:', { recipients, subject: emailSubject, bodyLength: emailBody.length });

      // Use direct fetch to the Supabase Functions endpoint so we can
      // inspect raw status and body. This avoids generic client-side
      // error messages and allows us to include all recipients.
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
          // include all recipients so draft has CCs if present
          to: Array.isArray(recipients) ? recipients.join(', ') : recipient,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      let respBody: any = null;
      try {
        respBody = await resp.json();
      } catch (err) {
        respBody = { raw: await resp.text() };
      }

      console.log('send-gmail response status:', resp.status, respBody);

      if (!resp.ok) {
        const message = respBody?.error || respBody?.message || `Edge function returned status ${resp.status}`;
        throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
      }

      // Success - open Gmail compose in a new tab with the same params
      try {
        const mailParams = new URLSearchParams();
        mailParams.set('view', 'cm');
        mailParams.set('fs', '1');
        mailParams.set('to', Array.isArray(recipients) ? recipients.join(',') : recipient);
        mailParams.set('su', emailSubject);
        mailParams.set('body', emailBody);

        const composeUrl = `https://mail.google.com/mail/?${mailParams.toString()}`;
        window.open(composeUrl, '_blank');
      } catch (err) {
        console.warn('Unable to open compose tab:', err);
      }

      toast({
        title: "Draft Saved",
        description: "Email draft has been saved to your Gmail drafts folder!",
      });
    } catch (error: any) {
      console.error('Error saving email draft:', error);
      setEmailApproved(false);

      const msg = (error?.message || String(error || '')).toLowerCase();

      // If Gmail permission scope is missing, give a clear actionable message
      if (msg.includes('gmail.compose') || msg.includes('permission') || msg.includes('insufficient')) {
        toast({
          title: "Failed to Save",
          description: "Permission denied. Please ensure your Google account has the required Gmail scopes (e.g. gmail.compose) and reconnect your account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to Save",
          description: error.message || "Could not save email draft. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setEmailSending(false);
    }
  };

  const handleDeclineEmail = () => {
    setEmailDeclined(true);
    toast({
      title: "Email Declined",
      description: "Email draft has been declined.",
    });
  };

  const handleApproveCalendar = async (event: CalendarEvent, index: number) => {
    if (!isGoogleConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect your Google account first.",
        variant: "destructive",
      });
      return;
    }

    setCalendarApproved(prev => ({ ...prev, [index]: true }));
    setCalendarCreating(prev => ({ ...prev, [index]: true }));
    
    try {
      // Try to refresh token if needed
      let tokenToUse = accessToken;
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      if (tokenExpiry && new Date(tokenExpiry) <= new Date()) {
        // Token expired, try to refresh
        const refreshed = await refreshToken();
        if (refreshed) {
          tokenToUse = localStorage.getItem('google_access_token');
        }
      }

      if (!tokenToUse) {
        throw new Error('No valid access token available. Please reconnect your Google account.');
      }

      // Use structured calendar event data
      const title = event.title || 'Meeting Follow-up';
      const description = event.description || 'Created from meeting analysis';
      
      // Parse start and end times, default to tomorrow if not specified
      let startTime: Date;
      let endTime: Date;
      
      if (event.startTime) {
        startTime = new Date(event.startTime);
      } else {
        startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      }
      
      if (event.endTime) {
        endTime = new Date(event.endTime);
      } else {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
      }

      const { data, error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          accessToken: tokenToUse,
          summary: title,
          description: description,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create calendar event');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Event Created",
        description: "Calendar event has been created successfully!",
      });
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      setCalendarApproved(prev => ({ ...prev, [index]: false }));
      toast({
        title: "Failed to Create",
        description: error.message || "Could not create calendar event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCalendarCreating(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleDeclineCalendar = (index: number) => {
    setCalendarDeclined(prev => ({ ...prev, [index]: true }));
    toast({
      title: "Event Declined",
      description: "Calendar event has been declined.",
    });
  };

  const sections = [
    {
      title: "Meeting Summary",
      description: "Key points and decisions",
      icon: FileText,
      content: parsedResults.summary,
      color: "text-primary",
      type: "summary",
    },
    {
      title: "Follow-up Email",
      description: "Ready-to-send draft",
      icon: Mail,
      content: parsedResults.email,
      color: "text-primary",
      type: "email",
    },
    {
      title: "Next Tasks",
      description: "Action items and assignments",
      icon: CheckSquare,
      content: parsedResults.nextTasks,
      color: "text-accent",
      type: "tasks",
    },
    {
      title: "Calendar Events",
      description: "Scheduled meetings and deadlines",
      icon: Calendar,
      content: parsedResults.calendar,
      color: "text-accent",
      type: "calendar",
    },
    {
      title: "Blockers & Issues",
      description: "Identified obstacles",
      icon: AlertCircle,
      content: parsedResults.blockers,
      color: "text-destructive",
      type: "blockers",
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-8 animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Analysis Complete
          </h2>
        </div>
        <p className="text-muted-foreground">
          Here are the insights extracted from your meeting
        </p>
        {!isGoogleConnected && (
          <Button 
            onClick={connectGoogle} 
            variant="outline" 
            className="mt-4 hover:scale-105 transition-transform"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Connect Google Account
          </Button>
        )}
        {isGoogleConnected && (
          <div className="flex items-center justify-center gap-2 mt-4 animate-fade-in">
            <CheckCircle className="w-4 h-4 text-green-600 animate-pulse" />
            <span className="text-sm text-muted-foreground">Google account connected</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {sections.map((section, index) => {
          const Icon = section.icon;
          const isArray = Array.isArray(section.content);
          const hasContent = isArray ? section.content.length > 0 : section.content;
          
          return (
            <Card 
              key={index} 
              className="shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${section.color} animate-pulse`} />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasContent ? (
                  <p className="text-sm text-muted-foreground italic">No content available</p>
                ) : section.type === 'tasks' ? (
                  // Tasks Card - Display task, rationale, and priority
                  <ul className="space-y-3">
                    {(section.content as TaskItem[]).map((task, i) => (
                      <li key={i} className="p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-start gap-2">
                          <Badge variant="secondary" className="mt-0.5 shrink-0">
                            {i + 1}
                          </Badge>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium">{task.task}</p>
                            {task.rationale && (
                              <p className="text-xs text-muted-foreground italic">
                                <span className="font-semibold">Rationale:</span> {task.rationale}
                              </p>
                            )}
                            {task.priority && (
                              <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                {task.priority} priority
                              </Badge>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : section.type === 'blockers' ? (
                  // Blockers Card - Display description, quote, and timestamp
                  <ul className="space-y-3">
                    {(section.content as BlockerItem[]).map((blocker, i) => (
                      <li key={i} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                        <div className="flex items-start gap-2">
                          <Badge variant="destructive" className="mt-0.5 shrink-0">
                            {i + 1}
                          </Badge>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium">{blocker.description}</p>
                            {blocker.quote && (
                              <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground pl-2">
                                "{blocker.quote}"
                              </p>
                            )}
                            {blocker.timestamp && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Time:</span> {blocker.timestamp}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : section.type === 'calendar' ? (
                  // Calendar Card - Display title, description, time, attendees, status with buttons
                  <ul className="space-y-3">
                    {(section.content as CalendarEvent[]).map((event, i) => {
                      const isApproved = calendarApproved[i];
                      const isDeclined = calendarDeclined[i];
                      const isCreating = calendarCreating[i];
                      
                      return (
                        <li 
                          key={i} 
                          className={`p-3 rounded-lg border transition-all ${
                            isApproved ? 'bg-green-50 dark:bg-green-950 border-green-200' :
                            isDeclined ? 'bg-red-50 dark:bg-red-950 border-red-200 opacity-60' :
                            'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Badge variant="secondary" className="mt-0.5 shrink-0">
                              {i + 1}
                            </Badge>
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-medium">{event.title}</p>
                              {event.description && (
                                <p className="text-xs text-muted-foreground">{event.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {event.startTime && (
                                  <span>
                                    <span className="font-semibold">Start:</span> {new Date(event.startTime).toLocaleString()}
                                  </span>
                                )}
                                {event.endTime && (
                                  <span>
                                    <span className="font-semibold">End:</span> {new Date(event.endTime).toLocaleString()}
                                  </span>
                                )}
                                {event.timezone && (
                                  <span>
                                    <span className="font-semibold">TZ:</span> {event.timezone}
                                  </span>
                                )}
                              </div>
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-semibold">Attendees:</span> {event.attendees.join(', ')}
                                </div>
                              )}
                              {event.status && (
                                <Badge variant="outline" className="text-xs">
                                  {event.status}
                                </Badge>
                              )}
                            </div>
                            {!isApproved && !isDeclined && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveCalendar(event, i)}
                                  disabled={isCreating || !isGoogleConnected}
                                  className="h-7 px-2 hover:bg-green-50 hover:border-green-300"
                                >
                                  {isCreating ? (
                                    <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3 text-green-600" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeclineCalendar(i)}
                                  disabled={isCreating || !isGoogleConnected}
                                  className="h-7 px-2 hover:bg-red-50 hover:border-red-300"
                                >
                                  <X className="w-3 h-3 text-red-600" />
                                </Button>
                              </div>
                            )}
                            {isApproved && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Added
                              </Badge>
                            )}
                            {isDeclined && (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                                <X className="w-3 h-3 mr-1" />
                                Declined
                              </Badge>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : section.type === 'email' ? (
                  // Email Card - Display reason, recipients, subject, body, and references
                  <div className="space-y-4">
                    {(() => {
                      const email = section.content as EmailData;
                      return (
                        <>
                          {email.reason && (
                            <div className="p-2 rounded bg-muted/50">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Reason:</p>
                              <p className="text-sm">{email.reason}</p>
                            </div>
                          )}
                          {email.recipients && email.recipients.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">To:</p>
                              <p className="text-sm">{email.recipients.join(', ')}</p>
                            </div>
                          )}
                          {email.subject && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Subject:</p>
                              <p className="text-sm font-medium">{email.subject}</p>
                            </div>
                          )}
                          <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg border">
                            <FormattedText text={email.body} />
                          </div>
                          {email.references && email.references.length > 0 && (
                            <div className="mt-4 p-3 rounded-lg border bg-muted/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">References:</p>
                              <ul className="space-y-2 text-xs">
                                {email.references.map((ref, idx) => (
                                  <li key={idx} className="border-l-2 border-muted-foreground pl-2">
                                    <span className="font-semibold">{ref.speaker}</span>
                                    {ref.timestamp && <span className="text-muted-foreground"> ({ref.timestamp})</span>}
                                    <p className="mt-1 italic">{ref.text}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {!emailApproved && !emailDeclined && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={handleApproveEmail}
                          disabled={emailSending || !isGoogleConnected}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {emailSending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Save to Drafts
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleDeclineEmail}
                          disabled={emailSending}
                          variant="outline"
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    )}
                    {emailApproved && (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 mt-4">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Draft Saved
                      </Badge>
                    )}
                    {emailDeclined && (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 mt-4">
                        <X className="w-4 h-4 mr-1" />
                        Email Declined
                      </Badge>
                    )}
                  </div>
                ) : isArray ? (
                  // Fallback for other array types
                  <>
                    <ul className="space-y-2">
                      {(section.content as string[]).map((item, i) => {
                        // Aggressively extract text from JSON
                        let itemText = '';
                        
                        if (typeof item === 'string') {
                          itemText = item;
                          
                          // Strip markdown code blocks first
                          if (itemText.includes('```')) {
                            itemText = itemText
                              .replace(/```json\s*/gi, '')
                              .replace(/```\s*/g, '')
                              .replace(/^```/gm, '')
                              .replace(/```$/gm, '')
                              .trim();
                          }
                          
                          // If it looks like JSON, parse it multiple times if needed
                          if (itemText.trim().startsWith('{') || itemText.trim().startsWith('[')) {
                            try {
                              const parsed = JSON.parse(itemText);
                              
                              // Extract text based on structure and section type
                              if (section.type === 'tasks') {
                                // For tasks, prioritize task field
                                if (parsed.task) {
                                  itemText = parsed.task;
                                  // Optionally include rationale if present
                                  if (parsed.rationale) {
                                    itemText += ` (${parsed.rationale})`;
                                  }
                                } else if (parsed.item) {
                                  itemText = parsed.item;
                                  if (parsed.reference) {
                                    itemText += ` ${parsed.reference}`;
                                  }
                                } else if (parsed.description) {
                                  itemText = parsed.description;
                                } else {
                                  itemText = parsed.text || parsed.title || parsed.summary || String(parsed);
                                }
                              } else if (section.type === 'calendar') {
                                // For calendar, prioritize title
                                if (parsed.title) {
                                  itemText = parsed.title;
                                  if (parsed.description) {
                                    itemText += ` - ${parsed.description}`;
                                  }
                                } else if (parsed.summary) {
                                  itemText = parsed.summary;
                                } else {
                                  itemText = parsed.task || parsed.item || parsed.description || parsed.text || String(parsed);
                                }
                              } else if (section.type === 'blockers') {
                                // For blockers, prioritize description
                                if (parsed.description) {
                                  itemText = parsed.description;
                                  if (parsed.severity) {
                                    itemText += ` (${parsed.severity} priority)`;
                                  }
                                } else {
                                  itemText = parsed.text || parsed.item || parsed.task || parsed.title || String(parsed);
                                }
                              } else {
                                // Generic extraction
                                if (parsed.task) {
                                  itemText = parsed.task;
                                } else if (parsed.item) {
                                  itemText = parsed.item;
                                  if (parsed.reference) {
                                    itemText += ` ${parsed.reference}`;
                                  }
                                } else if (parsed.description) {
                                  itemText = parsed.description;
                                } else if (parsed.text) {
                                  itemText = parsed.text;
                                } else if (parsed.title) {
                                  itemText = parsed.title;
                                } else if (parsed.summary) {
                                  itemText = parsed.summary;
                                } else {
                                  // Try to extract from nested structures
                                  const extracted = parseContent(parsed);
                                  if (typeof extracted === 'string') {
                                    itemText = extracted;
                                  } else if (Array.isArray(extracted) && extracted.length > 0) {
                                    itemText = extracted.join('\n');
                                  } else {
                                    // Last resort: try to extract any text field
                                    const allValues = Object.values(parsed).filter(v => typeof v === 'string' && v.length > 0);
                                    if (allValues.length > 0) {
                                      itemText = allValues.join(' ');
                                    } else {
                                      // If we can't extract, show a message
                                      itemText = 'Unable to parse item';
                                    }
                                  }
                                }
                              }
                            } catch {
                              // If parsing fails, try to extract text from string based on section type
                              if (section.type === 'tasks') {
                                const taskMatch = itemText.match(/"task"\s*:\s*"([^"]+)"/);
                                const itemMatch = itemText.match(/"item"\s*:\s*"([^"]+)"/);
                                const descMatch = itemText.match(/"description"\s*:\s*"([^"]+)"/);
                                
                                if (taskMatch) {
                                  itemText = taskMatch[1];
                                } else if (itemMatch) {
                                  itemText = itemMatch[1];
                                } else if (descMatch) {
                                  itemText = descMatch[1];
                                }
                              } else if (section.type === 'calendar') {
                                const titleMatch = itemText.match(/"title"\s*:\s*"([^"]+)"/);
                                const summaryMatch = itemText.match(/"summary"\s*:\s*"([^"]+)"/);
                                const taskMatch = itemText.match(/"task"\s*:\s*"([^"]+)"/);
                                
                                if (titleMatch) {
                                  itemText = titleMatch[1];
                                } else if (summaryMatch) {
                                  itemText = summaryMatch[1];
                                } else if (taskMatch) {
                                  itemText = taskMatch[1];
                                }
                              } else if (section.type === 'blockers') {
                                const descMatch = itemText.match(/"description"\s*:\s*"([^"]+)"/);
                                const textMatch = itemText.match(/"text"\s*:\s*"([^"]+)"/);
                                const itemMatch = itemText.match(/"item"\s*:\s*"([^"]+)"/);
                                
                                if (descMatch) {
                                  itemText = descMatch[1];
                                } else if (textMatch) {
                                  itemText = textMatch[1];
                                } else if (itemMatch) {
                                  itemText = itemMatch[1];
                                }
                              } else {
                                // Generic extraction
                                const taskMatch = itemText.match(/"task"\s*:\s*"([^"]+)"/);
                                const itemMatch = itemText.match(/"item"\s*:\s*"([^"]+)"/);
                                const descMatch = itemText.match(/"description"\s*:\s*"([^"]+)"/);
                                const textMatch = itemText.match(/"text"\s*:\s*"([^"]+)"/);
                                
                                if (taskMatch) {
                                  itemText = taskMatch[1];
                                } else if (itemMatch) {
                                  itemText = itemMatch[1];
                                } else if (descMatch) {
                                  itemText = descMatch[1];
                                } else if (textMatch) {
                                  itemText = textMatch[1];
                                }
                              }
                            }
                          }
                        } else if (typeof item === 'object' && item !== null) {
                          // Extract from object
                          itemText = item.task || item.item || item.description || item.text || item.title || item.summary || String(item);
                        } else {
                          itemText = String(item);
                        }
                        
                        const isApproved = calendarApproved[i];
                        const isDeclined = calendarDeclined[i];
                        const isCreating = calendarCreating[i];
                        
                        return (
                          <li 
                            key={i} 
                            className={`flex items-start gap-2 p-2 rounded-lg transition-all ${
                              isApproved ? 'bg-green-50 dark:bg-green-950 border border-green-200' :
                              isDeclined ? 'bg-red-50 dark:bg-red-950 border border-red-200 opacity-60' :
                              'hover:bg-muted'
                            }`}
                          >
                            <Badge variant="secondary" className="mt-0.5 shrink-0">
                              {i + 1}
                            </Badge>
                            <span className="flex-1 text-sm leading-relaxed">{renderText(itemText)}</span>
                            {section.type === 'calendar' && !isApproved && !isDeclined && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveCalendar(itemText, i)}
                                  disabled={isCreating || !isGoogleConnected}
                                  className="h-7 px-2 hover:bg-green-50 hover:border-green-300"
                                >
                                  {isCreating ? (
                                    <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3 text-green-600" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeclineCalendar(i)}
                                  disabled={isCreating || !isGoogleConnected}
                                  className="h-7 px-2 hover:bg-red-50 hover:border-red-300"
                                >
                                  <X className="w-3 h-3 text-red-600" />
                                </Button>
                              </div>
                            )}
                            {section.type === 'calendar' && isApproved && (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {section.type === 'calendar' && isDeclined && (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                                <X className="w-3 h-3 mr-1" />
                                Declined
                              </Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg border">
                      {(() => {
                        let content = section.content;
                        let contentStr = typeof content === 'string' ? content : String(content);
                        
                        // Strip markdown code blocks first
                        if (contentStr.includes('```')) {
                          contentStr = contentStr
                            .replace(/```json\s*/gi, '')
                            .replace(/```\s*/g, '')
                            .replace(/^```/gm, '')
                            .replace(/```$/gm, '')
                            .trim();
                        }
                        
                        // Aggressively parse JSON multiple times if needed
                        let attempts = 0;
                        while ((contentStr.trim().startsWith('{') || contentStr.trim().startsWith('[')) && attempts < 3) {
                          try {
                            const parsed = JSON.parse(contentStr);
                            
                            // Extract text based on structure and section type
                            if (section.type === 'email') {
                              // For email, prioritize body field
                              if (parsed.body) {
                                contentStr = parsed.body;
                              } else if (parsed.email) {
                                contentStr = parsed.email;
                              } else if (parsed.text) {
                                contentStr = parsed.text;
                              } else if (parsed.content) {
                                contentStr = parsed.content;
                              } else if (parsed.message) {
                                contentStr = parsed.message;
                              } else {
                                // Try parseContent
                                const extracted = parseContent(parsed);
                                if (typeof extracted === 'string' && extracted !== contentStr) {
                                  contentStr = extracted;
                                } else if (Array.isArray(extracted) && extracted.length > 0) {
                                  contentStr = extracted.join('\n');
                                } else {
                                  // If we can't extract, break the loop
                                  break;
                                }
                              }
                            } else if (parsed.meetingSummary || parsed.meeting_summary) {
                              const summaryObj = parsed.meetingSummary || parsed.meeting_summary;
                              contentStr = summaryObj.summary || summaryObj.text || String(summaryObj);
                              
                              // Include decisions if present
                              if (summaryObj.decisions_goals_outcomes && Array.isArray(summaryObj.decisions_goals_outcomes)) {
                                const decisions = summaryObj.decisions_goals_outcomes
                                  .map((d: any) => {
                                    const item = d.item || d.text || d.description || String(d);
                                    if (d.reference) {
                                      return `${item} ${d.reference}`;
                                    }
                                    return item;
                                  })
                                  .filter(Boolean)
                                  .join('\n');
                                if (decisions) {
                                  contentStr += '\n\n' + decisions;
                                }
                              }
                            } else if (parsed.summary) {
                              contentStr = parsed.summary;
                            } else if (parsed.text) {
                              contentStr = parsed.text;
                            } else if (parsed.description) {
                              contentStr = parsed.description;
                            } else if (parsed.body) {
                              contentStr = parsed.body;
                            } else {
                              // Try parseContent
                              const extracted = parseContent(parsed);
                              if (typeof extracted === 'string' && extracted !== contentStr) {
                                contentStr = extracted;
                              } else if (Array.isArray(extracted) && extracted.length > 0) {
                                contentStr = extracted.join('\n');
                              } else {
                                // If we can't extract, break the loop
                                break;
                              }
                            }
                            
                            attempts++;
                          } catch {
                            // If parsing fails, break the loop
                            break;
                          }
                        }
                        
                        // Final check: if it still looks like JSON, try regex extraction
                        if (contentStr.trim().startsWith('{') || contentStr.trim().startsWith('[')) {
                          // Try to extract based on section type
                          if (section.type === 'email') {
                            // Multi-line regex to capture body field (handles escaped quotes and newlines)
                            const bodyMatch = contentStr.match(/"body"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
                            const textMatch = contentStr.match(/"text"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
                            const emailMatch = contentStr.match(/"email"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
                            
                            if (bodyMatch && bodyMatch[1]) {
                              contentStr = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
                            } else if (textMatch && textMatch[1]) {
                              contentStr = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
                            } else if (emailMatch && emailMatch[1]) {
                              contentStr = emailMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
                            }
                          } else {
                            const summaryMatch = contentStr.match(/"summary"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
                            const textMatch = contentStr.match(/"text"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
                            const descMatch = contentStr.match(/"description"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
                            const bodyMatch = contentStr.match(/"body"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
                            
                            if (summaryMatch && summaryMatch[1]) {
                              contentStr = summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
                            } else if (textMatch && textMatch[1]) {
                              contentStr = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
                            } else if (descMatch && descMatch[1]) {
                              contentStr = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
                            } else if (bodyMatch && bodyMatch[1]) {
                              contentStr = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
                            }
                          }
                        }
                        
                        return <FormattedText text={contentStr} />;
                      })()}
                    </div>
                    {section.type === 'email' && !emailApproved && !emailDeclined && (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleApproveEmail}
                          disabled={emailSending || !isGoogleConnected}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {emailSending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Approve & Send
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleDeclineEmail}
                          disabled={emailSending || !isGoogleConnected}
                          variant="outline"
                          className="flex-1 hover:bg-red-50 hover:border-red-300"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    )}
                    {section.type === 'email' && emailApproved && (
                      <Badge variant="outline" className="w-full justify-center bg-green-100 text-green-700 border-green-300 py-2">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Email Sent Successfully
                      </Badge>
                    )}
                    {section.type === 'email' && emailDeclined && (
                      <Badge variant="outline" className="w-full justify-center bg-red-100 text-red-700 border-red-300 py-2">
                        <X className="w-4 h-4 mr-2" />
                        Email Declined
                      </Badge>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
