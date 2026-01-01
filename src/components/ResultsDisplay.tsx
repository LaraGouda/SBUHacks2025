import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  CheckSquare, 
  Mail, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  Check,
  Link as LinkIcon,
  X,
  Send,
  Plus,
  Sparkles
} from "lucide-react";
import { useGoogleAuth } from "@/contexts/GoogleAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { parseAnalysisResults, type TaskItem, type BlockerItem, type CalendarEvent, type EmailData, type SummaryData, type AnalysisResults } from "@/lib/parseAnalysisResults";

interface ResultsDisplayProps {
  results: AnalysisResults | {
    summary?: any;
    nextTasks?: any;
    email?: any;
    calendar?: any;
    blockers?: any;
  };
  onTaskToggle?: (taskId: string, nextValue: boolean) => void;
  onTaskDecline?: (taskId: string) => Promise<void> | void;
  onBlockerResolve?: (blockerId: string, nextValue: boolean) => Promise<void> | void;
  onBlockerDecline?: (blockerId: string) => Promise<void> | void;
  onEmailDecline?: (emailId: string) => Promise<void> | void;
  meetingTitle?: string;
  meetingId?: string;
  onMeetingTitleChange?: (nextTitle: string) => Promise<void> | void;
  layout?: "grid" | "stacked";
  showHeader?: boolean;
}

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

type CalendarOverride = {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  attendees?: string;
};

type CalendarMissingField = "title" | "description" | "startTime" | "endTime" | "timezone" | "attendees";

const normalizeMissingField = (value: string): CalendarMissingField | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("title") || normalized.includes("summary") || normalized.includes("subject")) {
    return "title";
  }
  if (normalized.includes("description") || normalized.includes("details") || normalized.includes("agenda")) {
    return "description";
  }
  if (normalized.includes("start") || normalized.includes("date") || normalized.includes("when")) {
    return "startTime";
  }
  if (normalized.includes("end")) {
    return "endTime";
  }
  if (normalized.includes("time zone") || normalized.includes("timezone") || normalized.includes("tz")) {
    return "timezone";
  }
  if (
    normalized.includes("attendee") ||
    normalized.includes("invitee") ||
    normalized.includes("participant") ||
    normalized.includes("guest")
  ) {
    return "attendees";
  }
  return null;
};

const toDateTimeLocalValue = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
};

const getFunctionErrorMessage = async (error: any): Promise<string> => {
  if (!error) return "Failed to create calendar event";
  if (typeof error.message === "string" && error.message.length > 0) {
    if (!("context" in error)) return error.message;
  }
  try {
    const context = error?.context;
    if (context) {
      const payload = await context.json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    }
  } catch {
    // Fall through to generic message.
  }
  return typeof error.message === "string" && error.message.length > 0
    ? error.message
    : "Failed to create calendar event";
};

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

