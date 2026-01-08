import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface AnalysisResult {
  summary: string;
  nextTasks: Array<{
    description: string;
    owner?: string | null;
    rationale?: string | null;
    priority?: string | null;
    references?: string[];
  }>;
  email: { subject: string; body: string };
  calendar: Array<{ title: string; description: string; start_time: string; end_time: string }>;
  blockers: Array<{ description: string; severity: string }>;
}

const stripMarkdown = (value: string): string => {
  return value
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^```/gm, '')
    .replace(/```$/gm, '')
    .trim();
};

const unescapeJsonString = (value: string): string => {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\t/g, '\t');
};

const normalizeJson = (value: string): string => {
  return value.replace(/,\s*([}\]])/g, '$1');
};

const extractJsonSubstring = (value: string): string | null => {
  const match = value.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : null;
};

const tryParseJson = (value: unknown): any | null => {
  if (value && typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = stripMarkdown(value);
  const unquoted = (() => {
    const candidate = trimmed.trim();
    if ((candidate.startsWith('"') && candidate.endsWith('"')) ||
        (candidate.startsWith("'") && candidate.endsWith("'"))) {
      try {
        const parsed = JSON.parse(candidate);
        return typeof parsed === 'string' ? parsed : candidate;
      } catch {
        return candidate;
      }
    }
    return candidate;
  })();
  const normalizedInput = typeof unquoted === 'string' ? unquoted : trimmed;
  const candidate = normalizedInput.startsWith('{') || normalizedInput.startsWith('[')
    ? normalizedInput
    : extractJsonSubstring(normalizedInput);

  if (!candidate) {
    return null;
  }

  try {
    return JSON.parse(normalizeJson(candidate));
  } catch {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'string') {
        return tryParseJson(parsed);
      }
    } catch {
      return null;
    }
  }
  return null;
};

const looksLikeJsonFragment = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed === '{' || trimmed === '}' || trimmed === '[' || trimmed === ']') return true;
  if (/^[\],}]+$/.test(trimmed)) return true;
  if (/^"[^"]+"\s*:/.test(trimmed)) return true;
  return false;
};

const splitLines = (value: string): string[] => {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !looksLikeJsonFragment(line));
};

const pickString = (value: any, keys: string[]): string | null => {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) {
    const direct = value[key];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    if (direct && typeof direct === 'object') {
      const nested = direct.title || direct.text || direct.summary || direct.description || direct.value;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  const nestedContainers = [value.event, value.details, value.data];
  for (const container of nestedContainers) {
    if (!container || typeof container !== 'object') continue;
    const nested = pickString(container, keys);
    if (nested) return nested;
  }
  return null;
};

const coerceDateTime = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'object') {
    const candidate = value.dateTime || value.datetime || value.date || value.value;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
};

const extractSummaryTextFromString = (value: string): string | null => {
  const matchNested = value.match(/"summary"\s*:\s*\{\s*[^}]*"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  const matchFlat = value.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  const candidate = matchNested?.[1] || matchFlat?.[1];
  if (!candidate) return null;
  return unescapeJsonString(candidate).trim();
};

const extractQuotedArray = (value: string): string[] => {
  return Array.from(value.matchAll(/"((?:[^"\\]|\\.)*)"/g))
    .map(match => unescapeJsonString(match[1]).trim())
    .filter(Boolean);
};

const extractBalancedBlock = (value: string, key: string, opener: '{' | '[', closer: '}' | ']'): string | null => {
  const keyIndex = value.search(new RegExp(`"${key}"\\s*:`, 'i'));
  if (keyIndex < 0) return null;
  const startIndex = value.indexOf(opener, keyIndex);
  if (startIndex < 0) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let i = startIndex; i < value.length; i++) {
    const char = value[i];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === '\\') {
      if (inString) escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) {
      return value.slice(startIndex + 1, i);
    }
  }
  return null;
};

const extractArrayBlock = (value: string, key: string): string | null => {
  return extractBalancedBlock(value, key, '[', ']');
};

const extractObjectBlock = (value: string, key: string): string | null => {
  return extractBalancedBlock(value, key, '{', '}');
};

const extractField = (value: string, key: string): string | null => {
  const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
  const match = value.match(regex);
  return match ? unescapeJsonString(match[1]).trim() : null;
};

const extractSummaryBulletsFromString = (value: string): string[] => {
  const block = extractArrayBlock(value, 'bullets');
  if (!block) return [];
  return extractQuotedArray(block);
};

