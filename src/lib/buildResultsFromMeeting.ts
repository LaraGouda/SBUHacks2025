import { parseAnalysisResults, type AnalysisResults } from "@/lib/parseAnalysisResults";

export interface MeetingTask {
  id: string;
  description: string;
  completed: boolean;
  priority?: string | null;
}

export interface MeetingEmailDraft {
  id: string;
  subject: string | null;
  body: string;
  recipient: string | null;
  status: string | null;
}

export interface MeetingCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  timezone: string | null;
  status: string | null;
}

export interface MeetingBlocker {
  id: string;
  description: string;
  severity: string | null;
  resolved: boolean;
}

export interface MeetingWithRelations {
  id: string;
  title: string;
  transcript: string;
  summary: string | null;
  status: "pending" | "analyzing" | "analyzed" | "failed" | "resolved";
  created_at: string;
  raw_analysis?: unknown;
  tasks: MeetingTask[];
  email_drafts: MeetingEmailDraft[];
  calendar_events: MeetingCalendarEvent[];
  blockers: MeetingBlocker[];
}

export const buildResultsFromMeeting = (
  meeting: MeetingWithRelations,
  overrides?: AnalysisResults
): AnalysisResults => {
  const rawOverrides = meeting.raw_analysis ? parseAnalysisResults(meeting.raw_analysis) : undefined;
  const effectiveOverrides: AnalysisResults | undefined = (() => {
    if (!rawOverrides && !overrides) return undefined;
    const merged = rawOverrides ? { ...rawOverrides } : (overrides ? { ...overrides } : undefined);
    if (!merged) return undefined;
    if (overrides) {
      if (overrides.summary?.bullets?.length || overrides.summary?.text) {
        merged.summary = overrides.summary;
      }
      if (overrides.nextTasks?.length) {
        merged.nextTasks = overrides.nextTasks;
      }
      if (overrides.email?.length) {
        merged.email = overrides.email;
      }
      if (overrides.calendar?.length) {
        merged.calendar = overrides.calendar;
      }
      if (overrides.blockers?.length) {
        merged.blockers = overrides.blockers;
      }
    }
    return merged;
  })();
  const parsedSummary = parseAnalysisResults({ summary: meeting.summary }).summary;
  const parsedEmails = parseAnalysisResults({
    email: meeting.email_drafts?.map(draft => draft.body) || [],
  }).email;
  const parsedBlockers = parseAnalysisResults({
    blockers: meeting.blockers?.map(blocker => blocker.description) || [],
  }).blockers;

  const parsedTasks = parseAnalysisResults({
    nextTasks: meeting.tasks?.map(task => task.description) || [],
  }).nextTasks;

  const calendarRows = meeting.calendar_events || [];
  const looksLikeCalendarJsonFragment = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return (
      trimmed.startsWith("{") ||
      trimmed.startsWith("}") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith("\"") ||
      /"(title|description|start|end|timezone|attendees|status|suggestedEvents|events|missing_info|references)"\s*:/.test(trimmed)
    );
  };
  const hasCalendarFragments = calendarRows.some(row =>
    looksLikeCalendarJsonFragment(row.title || "") ||
    looksLikeCalendarJsonFragment(row.description || "")
  );
  const parsedCalendar = hasCalendarFragments
    ? parseAnalysisResults({
        calendar: calendarRows
          .map(row => [row.title, row.description].filter(Boolean).join("\n"))
          .join("\n"),
      }).calendar
    : parseAnalysisResults({ calendar: calendarRows }).calendar;

  const summary = effectiveOverrides?.summary || parsedSummary;
  const baseTasks = effectiveOverrides?.nextTasks?.length ? effectiveOverrides.nextTasks : parsedTasks;
  const baseEmails = effectiveOverrides?.email?.length ? effectiveOverrides.email : parsedEmails;
  const baseCalendar = effectiveOverrides?.calendar?.length ? effectiveOverrides.calendar : parsedCalendar;
  const baseBlockers = effectiveOverrides?.blockers?.length ? effectiveOverrides.blockers : parsedBlockers;

  const normalizeKey = (value: string) => value.trim().toLowerCase();
  const taskDetailsByKey = new Map(
    baseTasks
      .filter(task => task.task && task.task.trim())
      .map(task => [normalizeKey(task.task), task])
  );
  const emailDetailsByKey = new Map(
    baseEmails
      .filter(email => email.subject || email.body)
      .map(email => [normalizeKey(email.subject || email.body), email])
  );
  const blockerDetailsByKey = new Map(
    baseBlockers
      .filter(blocker => blocker.description && blocker.description.trim())
      .map(blocker => [normalizeKey(blocker.description), blocker])
  );
  const calendarDetailsByKey = new Map(
    baseCalendar
      .filter(event => event.title && event.title.trim())
      .map(event => [normalizeKey(event.title), event])
  );

  return {
    summary,
    nextTasks: (meeting.tasks || []).map(taskRow => {
      const details = taskDetailsByKey.get(normalizeKey(taskRow.description));
      return {
        ...details,
        id: taskRow.id,
        task: taskRow.description,
        completed: taskRow.completed,
        priority: details?.priority || taskRow.priority || undefined,
      };
    }).filter(task => task.task && task.task.trim()),
    email: (meeting.email_drafts || []).map(draft => {
      const key = normalizeKey(draft.subject || draft.body);
      const details = emailDetailsByKey.get(key);
      return {
        ...details,
        id: draft.id,
        subject: details?.subject || draft.subject || "Meeting Follow-up",
        body: details?.body || draft.body,
        recipients: details?.recipients && details.recipients.length > 0
          ? details.recipients
          : draft.recipient
            ? [draft.recipient]
            : [],
        reason: details?.reason,
        references: details?.references,
      };
    }),
    calendar: (meeting.calendar_events || []).map(eventRow => {
      const details = calendarDetailsByKey.get(normalizeKey(eventRow.title));
      return {
        ...details,
        title: eventRow.title,
        description: details?.description || eventRow.description || undefined,
        startTime: details?.startTime || eventRow.start_time,
        endTime: details?.endTime || eventRow.end_time,
        timezone: details?.timezone || eventRow.timezone || undefined,
        status: details?.status || eventRow.status || undefined,
        attendees: details?.attendees,
        references: details?.references,
        missingInfo: details?.missingInfo,
      };
    }).filter(event => event.title && event.title.trim()),
    blockers: (meeting.blockers || []).map(blockerRow => {
      const details = blockerDetailsByKey.get(normalizeKey(blockerRow.description));
      return {
        ...details,
        description: blockerRow.description,
        severity: details?.severity || blockerRow.severity || undefined,
        id: blockerRow.id,
        resolved: blockerRow.resolved,
      };
    }).filter(blocker => blocker.description && blocker.description.trim()),
  };
};