export const ResultsDisplay = ({
  results,
  onTaskToggle,
  onTaskDecline,
  onBlockerResolve,
  onBlockerDecline,
  onEmailDecline,
  meetingTitle,
  meetingId,
  onMeetingTitleChange,
  layout = "grid",
  showHeader = true,
}: ResultsDisplayProps) => {
  const { isGoogleConnected, connectGoogle, disconnectGoogle, accessToken, refreshToken } = useGoogleAuth();
  const { toast } = useToast();
  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOptions = TIMEZONE_OPTIONS.includes(defaultTimezone)
    ? TIMEZONE_OPTIONS
    : [defaultTimezone, ...TIMEZONE_OPTIONS];
  const [emailSending, setEmailSending] = useState<{ [key: number]: boolean }>({});
  const [emailApproved, setEmailApproved] = useState<{ [key: number]: boolean }>({});
  const [emailDeclined, setEmailDeclined] = useState<{ [key: number]: boolean }>({});
  const [emailDeclining, setEmailDeclining] = useState<{ [key: number]: boolean }>({});
  const [calendarCreating, setCalendarCreating] = useState<{ [key: number]: boolean }>({});
  const [calendarApproved, setCalendarApproved] = useState<{ [key: number]: boolean }>({});
  const [calendarDeclined, setCalendarDeclined] = useState<{ [key: number]: boolean }>({});
  const [calendarOverrides, setCalendarOverrides] = useState<{ [key: number]: CalendarOverride }>({});
  const [taskCompleted, setTaskCompleted] = useState<{ [key: string]: boolean }>({});
  const [taskDeclined, setTaskDeclined] = useState<{ [key: string]: boolean }>({});
  const [taskDeclining, setTaskDeclining] = useState<{ [key: string]: boolean }>({});
  const [blockerResolved, setBlockerResolved] = useState<{ [key: number]: boolean }>({});
  const [blockerDeclined, setBlockerDeclined] = useState<{ [key: number]: boolean }>({});
  const [blockerDeclining, setBlockerDeclining] = useState<{ [key: number]: boolean }>({});
  const getPriorityClasses = (priority?: string) => {
    if (!priority) {
      return "border-muted-foreground/30 text-muted-foreground";
    }
    switch (priority.toLowerCase()) {
      case "urgent":
      case "critical":
        return "border-red-900 bg-red-900 text-white";
      case "high":
        return "border-red-800 bg-red-700 text-white";
      case "normal":
      case "medium":
        return "border-red-700 bg-red-600 text-white";
      case "low":
        return "border-red-300 bg-red-200 text-red-900";
      default:
        return "border-muted-foreground/30 text-muted-foreground";
    }
  };
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(meetingTitle || "");
    }
  }, [meetingTitle, isEditingTitle]);

  // Use the centralized helper function to parse analysis results
  // This ensures consistent parsing across the app
  const parsedResults = (() => {
    const candidate = results as AnalysisResults;
    const isParsed = Boolean(
      candidate &&
      typeof candidate === 'object' &&
      candidate.summary &&
      typeof candidate.summary === 'object' &&
      'text' in candidate.summary &&
      'bullets' in candidate.summary &&
      Array.isArray(candidate.nextTasks) &&
      Array.isArray(candidate.email) &&
      Array.isArray(candidate.calendar) &&
      Array.isArray(candidate.blockers)
    );
    return isParsed ? candidate : parseAnalysisResults(results);
  })();

  const getMissingInfoList = (event: CalendarEvent): string[] => {
    if (Array.isArray(event.missingInfo)) return event.missingInfo;
    if (event.missingInfo) return [String(event.missingInfo)];
    return [];
  };

  const getMissingCalendarFields = (event: CalendarEvent): Set<CalendarMissingField> => {
    const missing = new Set<CalendarMissingField>();
    const missingInfo = getMissingInfoList(event);
    if (!event.title || !event.title.trim()) missing.add("title");
    missing.add("startTime");
    missing.add("endTime");
    if (!event.timezone) missing.add("timezone");
    missingInfo.forEach((item) => {
      const mapped = normalizeMissingField(item);
      if (mapped) missing.add(mapped);
    });
    return missing;
  };

  const updateCalendarOverride = (index: number, next: Partial<CalendarOverride>) => {
    setCalendarOverrides(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        ...next,
      },
    }));
  };

  const handleApproveEmail = async (emailData: EmailData, index: number) => {
    if (!isGoogleConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect your Google account first.",
        variant: "destructive",
      });
      return;
    }

    setEmailSending(prev => ({ ...prev, [index]: true }));
    
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
      const emailBody = emailData.body || '';
      const emailSubject = emailData.subject || 'Meeting Follow-up';
      const recipients = emailData.recipients || [];
      const validRecipients = recipients.filter(isValidEmail);
      const toHeader = validRecipients.join(', ');
      const shouldCreateDraft = validRecipients.length > 0;

      console.log('Sending email with:', { recipients, subject: emailSubject, bodyLength: emailBody.length });

      if (shouldCreateDraft) {
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
            // include only valid recipients to avoid Gmail draft errors
            to: toHeader,
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
      }

      // Success - open Gmail compose in a new tab with the same params
      try {
        const mailParams = new URLSearchParams();
        mailParams.set('view', 'cm');
        mailParams.set('fs', '1');
        if (toHeader) {
          mailParams.set('to', toHeader);
        }
        mailParams.set('su', emailSubject);
        mailParams.set('body', emailBody);

        const composeUrl = `https://mail.google.com/mail/?${mailParams.toString()}`;
        window.open(composeUrl, '_blank');
      } catch (err) {
        console.warn('Unable to open compose tab:', err);
      }

      if (shouldCreateDraft) {
        setEmailApproved(prev => ({ ...prev, [index]: true }));
        toast({
          title: "Draft Saved",
          description: "Email draft has been saved to your Gmail drafts folder!",
        });
      } else {
        toast({
          title: "Draft Opened",
          description: "No valid recipient found, so the Gmail draft opened without a To address.",
        });
      }
    } catch (error: any) {
      console.error('Error saving email draft:', error);

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
      setEmailSending(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleDeclineEmail = async (index: number, emailId?: string) => {
    if (emailId && onEmailDecline) {
      try {
        await onEmailDecline(emailId);
      } catch (error: any) {
        toast({
          title: "Failed to remove email",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    setEmailDeclining(prev => ({ ...prev, [index]: true }));
    window.setTimeout(() => {
      setEmailDeclined(prev => ({ ...prev, [index]: true }));
    }, 260);
    toast({
      title: "Email Declined",
      description: "Email draft has been declined.",
    });
  };

  const handleDeclineTask = async (taskKey: string, taskId?: string) => {
    if (taskId && onTaskDecline) {
      try {
        await onTaskDecline(taskId);
      } catch (error: any) {
        toast({
          title: "Failed to remove task",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    setTaskDeclining(prev => ({ ...prev, [taskKey]: true }));
    window.setTimeout(() => {
      setTaskDeclined(prev => ({ ...prev, [taskKey]: true }));
    }, 260);
    toast({
      title: "Task Declined",
      description: "Task has been declined.",
    });
  };

  const handleResolveBlocker = async (index: number, blockerId?: string) => {
    if (blockerId && onBlockerResolve) {
      try {
        await onBlockerResolve(blockerId, true);
      } catch (error: any) {
        toast({
          title: "Failed to resolve blocker",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    setBlockerResolved(prev => ({ ...prev, [index]: true }));
    toast({
      title: "Blocker Resolved",
      description: "Blocker has been marked as resolved.",
    });
  };

  const handleDeclineBlocker = async (index: number, blockerId?: string) => {
    if (blockerId && onBlockerDecline) {
      try {
        await onBlockerDecline(blockerId);
      } catch (error: any) {
        toast({
          title: "Failed to remove blocker",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    setBlockerDeclining(prev => ({ ...prev, [index]: true }));
    window.setTimeout(() => {
      setBlockerDeclined(prev => ({ ...prev, [index]: true }));
    }, 260);
    toast({
      title: "Blocker Declined",
      description: "Blocker has been declined.",
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

    const overrides = calendarOverrides[index] || {};
    const missingFields = getMissingCalendarFields(event);
    const title = (overrides.title ?? event.title ?? "").trim();
    const description = (overrides.description ?? event.description ?? "Created from meeting analysis").trim();
    const startInput = overrides.startTime;
    const endInput = overrides.endTime;
    const timezone = (overrides.timezone ?? event.timezone ?? defaultTimezone ?? "").trim();
    const attendeesInput = overrides.attendees?.trim();
    const attendees = attendeesInput
      ? attendeesInput.split(",").map(value => value.trim()).filter(Boolean)
      : event.attendees;
    const startDate = startInput ? new Date(startInput) : null;
    const endDate = endInput ? new Date(endInput) : null;
    const missingDetails: string[] = [];

    if (missingFields.has("title") && !title) missingDetails.push("title");
    if (missingFields.has("description") && !description) missingDetails.push("description");
    if (missingFields.has("startTime") && (!startInput || Number.isNaN(startDate?.getTime() ?? NaN))) {
      missingDetails.push("start time");
    }
    if (missingFields.has("endTime") && (!endInput || Number.isNaN(endDate?.getTime() ?? NaN))) {
      missingDetails.push("end time");
    }
    if (missingFields.has("timezone") && !timezone) missingDetails.push("timezone");
    if (missingFields.has("attendees") && (!attendees || attendees.length === 0)) missingDetails.push("attendees");

    if (missingDetails.length > 0) {
      toast({
        title: "Missing Details",
        description: `Please add ${missingDetails.join(", ")} before creating the event.`,
        variant: "destructive",
      });
      return;
    }

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
      const safeTitle = title || 'Meeting Follow-up';
      const safeDescription = description || 'Created from meeting analysis';

      // Parse start and end times, default to tomorrow if not specified
      let startTime: Date;
      let endTime: Date;
      
      if (startInput && !Number.isNaN(new Date(startInput).getTime())) {
        startTime = new Date(startInput);
      } else {
        startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      }
      
      if (endInput && !Number.isNaN(new Date(endInput).getTime())) {
        endTime = new Date(endInput);
      } else {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
      }
      if (endTime <= startTime) {
        throw new Error("End time must be after the start time.");
      }

      const { data, error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          accessToken: tokenToUse,
          summary: safeTitle,
          description: safeDescription,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          timezone: timezone || undefined,
          attendees: attendees && attendees.length > 0 ? attendees : undefined,
        }
      });

      if (error) {
        const message = await getFunctionErrorMessage(error);
        throw new Error(message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setCalendarApproved(prev => ({ ...prev, [index]: true }));
      toast({
        title: "Event Created",
        description: "Calendar event has been created successfully!",
      });
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      setCalendarApproved(prev => ({ ...prev, [index]: false }));
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
      setCalendarCreating(prev => ({ ...prev, [index]: false }));
    }
  };

  const beginTitleEdit = () => {
    if (!meetingTitle) return;
    setTitleDraft(meetingTitle);
    setIsEditingTitle(true);
  };

  const cancelTitleEdit = () => {
    setIsEditingTitle(false);
    setTitleDraft(meetingTitle || "");
  };

  const commitTitleEdit = async () => {
    if (!meetingTitle || !meetingId || !onMeetingTitleChange) {
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
      await onMeetingTitleChange(trimmed);
      setIsEditingTitle(false);
    } catch (error: any) {
      console.error("Error updating meeting title:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update meeting title.",
        variant: "destructive",
      });
    }
  };

  const priorityRank = (value?: string | null) => {
    if (!value) return 0;
    const normalized = value.toLowerCase();
    if (normalized === "urgent" || normalized === "high") return 3;
    if (normalized === "medium" || normalized === "normal") return 2;
    if (normalized === "low") return 1;
    return 0;
  };

  const blockerRank = (value?: string | null) => {
    if (!value) return 0;
    const normalized = value.toLowerCase();
    if (normalized === "critical" || normalized === "high") return 3;
    if (normalized === "medium") return 2;
    if (normalized === "low") return 1;
    return 0;
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
      description: "Key points with action items",
      icon: FileText,
      content: parsedResults.summary,
      color: "text-primary",
      type: "summary",
    },
    {
      title: "Follow-up Emails",
      description: "Ready-to-send drafts",
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

  const topRowSections = sections.filter(section =>
    section.type === 'summary' || section.type === 'email' || section.type === 'tasks'
  );

  const bottomRowSections = sections.filter(section =>
    section.type === 'calendar' || section.type === 'blockers'
  );

  const isStacked = layout === "stacked";

  return (
    <div className={`w-full ${isStacked ? "max-w-none mx-0" : "max-w-6xl mx-auto"} space-y-6`}>
      {showHeader && (
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
          {meetingTitle && (
            <div className="mt-5 flex flex-col items-center gap-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
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
                    className="min-w-[280px] bg-transparent border-b-2 border-border text-lg font-semibold focus:outline-none focus:border-primary text-center"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={commitTitleEdit}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <Check className="w-5 h-5 text-green-600" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelTitleEdit}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Meeting Title:
                  </span>
                  <button
                    type="button"
                    onClick={beginTitleEdit}
                    className="text-2xl font-semibold bg-gradient-primary bg-clip-text text-transparent hover:opacity-90"
                  >
                    {meetingTitle}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={isStacked ? "grid gap-6" : "grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto"}>
        {topRowSections.map((section, index) => {
          const Icon = section.icon;
          const isArray = Array.isArray(section.content);
          const hasContent = section.type === 'summary'
            ? Boolean((section.content as SummaryData)?.text || (section.content as SummaryData)?.bullets?.length)
            : isArray
              ? section.content.length > 0
              : section.content;
          
          return (
            <Card 
              key={section.type} 
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
                ) : section.type === 'summary' ? (
                  <div className="space-y-4">
                    <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg border">
                      <FormattedText text={(section.content as SummaryData).text} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Action Items</p>
                      {(section.content as SummaryData).bullets.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No action items available</p>
                      ) : (
                        <ul className="space-y-2">
                          {(section.content as SummaryData).bullets.map((bullet, i) => {
                            const match = bullet.match(/^(Action item|Plan):\s*/i);
                            const prefix = match ? match[0] : '';
                            const rest = match ? bullet.slice(prefix.length) : bullet;

                            return (
                              <li key={i} className="text-sm text-muted-foreground">
                                • {prefix && <span className="font-semibold text-foreground">{prefix}</span>}
                                {rest}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : section.type === 'tasks' ? (
                  // Tasks Card - Display task, rationale, and priority
                  <ul className="space-y-3">
                    {[...(section.content as TaskItem[])]
                      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
                      .map((task, i) => {
                      const taskKey = task.id ?? `idx-${i}`;
                      const isCompleted = typeof task.completed === 'boolean' ? task.completed : Boolean(taskCompleted[taskKey]);
                      const isDeclined = Boolean(taskDeclined[taskKey]);
                      const isDeclining = Boolean(taskDeclining[taskKey]);

                      if (isDeclined) {
                        return null;
                      }

                      return (
                        <li
                          key={taskKey}
                          className={`p-3 rounded-lg border transition-all duration-300 ease-in-out overflow-hidden max-h-[400px] ${
                            isDeclining ? 'opacity-0 scale-[0.98] max-h-0 py-0' :
                            isCompleted ? 'bg-green-50 border-green-200' :
                            'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-primary"
                              checked={isCompleted}
                              onChange={() => {
                              if (isDeclining) {
                                return;
                              }
                              const nextValue = !isCompleted;
                              if (task.id && onTaskToggle) {
                                onTaskToggle(task.id, nextValue);
                                return;
                              }
                              setTaskCompleted(prev => ({ ...prev, [taskKey]: !prev[taskKey] }));
                            }}
                            disabled={isDeclining}
                          />
                          <div className="flex-1 space-y-1">
                            <p className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                              {task.task}
                            </p>
                            {task.owner && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Owner:</span> {task.owner}
                              </p>
                            )}
                            {task.rationale && (
                              <p className="text-xs text-muted-foreground italic">
                                <span className="font-semibold">Rationale:</span> {task.rationale}
                              </p>
                            )}
                            {task.priority && (
                              <Badge variant="outline" className={`text-xs ${getPriorityClasses(task.priority)}`}>
                                {task.priority} priority
                              </Badge>
                            )}
                            {task.references && task.references.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Refs:</span> {task.references.join(', ')}
                              </p>
                            )}
                          </div>
                          {!isCompleted && !isDeclining && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeclineTask(taskKey, task.id)}
                              className="h-7 px-2 hover:bg-red-50 hover:border-red-300"
                            >
                              <X className="w-3 h-3 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                ) : section.type === 'email' ? (
                  // Email Card - Display reason, recipients, subject, body, and references
                  <div className="space-y-4">
                    {(section.content as EmailData[]).map((email, i) => {
                      const isSending = emailSending[i];
                      const isApproved = emailApproved[i];
                      const isDeclined = emailDeclined[i];
                      const isDeclining = emailDeclining[i];

                      if (isDeclined) {
                        return null;
                      }

                      return (
                        <div
                          key={i}
                          className={`space-y-3 border rounded-lg p-3 bg-muted/30 transition-all duration-300 ease-in-out overflow-hidden max-h-[800px] ${
                            isDeclining ? 'opacity-0 scale-[0.98] max-h-0 py-0' : ''
                          }`}
                        >
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
                            <div className="mt-2 p-3 rounded-lg border bg-muted/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">References:</p>
                              <ul className="space-y-2 text-xs">
                                {email.references.map((ref, idx) => (
                                  <li key={idx} className="border-l-2 border-muted-foreground pl-2 italic">
                                    {ref}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {!isApproved && !isDeclining && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                onClick={() => handleApproveEmail(email, i)}
                                disabled={isSending || !isGoogleConnected}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              >
                                {isSending ? (
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
                                onClick={() => handleDeclineEmail(i, email.id)}
                                disabled={isSending}
                                variant="outline"
                                className="flex-1 hover:bg-red-50 hover:border-red-300"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Decline
                              </Button>
                            </div>
                          )}
                          {isApproved && (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 mt-2">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Draft Saved
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : isArray ? (
                  // Fallback for other array types
                  <>
                    <ul className="space-y-2">
                      {(section.content as string[]).map((item, i) => {
                        // Aggressively extract text from JSON
                        let itemText = '';
                        const eventData = typeof item === 'object' && item !== null ? (item as CalendarEvent) : null;
                        
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
                            {section.type === 'calendar' && eventData && !isApproved && !isDeclined && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveCalendar(eventData, i)}
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
                          onClick={() => handleDeclineEmail(0)}
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

      <div className={isStacked ? "grid gap-6" : "grid gap-6 md:grid-cols-2 max-w-4xl mx-auto"}>
        {bottomRowSections.map((section, index) => {
          const Icon = section.icon;
          const isArray = Array.isArray(section.content);
          const hasContent = isArray ? section.content.length > 0 : section.content;

          return (
            <Card
              key={section.type}
              className="shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-fade-in"
              style={{ animationDelay: `${(index + topRowSections.length) * 100}ms` }}
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
                ) : section.type === 'blockers' ? (
                  <ul className="space-y-3">
                    {[...(section.content as BlockerItem[])]
                      .sort((a, b) => blockerRank(b.severity) - blockerRank(a.severity))
                      .map((blocker, i) => {
                      const isResolved = Boolean(blocker.resolved) || Boolean(blockerResolved[i]);
                      const isDeclined = Boolean(blockerDeclined[i]);
                      const isDeclining = Boolean(blockerDeclining[i]);

                      if (isDeclined) {
                        return null;
                      }

                      return (
                        <li
                          key={i}
                          className={`p-3 rounded-lg border transition-all duration-300 ease-in-out overflow-hidden max-h-[800px] ${
                            isDeclining ? 'opacity-0 scale-[0.98] max-h-0 py-0' :
                            isResolved ? 'bg-green-50 border-green-200' :
                            'border-destructive/20 bg-destructive/5 hover:bg-destructive/10'
                          }`}
                        >
                        <div className="flex items-start gap-2">
                          <Badge variant="destructive" className="mt-0.5 shrink-0">
                            {i + 1}
                          </Badge>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {blocker.type && (
                                <Badge variant="outline" className="text-xs">
                                  {blocker.type}
                                </Badge>
                              )}
                              {blocker.severity && (
                                <Badge variant="outline" className={`text-xs ${getPriorityClasses(blocker.severity)}`}>
                                  {blocker.severity} severity
                                </Badge>
                              )}
                            </div>
                            {blocker.title && (
                              <p className="text-sm font-semibold">{blocker.title}</p>
                            )}
                            <p className="text-sm font-medium">{blocker.description}</p>
                            {blocker.quote && (
                              <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground pl-2">
                                "{blocker.quote}"
                              </p>
                            )}
                            {blocker.evidenceQuotes && blocker.evidenceQuotes.length > 0 && (
                              <div className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground pl-2 space-y-1">
                                {blocker.evidenceQuotes.map((quote, idx) => (
                                  <p key={idx}>"{quote}"</p>
                                ))}
                              </div>
                            )}
                            {blocker.timestamp && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Time:</span> {blocker.timestamp}
                              </p>
                            )}
                            {blocker.impact && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Impact:</span> {blocker.impact}
                              </p>
                            )}
                            {blocker.references && blocker.references.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Refs:</span> {blocker.references.join(', ')}
                              </p>
                            )}
                            {blocker.missingInfo && blocker.missingInfo.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Missing:</span> {blocker.missingInfo.join(', ')}
                              </p>
                            )}
                          </div>
                          {!isResolved && !isDeclining && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolveBlocker(i, blocker.id)}
                                className="h-7 px-2 hover:bg-green-50 hover:border-green-300"
                              >
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeclineBlocker(i, blocker.id)}
                                className="h-7 px-2 hover:bg-red-50 hover:border-red-300"
                              >
                                <X className="w-3 h-3 text-red-600" />
                              </Button>
                            </div>
                          )}
                          {isResolved && (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                ) : section.type === 'calendar' ? (
                  <ul className="space-y-3">
                    {(section.content as CalendarEvent[]).map((event, i) => {
                      const isApproved = calendarApproved[i];
                      const isDeclined = calendarDeclined[i];
                      const isCreating = calendarCreating[i];
                      const missingFields = getMissingCalendarFields(event);
                      const needsResolve = missingFields.size > 0;
                      const showStatus = Boolean(event.status && !event.status.toLowerCase().includes('pending'));
                      const overrides = calendarOverrides[i] || {};
                      const missingInfoList = getMissingInfoList(event);
                      const displayStartTime = overrides.startTime;
                      const displayEndTime = overrides.endTime;
                      
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
                                {displayStartTime && (
                                  <span>
                                    <span className="font-semibold">Start:</span> {new Date(displayStartTime).toLocaleString()}
                                  </span>
                                )}
                                {displayEndTime && (
                                  <span>
                                    <span className="font-semibold">End:</span> {new Date(displayEndTime).toLocaleString()}
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
                              {event.references && event.references.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-semibold">Refs:</span> {event.references.join(', ')}
                                </div>
                              )}
                              {missingInfoList.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-semibold">Missing:</span> {missingInfoList.join(', ')}
                                </div>
                              )}
                              {missingFields.size > 0 && !isApproved && !isDeclined && (
                                <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 bg-background/70 p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Missing details
                                  </p>
                                  {missingFields.has("title") && (
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-muted-foreground">Title</label>
                                      <Input
                                        value={overrides.title ?? event.title ?? ""}
                                        onChange={(e) => updateCalendarOverride(i, { title: e.target.value })}
                                        placeholder="Event title"
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  )}
                                  {missingFields.has("description") && (
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                                      <Textarea
                                        value={overrides.description ?? event.description ?? ""}
                                        onChange={(e) => updateCalendarOverride(i, { description: e.target.value })}
                                        placeholder="Optional details or agenda"
                                        className="min-h-[60px] text-xs"
                                      />
                                    </div>
                                  )}
                                  {missingFields.has("startTime") && (
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-muted-foreground">Start</label>
                                      <Input
                                        type="datetime-local"
                                        value={overrides.startTime ?? ""}
                                        onChange={(e) => updateCalendarOverride(i, { startTime: e.target.value })}
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  )}
                                  {missingFields.has("endTime") && (
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
                                                  updateCalendarOverride(i, { endTime: toDateTimeLocalValue(next.toISOString()) });
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
                                        onChange={(e) => updateCalendarOverride(i, { endTime: e.target.value })}
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  )}
                                  {missingFields.has("timezone") && (
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-muted-foreground">Timezone</label>
                                      <div className="relative">
                                        <select
                                          value={overrides.timezone ?? event.timezone ?? defaultTimezone}
                                          onChange={(e) => updateCalendarOverride(i, { timezone: e.target.value })}
                                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                          {timezoneOptions.map((tz) => (
                                            <option key={tz} value={tz}>
                                              {tz}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                  {missingFields.has("attendees") && (
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-medium text-muted-foreground">Attendees</label>
                                      <Input
                                        value={overrides.attendees ?? (event.attendees ? event.attendees.join(", ") : "")}
                                        onChange={(e) => updateCalendarOverride(i, { attendees: e.target.value })}
                                        placeholder="name@example.com, other@example.com"
                                        className="h-8 text-xs"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                              {showStatus && (
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
                                    <span className="flex items-center gap-1 text-xs text-green-700">
                                      <CheckCircle className="w-3 h-3 text-green-600" />
                                      {needsResolve ? 'Resolve' : 'Add'}
                                    </span>
                                  )}
                                </Button>
                                {!needsResolve && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeclineCalendar(i)}
                                    disabled={isCreating || !isGoogleConnected}
                                    className="h-7 px-2 hover:bg-red-50 hover:border-red-300"
                                  >
                                    <X className="w-3 h-3 text-red-600" />
                                  </Button>
                                )}
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
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