const extractEmailsFromString = (value: string): Array<{
  SubjectLine?: string;
  Body?: string;
  Reason?: string;
  Recipients?: string[];
  References?: string[];
}> => {
  const block = extractArrayBlock(value, 'allEmails');
  if (!block) return [];
  const objects = block.match(/\{[\s\S]*?\}(?=\s*,\s*\{|\s*$)/g) || [];
  return objects.map(item => {
    const SubjectLine = extractField(item, 'SubjectLine') || extractField(item, 'subject') || extractField(item, 'Subject');
    const Body = extractField(item, 'Body') || extractField(item, 'body') || extractField(item, 'text') || extractField(item, 'content');
    const Reason = extractField(item, 'Reason') || extractField(item, 'reason');
    const recipientsBlock = extractArrayBlock(item, 'Recipients') || extractArrayBlock(item, 'recipients');
    const referencesBlock = extractArrayBlock(item, 'References') || extractArrayBlock(item, 'references');
    return {
      SubjectLine: SubjectLine || undefined,
      Body: Body || undefined,
      Reason: Reason || undefined,
      Recipients: recipientsBlock ? extractQuotedArray(recipientsBlock) : undefined,
      References: referencesBlock ? extractQuotedArray(referencesBlock) : undefined,
    };
  }).filter(item => item.Body);
};

const extractBlockerItemsFromString = (value: string): Array<{
  type?: string;
  title?: string;
  description: string;
  severity?: string;
  impact?: string | null;
  references?: string[];
  evidence_quotes?: string[];
  missing_info_to_resolve?: string[];
}> => {
  const block = extractArrayBlock(value, 'items');
  if (!block) return [];
  const objects = block.match(/\{[\s\S]*?\}(?=\s*,\s*\{|\s*$)/g) || [];
  return objects.map(item => {
    const description = extractField(item, 'description') || extractField(item, 'text') || '';
    const referencesBlock = extractArrayBlock(item, 'references');
    const evidenceBlock = extractArrayBlock(item, 'evidence_quotes');
    const missingBlock = extractArrayBlock(item, 'missing_info_to_resolve');
    return {
      type: extractField(item, 'type') || undefined,
      title: extractField(item, 'title') || undefined,
      description,
      severity: extractField(item, 'severity') || undefined,
      impact: extractField(item, 'impact'),
      references: referencesBlock ? extractQuotedArray(referencesBlock) : undefined,
      evidence_quotes: evidenceBlock ? extractQuotedArray(evidenceBlock) : undefined,
      missing_info_to_resolve: missingBlock ? extractQuotedArray(missingBlock) : undefined,
    };
  }).filter(item => item.description && item.description.trim());
};

const extractCalendarEventsFromString = (value: string): Array<{
  title: string;
  description?: string;
  start?: string | null;
  end?: string | null;
  timezone?: string | null;
  attendees?: string[];
  status?: string;
  references?: string[];
  missing_info?: string[];
}> => {
  const block = extractArrayBlock(value, 'suggestedEvents');
  if (!block) return [];
  const objects = block.match(/\{[\s\S]*?\}(?=\s*,\s*\{|\s*$)/g) || [];
  return objects.map(item => {
    const referencesBlock = extractArrayBlock(item, 'references');
    const attendeesBlock = extractArrayBlock(item, 'attendees');
    const missingBlock = extractArrayBlock(item, 'missing_info');
    return {
      title: extractField(item, 'title') || '',
      description: extractField(item, 'description') || undefined,
      start: extractField(item, 'start') || extractField(item, 'start_time') || undefined,
      end: extractField(item, 'end') || extractField(item, 'end_time') || undefined,
      timezone: extractField(item, 'timezone') || undefined,
      attendees: attendeesBlock ? extractQuotedArray(attendeesBlock) : undefined,
      status: extractField(item, 'status') || undefined,
      references: referencesBlock ? extractQuotedArray(referencesBlock) : undefined,
      missing_info: missingBlock ? extractQuotedArray(missingBlock) : undefined,
    };
  }).filter(item => item.title && item.title.trim());
};

const extractNeuralSeekPayloadFromString = (value: string): {
  summary?: { summary: string; bullets: string[]; numOfBulletPoints?: number };
  nextTasks?: { next_steps: Array<{ task: string; owner?: string | null; rationale?: string | null; priority?: string | null; references?: string[] }>; numOfNextSteps?: number };
  email?: { allEmails: Array<{ SubjectLine?: string; Body?: string; Reason?: string; Recipients?: string[]; References?: string[] }>; numOfEmails?: number };
  blockers?: { items: Array<{
    type?: string;
    title?: string;
    description: string;
    severity?: string;
    impact?: string | null;
    references?: string[];
    evidence_quotes?: string[];
    missing_info_to_resolve?: string[];
  }>; numOfItems?: number };
  calendar?: { suggestedEvents: Array<{
    title: string;
    description?: string;
    start?: string | null;
    end?: string | null;
    timezone?: string | null;
    attendees?: string[];
    status?: string;
    references?: string[];
    missing_info?: string[];
  }>; numOfEvents?: number };
} => {
  const summaryBlock = extractObjectBlock(value, 'summary');
  const summaryText = summaryBlock ? (extractField(summaryBlock, 'summary') || extractSummaryTextFromString(value)) : extractSummaryTextFromString(value);
  const bullets = summaryBlock ? extractSummaryBulletsFromString(summaryBlock) : extractSummaryBulletsFromString(value);
  const summary = summaryText
    ? { summary: summaryText, bullets, numOfBulletPoints: bullets.length }
    : undefined;

  const nextTasksBlock = extractObjectBlock(value, 'nextTasks') || extractObjectBlock(value, 'next_tasks');
  const stepsBlock = nextTasksBlock ? extractArrayBlock(nextTasksBlock, 'next_steps') : null;
  const stepsSource = stepsBlock || nextTasksBlock || value;
  const taskItems = stepsSource ? extractTasksFromString(stepsSource).map(task => ({
    task: task.description,
    owner: task.owner,
    rationale: task.rationale,
    priority: task.priority,
    references: task.references,
  })) : [];
  const nextTasks = taskItems.length > 0
    ? { next_steps: taskItems, numOfNextSteps: taskItems.length }
    : undefined;

  const emailBlock = extractObjectBlock(value, 'email');
  const emailItems = emailBlock ? extractEmailsFromString(emailBlock) : extractEmailsFromString(value);
  const email = emailItems.length > 0 ? { allEmails: emailItems, numOfEmails: emailItems.length } : undefined;

  const blockersBlock = extractObjectBlock(value, 'blockers');
  const blockerItems = blockersBlock ? extractBlockerItemsFromString(blockersBlock) : extractBlockerItemsFromString(value);
  const blockers = blockerItems.length > 0 ? { items: blockerItems, numOfItems: blockerItems.length } : undefined;

  const calendarBlock = extractObjectBlock(value, 'calendar');
  const calendarItems = calendarBlock ? extractCalendarEventsFromString(calendarBlock) : extractCalendarEventsFromString(value);
  const calendar = calendarItems.length > 0 ? { suggestedEvents: calendarItems, numOfEvents: calendarItems.length } : undefined;

  return { summary, nextTasks, email, blockers, calendar };
};

const extractTasksFromString = (value: string): Array<{
  description: string;
  owner?: string | null;
  rationale?: string | null;
  priority?: string | null;
  references?: string[];
}> => {
  const tasks: Array<{
    description: string;
    owner?: string | null;
    rationale?: string | null;
    priority?: string | null;
    references?: string[];
  }> = [];

  const taskRegex = /"task"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(value))) {
    const description = unescapeJsonString(match[1]).trim();
    if (!description) continue;
    const windowStart = Math.max(0, match.index - 200);
    const windowEnd = Math.min(value.length, match.index + 400);
    const windowText = value.slice(windowStart, windowEnd);
    const ownerMatch = windowText.match(/"owner"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const rationaleMatch = windowText.match(/"rationale"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const priorityMatch = windowText.match(/"priority"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const refsMatch = windowText.match(/"references"\s*:\s*\[([^\]]+)\]/);
    const references = refsMatch
      ? Array.from(refsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g))
          .map(m => unescapeJsonString(m[1]).trim())
          .filter(Boolean)
      : undefined;

    tasks.push({
      description,
      owner: ownerMatch ? unescapeJsonString(ownerMatch[1]).trim() : undefined,
      rationale: rationaleMatch ? unescapeJsonString(rationaleMatch[1]).trim() : undefined,
      priority: priorityMatch ? unescapeJsonString(priorityMatch[1]).trim() : undefined,
      references,
    });
  }

  return tasks;
};

const extractCalendarFromString = (value: string): Array<{ title: string; description: string; start_time: string; end_time: string }> => {
  const events: Array<{ title: string; description: string; start_time: string; end_time: string }> = [];
  const blockMatch = value.match(/"suggestedEvents"\s*:\s*\[([\s\S]*?)\]/);
  const block = blockMatch ? blockMatch[1] : value;
  const titleRegex = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const forbidden = new Set(['end_time', 'start_time', 'timezone', 'attendees', 'references', 'status']);
  let match: RegExpExecArray | null;
  while ((match = titleRegex.exec(block))) {
    const title = unescapeJsonString(match[1]).trim();
    if (!title) continue;
    if (forbidden.has(title.toLowerCase())) continue;
    const windowStart = Math.max(0, match.index - 200);
    const windowEnd = Math.min(block.length, match.index + 400);
    const windowText = block.slice(windowStart, windowEnd);
    const descMatch = windowText.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const startMatch = windowText.match(/"start(?:_time|Time)?"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const endMatch = windowText.match(/"end(?:_time|Time)?"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const start_time = startMatch ? unescapeJsonString(startMatch[1]).trim() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const end_time = endMatch ? unescapeJsonString(endMatch[1]).trim() : new Date(new Date(start_time).getTime() + 60 * 60 * 1000).toISOString();
    events.push({
      title,
      description: descMatch ? unescapeJsonString(descMatch[1]).trim() : '',
      start_time,
      end_time,
    });
  }
  return events;
};

const extractBlockersFromString = (value: string): Array<{ description: string; severity: string }> => {
  const blockers: Array<{ description: string; severity: string }> = [];
  const descRegex = /"description"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = descRegex.exec(value))) {
    const description = unescapeJsonString(match[1]).trim();
    if (!description) continue;
    const windowStart = Math.max(0, match.index - 120);
    const windowEnd = Math.min(value.length, match.index + 200);
    const windowText = value.slice(windowStart, windowEnd);
    const severityMatch = windowText.match(/"severity"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    blockers.push({
      description,
      severity: severityMatch ? unescapeJsonString(severityMatch[1]).trim() : 'medium',
    });
  }
  return blockers;
};

const normalizeTasks = (input: any): Array<{
  description: string;
  owner?: string | null;
  rationale?: string | null;
  priority?: string | null;
  references?: string[];
}> => {
  const parsed = tryParseJson(input);
  const source = Array.isArray(parsed)
    ? parsed
    : parsed?.nextTasks || parsed?.actionItems || parsed?.tasks || parsed?.items || parsed?.steps;
  const items = source ?? input;

  if (!items) return [];

  if (Array.isArray(items)) {
    return items.flatMap((item: any) => {
      if (typeof item === 'string') {
        const parsedItem = tryParseJson(item);
        if (parsedItem) {
          return normalizeTasks(parsedItem);
        }
        return splitLines(item).map(description => ({ description }));
      }
      if (item && typeof item === 'object') {
        const description = pickString(item, ['description', 'task', 'item', 'title', 'text', 'summary', 'action']);
        if (!description) return [];
        return [{
          description,
          owner: item.owner ?? item.assignee ?? null,
          rationale: item.rationale ?? null,
          priority: item.priority ?? item.importance ?? item.severity ?? null,
          references: Array.isArray(item.references) ? item.references : undefined,
        }];
      }
      return [];
    });
  }

  if (typeof items === 'string') {
    const parsedString = tryParseJson(items);
    if (parsedString) {
      return normalizeTasks(parsedString);
    }
    const extracted = extractTasksFromString(items);
    if (extracted.length > 0) return extracted;
    return splitLines(items).map(description => ({ description }));
  }

  if (items && typeof items === 'object') {
    return normalizeTasks([items]);
  }

  return [];
};

const extractTasksFromSummary = (summary: string): Array<{ description: string }> => {
  if (!summary) return [];
  const cleanLine = (line: string) => line
    .replace(/^["'\s,]+/, '')
    .replace(/["',]+$/, '')
    .trim();
  const lines = summary
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);

  const tasks: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (/^(action items?|next steps?)\s*:?\s*$/.test(lower)) {
      inSection = true;
      continue;
    }

    if (inSection && /^(summary|decisions?|notes?|email|calendar|blockers?|issues?|risks?)\b/.test(lower)) {
      inSection = false;
    }

    if (inSection) {
      const bullet = line.replace(/^[-*•\d.)\s]+/, '').trim();
      if (bullet) tasks.push(bullet);
      continue;
    }

    const inline = line.match(/action item\s*:?\s*(.+)$/i);
    if (inline && inline[1]) {
      tasks.push(inline[1].trim());
      continue;
    }

    const nextSteps = line.match(/next steps?\s*:?\s*(.+)$/i);
    if (nextSteps && nextSteps[1]) {
      tasks.push(nextSteps[1].trim());
    }
  }

  return Array.from(new Set(tasks)).map(description => ({ description }));
};

const normalizeBlockers = (input: any): Array<{ description: string; severity: string }> => {
  const parsed = tryParseJson(input);
  const source = Array.isArray(parsed)
    ? parsed
    : parsed?.blockers || parsed?.issues || parsed?.risks || parsed?.uncertainties || parsed?.problem;
  const items = source ?? input;

  if (!items) return [];

  if (Array.isArray(items)) {
    return items.flatMap((item: any) => {
      if (typeof item === 'string') {
        const parsedItem = tryParseJson(item);
        if (parsedItem) {
          return normalizeBlockers(parsedItem);
        }
        return splitLines(item).map(description => ({ description, severity: 'medium' }));
      }
      if (item && typeof item === 'object') {
        const description = pickString(item, ['description', 'issue', 'blocker', 'risk', 'uncertainty', 'text', 'title', 'quote']);
        if (!description) return [];
        const severity =
          (typeof item.severity === 'string' && item.severity) ||
          (typeof item.priority === 'string' && item.priority) ||
          (typeof item.level === 'string' && item.level) ||
          'medium';
        return [{ description, severity }];
      }
      return [];
    });
  }

  if (typeof items === 'string') {
    const parsedString = tryParseJson(items);
    if (parsedString) {
      return normalizeBlockers(parsedString);
    }
    const extracted = extractBlockersFromString(items);
    if (extracted.length > 0) return extracted;
    return splitLines(items).map(description => ({ description, severity: 'medium' }));
  }

  if (items && typeof items === 'object') {
    return normalizeBlockers([items]);
  }

  return [];
};

const normalizeCalendarEvents = (input: any): Array<{ title: string; description: string; start_time: string; end_time: string }> => {
  const parsed = tryParseJson(input);
  const source = Array.isArray(parsed)
    ? parsed
    : parsed?.calendarEvents || parsed?.calendar || parsed?.events || parsed?.suggestedEvents;
  const items = source ?? input;

  if (!items) return [];

  if (Array.isArray(items)) {
    return items.flatMap((item: any) => {
      if (typeof item === 'string') {
        const parsedItem = tryParseJson(item);
        if (parsedItem) {
          return normalizeCalendarEvents(parsedItem);
        }
        if (looksLikeJsonFragment(item)) {
          return [];
        }
        const title = item.trim();
        if (!title) return [];
        const start_time = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const end_time = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
        return [{ title, description: '', start_time, end_time }];
      }

      if (item && typeof item === 'object') {
        const title = pickString(item, ['title', 'summary', 'subject', 'displayText', 'name']);
        if (!title) return [];
        const description = pickString(item, ['description', 'details', 'notes', 'text']) || '';
        const startCandidate = coerceDateTime(item.start_time || item.startTime || item.start || item.start_date || item.startDate);
        const endCandidate = coerceDateTime(item.end_time || item.endTime || item.end || item.end_date || item.endDate);
        const start_time = startCandidate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const end_time = endCandidate || new Date(new Date(start_time).getTime() + 60 * 60 * 1000).toISOString();
        return [{ title, description, start_time, end_time }];
      }

      return [];
    });
  }

  if (typeof items === 'string') {
    const parsedString = tryParseJson(items);
    if (parsedString) {
      return normalizeCalendarEvents(parsedString);
    }
    if (items.includes('\\"')) {
      const unescaped = items.replace(/\\"/g, '"');
      const parsedUnescaped = tryParseJson(unescaped);
      if (parsedUnescaped) {
        return normalizeCalendarEvents(parsedUnescaped);
      }
    }
    const extracted = extractCalendarFromString(items);
    if (extracted.length > 0) return extracted;
    return splitLines(items).map(title => ({
      title,
      description: '',
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
    }));
  }

  if (items && typeof items === 'object') {
    return normalizeCalendarEvents([items]);
  }

  return [];
};

const normalizeEmail = (input: any): { subject: string; body: string } => {
  const parsed = tryParseJson(input);
  const source = parsed?.emailDraft || parsed?.email || parsed?.draft || parsed || input;

  if (typeof source === 'string') {
    const parsedString = tryParseJson(source);
    if (parsedString) {
      return normalizeEmail(parsedString);
    }
    const subjectMatch = source.match(/"Subject(Line)?"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bodyMatch = source.match(/"Body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (bodyMatch) {
      return {
        subject: subjectMatch ? unescapeJsonString(subjectMatch[2]).trim() : 'Meeting Follow-up',
        body: unescapeJsonString(bodyMatch[1]).trim(),
      };
    }
    return { subject: 'Meeting Follow-up', body: stripMarkdown(source) };
  }

  if (source && typeof source === 'object') {
    const subject =
      (typeof source.subject === 'string' && source.subject) ||
      (typeof parsed?.emailSubject === 'string' && parsed.emailSubject) ||
      (typeof parsed?.subject === 'string' && parsed.subject) ||
      'Meeting Follow-up';
    const body =
      (typeof source.body === 'string' && source.body) ||
      (typeof source.text === 'string' && source.text) ||
      (typeof source.email === 'string' && source.email) ||
      (typeof source.message === 'string' && source.message) ||
      '';
    return { subject, body };
  }

  return { subject: 'Meeting Follow-up', body: '' };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    // Try multiple possible secret names for service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || 
                       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
                       Deno.env.get('SUPABASE_SERVICE_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify user session when a token is provided (guest access is allowed)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    let user: { id: string } | null = null;
    if (token) {
      const { data: { user: authedUser }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !authedUser) {
        console.warn('Proceeding as guest: auth token could not be verified.');
      } else {
        user = authedUser;
      }
    }

    const { transcript, title } = await req.json();
    
    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const neuralseekApiKey = Deno.env.get('NEURALSEEK_API_KEY');
    if (!neuralseekApiKey) {
      console.error('NEURALSEEK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling NeuralSeek API with transcript length:', transcript.length);

    // Meeting title
    const meetingTitle = title || `Meeting ${new Date().toLocaleDateString()}`;

    // Call BigAgent to get comprehensive analysis
    const bigAgentResponse = await fetch(
      'https://stagingapi.neuralseek.com/v1/stony52/maistro',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${neuralseekApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent: 'BigAgent',
          params: {
            meetingTranscript: transcript
          }
        }),
      }
    );

    if (!bigAgentResponse.ok) {
      const errorText = await bigAgentResponse.text();
      console.error('BigAgent API error:', bigAgentResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze transcript', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bigAgentData = await bigAgentResponse.json();
    console.log('BigAgent response received');

    // Parse the BigAgent response
    let summary = '';
    let summaryRaw: unknown = null;
    let nextTasks: Array<{
      description: string;
      owner?: string | null;
      rationale?: string | null;
      priority?: string | null;
      references?: string[];
    }> = [];
    let email = { subject: '', body: '' };
    let emailRaw: unknown = null;
    let calendarEvents: Array<{ title: string; description: string; start_time: string; end_time: string }> = [];
    let calendarRaw: unknown = null;
    let blockers: Array<{ description: string; severity: string }> = [];
    let blockersRaw: unknown = null;
    let responsePayload: Record<string, unknown> | null = null;

    // Extract data from BigAgent response
    if (bigAgentData.answer) {
      const answer = bigAgentData.answer;
      const parsed = tryParseJson(answer) || (typeof answer === 'object' ? answer : null);

      if (parsed && typeof parsed === 'object') {
        if (
          'summary' in parsed ||
          'nextTasks' in parsed ||
          'email' in parsed ||
          'calendar' in parsed ||
          'blockers' in parsed
        ) {
          responsePayload = parsed as Record<string, unknown>;
        }
        const summaryCandidate = parsed.summary || parsed.meetingSummary || parsed.meeting_summary || parsed.text;
        if (typeof summaryCandidate === 'string') {
          const extractedSummary = extractSummaryTextFromString(summaryCandidate);
          summary = extractedSummary || stripMarkdown(summaryCandidate);
        } else if (summaryCandidate && typeof summaryCandidate === 'object') {
          summary = pickString(summaryCandidate, ['summary', 'text', 'display_text', 'displayText']) || '';
        }
        summaryRaw = summaryCandidate || null;
        if (summaryRaw && typeof summaryRaw === 'object') {
          const hasBullets = Array.isArray((summaryRaw as any).bullets);
          if (!hasBullets) {
            summaryRaw = null;
          }
        }
        const summaryContainer = parsed.summary || parsed.meetingSummary || parsed.meeting_summary || parsed.text || null;
        const tasksContainer = parsed.nextTasks || summaryContainer?.nextTasks || summaryContainer?.next_steps;
        if (tasksContainer && typeof tasksContainer === 'object' && (tasksContainer as any).next_steps) {
          nextTasks = normalizeTasks((tasksContainer as any).next_steps);
        } else {
          nextTasks = normalizeTasks(parsed.nextTasks || parsed.actionItems || parsed.tasks || parsed.items || tasksContainer);
        }

        emailRaw = parsed.emailDraft || parsed.email || summaryContainer?.email || null;
        email = normalizeEmail(emailRaw || parsed);

        calendarRaw = parsed.calendarEvents || parsed.calendar || parsed.events || summaryContainer?.calendar || summaryContainer?.suggestedEvents || null;
        calendarEvents = normalizeCalendarEvents(calendarRaw || parsed);

        blockersRaw = parsed.blockers || parsed.issues || parsed.risks || parsed.uncertainties || summaryContainer?.blockers || null;
        blockers = normalizeBlockers(blockersRaw || parsed);
      } else if (typeof answer === 'string') {
        console.log('BigAgent returned unstructured response, parsing text...');
        const extracted = extractNeuralSeekPayloadFromString(answer);
        const extractedSummary = extracted.summary?.summary || extractSummaryTextFromString(answer);
        summary = extractedSummary || stripMarkdown(answer);

        if (extracted.summary) {
          summaryRaw = extracted.summary;
        }

        if (extracted.nextTasks) {
          nextTasks = (extracted.nextTasks.next_steps || []).map(item => ({
            description: item.task,
            owner: item.owner,
            rationale: item.rationale,
            priority: item.priority,
            references: item.references,
          }));
        } else {
          nextTasks = normalizeTasks(answer);
        }

        if (extracted.email) {
          emailRaw = extracted.email;
          email = normalizeEmail(extracted.email);
        } else {
          emailRaw = answer;
          email = normalizeEmail(emailRaw);
        }

        if (extracted.calendar) {
          calendarRaw = extracted.calendar;
          calendarEvents = normalizeCalendarEvents(extracted.calendar);
        } else {
          calendarRaw = answer;
          calendarEvents = normalizeCalendarEvents(calendarRaw);
        }

        if (extracted.blockers) {
          blockersRaw = extracted.blockers;
          blockers = normalizeBlockers(extracted.blockers);
        } else {
          blockersRaw = answer;
          blockers = normalizeBlockers(blockersRaw);
        }

        if (extracted.summary || extracted.nextTasks || extracted.email || extracted.calendar || extracted.blockers) {
          responsePayload = {
            summary: extracted.summary || summary,
            nextTasks: extracted.nextTasks || nextTasks,
            email: extracted.email || email,
            calendar: extracted.calendar || calendarEvents,
            blockers: extracted.blockers || blockers,
          };
        }
      }
    }

    let tasksFromSummary = false;
    if (nextTasks.length === 0 && summary) {
      nextTasks = extractTasksFromSummary(summary);
      tasksFromSummary = nextTasks.length > 0;
    }

    const needsSummary = !summary;
    const needsTasks = nextTasks.length === 0 || tasksFromSummary;
    const needsEmail = !email.body;
    const needsCalendar = calendarEvents.length === 0;
    const needsBlockers = blockers.length === 0;

    if (needsSummary || needsTasks || needsEmail || needsCalendar || needsBlockers) {
      console.log('Calling individual NeuralSeek agents...');

      const requests: Array<Promise<Response> | null> = [
        needsSummary ? fetch('https://stagingapi.neuralseek.com/v1/stony52/maistro', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpSummarizer', params: { meetingTranscript: transcript } }),
        }) : null,
        needsTasks ? fetch('https://stagingapi.neuralseek.com/v1/stony52/maistro', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpNextTasks', params: { meetingTranscript: transcript } }),
        }) : null,
        needsEmail ? fetch('https://stagingapi.neuralseek.com/v1/stony52/maistro', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpEmail', params: { meetingTranscript: transcript } }),
        }) : null,
        needsCalendar ? fetch('https://stagingapi.neuralseek.com/v1/stony52/maistro', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpCalendar', params: { meetingTranscript: transcript } }),
        }) : null,
        needsBlockers ? fetch('https://stagingapi.neuralseek.com/v1/stony52/maistro', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpBlockers', params: { meetingTranscript: transcript } }),
        }) : null,
      ];

      const [summaryRes, tasksRes, emailRes, calendarRes, blockersRes] = await Promise.all(
        requests.map(req => req ? req : Promise.resolve(null))
      );

      const [summaryData, tasksData, emailData, calendarData, blockersData] = await Promise.all([
        summaryRes ? summaryRes.json() : Promise.resolve(null),
        tasksRes ? tasksRes.json() : Promise.resolve(null),
        emailRes ? emailRes.json() : Promise.resolve(null),
        calendarRes ? calendarRes.json() : Promise.resolve(null),
        blockersRes ? blockersRes.json() : Promise.resolve(null),
      ]);

      if (summaryData?.answer) {
        const parsedSummary = tryParseJson(summaryData.answer);
        const extractedSummary = extractSummaryTextFromString(summaryData.answer);
        summary =
          parsedSummary?.summary ||
          parsedSummary?.text ||
          extractedSummary ||
          stripMarkdown(summaryData.answer) ||
          summary;
        if (parsedSummary && typeof parsedSummary === 'object' && Array.isArray((parsedSummary as any).bullets)) {
          summaryRaw = parsedSummary;
        }
      }

      if (tasksData?.answer) {
        nextTasks = normalizeTasks(tasksData.answer);
      }

      if (emailData?.answer) {
        emailRaw = emailData.answer;
        email = normalizeEmail(emailRaw);
      }

      if (calendarData?.answer) {
        calendarRaw = calendarData.answer;
        calendarEvents = normalizeCalendarEvents(calendarRaw);
      }

      if (blockersData?.answer) {
        blockersRaw = blockersData.answer;
        blockers = normalizeBlockers(blockersRaw);
      }
    }

    // Save analysis results to database when signed in
    let savedMeetingId: string | null = null;
    if (user) {
      const { data: savedId, error: saveError } = await supabase.rpc('save_meeting_analysis', {
        p_user_id: user.id,
        p_title: meetingTitle,
        p_transcript: transcript,
        p_summary: summary || null,
        p_tasks: nextTasks.length > 0 ? nextTasks : null,
        p_email_subject: email.subject || null,
        p_email_body: email.body || null,
        p_calendar_events: calendarEvents.length > 0 ? calendarEvents : null,
        p_blockers: blockers.length > 0 ? blockers : null,
        p_raw_analysis: responsePayload || {
          summary: summaryRaw || summary,
          nextTasks,
          email: emailRaw || email,
          calendar: calendarRaw || calendarEvents,
          blockers: blockersRaw || blockers,
        }
      });

      if (saveError) {
        console.error('Error saving analysis:', saveError);
        return new Response(
          JSON.stringify({ error: 'Failed to save analysis results', details: saveError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      savedMeetingId = savedId ?? null;
    }

    console.log('Analysis complete');

    let summaryPayload: unknown = summaryRaw || summary;
    let nextTasksPayload: unknown = nextTasks;
    let emailPayload: unknown = emailRaw || email;
    let calendarPayload: unknown = calendarRaw || calendarEvents;
    let blockersPayload: unknown = blockersRaw || blockers;

    if (!responsePayload && (typeof emailRaw === 'string' || typeof calendarRaw === 'string' || typeof blockersRaw === 'string' || typeof summaryRaw === 'string')) {
      const rawString = [
        typeof summaryRaw === 'string' ? summaryRaw : '',
        typeof emailRaw === 'string' ? emailRaw : '',
        typeof calendarRaw === 'string' ? calendarRaw : '',
        typeof blockersRaw === 'string' ? blockersRaw : '',
      ].join('\n');

      const bullets = extractSummaryBulletsFromString(rawString);
      if (bullets.length > 0) {
        summaryPayload = {
          summary,
          bullets,
          numOfBulletPoints: bullets.length,
        };
      }

      const taskItems = extractTasksFromString(rawString).map(task => ({
        task: task.description,
        owner: task.owner,
        priority: task.priority,
        rationale: task.rationale,
        references: task.references,
      }));
      if (taskItems.length > 0) {
        nextTasksPayload = {
          next_steps: taskItems,
          numOfNextSteps: taskItems.length,
        };
      }

      const emails = extractEmailsFromString(rawString);
      if (emails.length > 0) {
        emailPayload = {
          allEmails: emails,
          numOfEmails: emails.length,
        };
      }

      const blockersItems = extractBlockerItemsFromString(rawString);
      if (blockersItems.length > 0) {
        blockersPayload = {
          items: blockersItems,
          numOfItems: blockersItems.length,
        };
      }

      const calendarEventsRaw = extractCalendarEventsFromString(rawString);
      if (calendarEventsRaw.length > 0) {
        calendarPayload = {
          suggestedEvents: calendarEventsRaw,
          numOfEvents: calendarEventsRaw.length,
        };
      }
    }

    const fallbackPayload = {
      summary: summaryPayload,
      nextTasks: nextTasksPayload,
      email: emailPayload,
      calendar: calendarPayload,
      blockers: blockersPayload,
    };

    const responseBody = {
      ...(savedMeetingId ? { meetingId: savedMeetingId } : {}),
      ...(responsePayload || fallbackPayload),
    };

    return new Response(
      JSON.stringify(responseBody),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in analyze-meeting function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
