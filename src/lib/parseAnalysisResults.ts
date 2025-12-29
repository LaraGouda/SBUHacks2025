/**
 * Helper function to parse JSON analysis results and convert them to human-readable text
 * for display in the ResultsDisplay component cards.
 */

// Type definitions for each card type
export interface TaskItem {
  id?: string;
  task: string;
  owner?: string | null;
  rationale?: string;
  priority?: string;
  references?: string[];
  completed?: boolean;
}

export interface BlockerItem {
  type?: string;
  title?: string;
  description: string;
  quote?: string;
  timestamp?: string;
  severity?: string;
  impact?: string | null;
  references?: string[];
  evidenceQuotes?: string[];
  missingInfo?: string[];
}

export interface CalendarEvent {
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  attendees?: string[];
  status?: string;
  references?: string[];
  missingInfo?: string[];
}

export interface EmailData {
  reason?: string;
  recipients?: string[];
  subject?: string;
  body: string;
  references?: string[];
}

export interface SummaryData {
  text: string;
  bullets: string[];
}

export interface AnalysisResults {
  summary: SummaryData;
  nextTasks: TaskItem[];
  email: EmailData[];
  calendar: CalendarEvent[];
  blockers: BlockerItem[];
}

interface RawAnalysisResults {
  summary?: any;
  nextTasks?: any;
  email?: any;
  calendar?: any;
  blockers?: any;
}

/**
 * Strips markdown code blocks from a string
 */
const stripMarkdown = (str: string): string => {
  return str
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^```/gm, '')
    .replace(/```$/gm, '')
    .trim();
};

const extractJsonSubstring = (value: string): string | null => {
  const match = value.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : null;
};

const normalizeJson = (value: string): string => {
  return value.replace(/,\s*([}\]])/g, '$1');
};

const repairJson = (value: string): string => {
  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let i = 0; i < value.length; i++) {
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

    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';
      if (stack.length > 0 && stack[stack.length - 1] === expected) {
        stack.pop();
      }
    }
  }

  if (stack.length === 0) return value;

  let repaired = value;
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === '{' ? '}' : ']';
  }
  return repaired;
};

const tryParseJson = (value: string): any | null => {
  const trimmed = stripMarkdown(value);
  const candidate = (trimmed.startsWith('{') || trimmed.startsWith('['))
    ? trimmed
    : extractJsonSubstring(trimmed);

  if (!candidate) return null;

  const normalized = normalizeJson(candidate);
  try {
    return JSON.parse(normalized);
  } catch {
    try {
      return JSON.parse(repairJson(normalized));
    } catch {
      return null;
    }
  }
};

const tryParseJsonFromArray = (value: any): any | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every(item => typeof item === 'string')) return null;
  const joined = value.join('\n').trim();
  if (!joined) return null;
  if (!joined.includes('{') && !joined.includes('[')) return null;
  return tryParseJson(joined);
};

/**
 * Parses a JSON string to extract readable text for summary
 */
const parseSummary = (value: any): SummaryData => {
  if (!value) return { text: "No summary generated", bullets: [] };
  
  // If it's an object, check for display_text first
  if (typeof value === 'object' && value !== null) {
    const parsedFromArray = tryParseJsonFromArray(value);
    if (parsedFromArray) {
      return parseSummary(parsedFromArray);
    }
    if (value.summary && Array.isArray(value.bullets)) {
      return {
        text: typeof value.summary === 'string' ? value.summary : String(value.summary || ''),
        bullets: value.bullets.filter((item: any) => typeof item === 'string' && item.trim()),
      };
    }
    if (value.display_text || value.displayText) {
      return { text: value.display_text || value.displayText, bullets: [] };
    }
    
    // Check nested structures
    if (value.meetingSummary) {
      if (typeof value.meetingSummary === 'string') {
        // If it's a string with markdown code blocks, parse it
        let trimmed = value.meetingSummary.trim();
        if (trimmed.includes('```')) {
          trimmed = stripMarkdown(trimmed);
        }
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            return parseSummary(parsed);
          } catch {
            // If parsing fails, continue
          }
        }
      } else if (typeof value.meetingSummary === 'object') {
        const summaryObj = value.meetingSummary;
        if (summaryObj.display_text || summaryObj.displayText) {
          return { text: summaryObj.display_text || summaryObj.displayText, bullets: [] };
        }
        if (summaryObj.meeting_summary) {
          const innerSummary = summaryObj.meeting_summary;
          let summaryText = innerSummary.summary || innerSummary.text || '';
          const bullets: string[] = [];
          
          // Include decisions if present
          if (innerSummary.decisions_goals_outcomes && Array.isArray(innerSummary.decisions_goals_outcomes)) {
            const decisions = innerSummary.decisions_goals_outcomes
              .map((d: any) => {
                const item = typeof d === 'string' ? d : (d.item || d.text || d.description || String(d));
                if (d && typeof d === 'object' && d.reference) {
                  return `${item} ${d.reference}`;
                }
                return item;
              })
              .filter(Boolean)
              .filter((item: any) => typeof item === 'string' && item.trim());
            if (decisions.length > 0) {
              bullets.push(...decisions);
            }
          }
          
          return { text: summaryText || String(value), bullets };
        }
      }
    }
    
    if (value.summary) {
      if (typeof value.summary === 'object' && value.summary !== null) {
        return parseSummary(value.summary);
      }
      return { text: value.summary, bullets: [] };
    }
    if (value.text) return { text: value.text, bullets: [] };
  }
  
  if (typeof value === 'string') {
    let trimmed = value.trim();
    
    const parsedJson = tryParseJson(trimmed);
    if (parsedJson) {
      return parseSummary(parsedJson);
    }
    
    return { text: trimmed, bullets: [] };
  }
  
  return { text: String(value), bullets: [] };
};

/**
 * Parses tasks array - extracts task, rationale, and priority
 */
const parseTasks = (value: any): TaskItem[] => {
  if (!value) return [];
  
  const parsedFromArray = tryParseJsonFromArray(value);
  if (parsedFromArray) {
    return parseTasks(parsedFromArray);
  }

  // If value has display_text but we need structured data, parse the nested JSON
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Check if it has a nested structure like { next_steps: [...], display_text: "..." }
    if (value.next_steps || value.nextSteps) {
      const steps = value.next_steps || value.nextSteps;
      if (Array.isArray(steps)) {
        return steps.map((item: any) => ({
          id: item.id,
          task: item.task || item.item || item.description || '',
          owner: item.owner ?? item.assignee ?? null,
          rationale: item.rationale,
          priority: item.priority,
          references: Array.isArray(item.references) ? item.references : undefined,
          completed: typeof item.completed === 'boolean' ? item.completed : undefined,
        })).filter(item => item.task && item.task.trim());
      }
    }
    
    // If it's a string with markdown code blocks, parse it
    if (typeof value === 'string') {
      const parsedJson = tryParseJson(value);
      if (parsedJson) {
        return parseTasks(parsedJson);
      }
    }
  }
  
  // If it's already an array of TaskItem objects, return as-is (preserve id/completed if present)
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].task) {
    return value.map(item => ({
      id: item.id,
      task: item.task || '',
      owner: item.owner ?? item.assignee ?? null,
      rationale: item.rationale,
      priority: item.priority,
      references: Array.isArray(item.references) ? item.references : undefined,
      completed: typeof item.completed === 'boolean' ? item.completed : undefined,
    }));
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    const parsedJson = tryParseJson(valueStr);
    if (parsedJson) {
      return parseTasks(parsedJson);
    }
  }
  
  // If it's an array, parse each item
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') {
        let itemStr = item.trim();
        
        // Strip markdown if present
        if (itemStr.includes('```')) {
          itemStr = stripMarkdown(itemStr);
        }
        
        // If it looks like JSON, parse it
        if (itemStr.startsWith('{') || itemStr.startsWith('[')) {
          try {
            const parsed = JSON.parse(itemStr);
            return {
              task: parsed.task || parsed.item || parsed.description || '',
              owner: parsed.owner ?? parsed.assignee ?? null,
              rationale: parsed.rationale,
              priority: parsed.priority,
              references: Array.isArray(parsed.references) ? parsed.references : undefined,
            };
          } catch {
            // If parsing fails, try regex extraction
            const taskMatch = itemStr.match(/"task"\s*:\s*"([^"]+)"/);
            const rationaleMatch = itemStr.match(/"rationale"\s*:\s*"([^"]+)"/);
            const priorityMatch = itemStr.match(/"priority"\s*:\s*"([^"]+)"/);
            
            return {
              task: taskMatch ? taskMatch[1] : itemStr,
              rationale: rationaleMatch ? rationaleMatch[1] : undefined,
              priority: priorityMatch ? priorityMatch[1] : undefined,
            };
          }
        }
        
        return { task: itemStr };
      }
      
      // If it's an object, extract fields
      if (typeof item === 'object' && item !== null) {
        return {
          id: item.id,
          task: item.task || item.item || item.description || '',
          owner: item.owner ?? item.assignee ?? null,
          rationale: item.rationale,
          priority: item.priority,
          references: Array.isArray(item.references) ? item.references : undefined,
          completed: typeof item.completed === 'boolean' ? item.completed : undefined,
        };
      }
      
      return { task: String(item) };
    }).filter(item => item.task && item.task.trim());
  }
  
  return [];
};

/**
 * Parses blockers array - extracts description, quote, and timestamp
 */
const parseBlockers = (value: any): BlockerItem[] => {
  if (!value) return [];
  
  const parsedFromArray = tryParseJsonFromArray(value);
  if (parsedFromArray) {
    return parseBlockers(parsedFromArray);
  }

  // If value is a string with human-readable text at the end, extract blockers from structured data
  if (typeof value === 'string') {
    const parsedJson = tryParseJson(value);
    if (parsedJson) {
      return parseBlockers(parsedJson);
    }
  }
  
  // If it's an object with nested structures
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (value.items && Array.isArray(value.items)) {
      return value.items.map((item: any) => ({
        type: item.type,
        title: item.title,
        description: item.description || '',
        severity: item.severity,
        impact: item.impact ?? null,
        references: Array.isArray(item.references) ? item.references : undefined,
        evidenceQuotes: Array.isArray(item.evidence_quotes) ? item.evidence_quotes : undefined,
        missingInfo: Array.isArray(item.missing_info_to_resolve) ? item.missing_info_to_resolve : undefined,
      })).filter(item => item.description && item.description.trim());
    }

    // Check for open_questions, uncertainties, risks, blockers arrays
    const allBlockers: BlockerItem[] = [];
    
    if (value.open_questions && Array.isArray(value.open_questions)) {
      allBlockers.push(...value.open_questions.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
        severity: item.severity,
        impact: item.impact,
        references: Array.isArray(item.references) ? item.references : undefined,
      })));
    }
    
    if (value.uncertainties && Array.isArray(value.uncertainties)) {
      allBlockers.push(...value.uncertainties.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
        severity: item.severity,
        impact: item.impact,
        references: Array.isArray(item.references) ? item.references : undefined,
      })));
    }
    
    if (value.risks && Array.isArray(value.risks)) {
      allBlockers.push(...value.risks.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
        severity: item.severity,
        impact: item.impact,
        references: Array.isArray(item.references) ? item.references : undefined,
      })));
    }
    
    if (value.blockers && Array.isArray(value.blockers)) {
      allBlockers.push(...value.blockers.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
        severity: item.severity,
        impact: item.impact,
        references: Array.isArray(item.references) ? item.references : undefined,
      })));
    }
    
    if (allBlockers.length > 0) {
      return allBlockers.filter(item => item.description && item.description.trim());
    }
  }
  
  // If it's already an array of BlockerItem objects, return as-is
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].description) {
    return value.map(item => ({
      type: item.type,
      title: item.title,
      description: item.description || '',
      quote: item.quote,
      timestamp: item.timestamp,
      severity: item.severity,
      impact: item.impact,
      references: Array.isArray(item.references) ? item.references : undefined,
      evidenceQuotes: Array.isArray(item.evidence_quotes) ? item.evidence_quotes : undefined,
      missingInfo: Array.isArray(item.missing_info_to_resolve) ? item.missing_info_to_resolve : undefined,
    }));
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    const parsedJson = tryParseJson(valueStr);
    if (parsedJson) {
      return parseBlockers(parsedJson);
    }
  }
  
  // If it's an array, parse each item
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') {
        let itemStr = item.trim();
        
        // Strip markdown if present
        if (itemStr.includes('```')) {
          itemStr = stripMarkdown(itemStr);
        }
        
        // If it looks like JSON, parse it
        if (itemStr.startsWith('{') || itemStr.startsWith('[')) {
          try {
            const parsed = JSON.parse(itemStr);
            return {
              type: parsed.type,
              title: parsed.title,
              description: parsed.description || parsed.text || '',
              quote: parsed.quote,
              timestamp: parsed.timestamp,
              severity: parsed.severity,
              impact: parsed.impact,
              references: Array.isArray(parsed.references) ? parsed.references : undefined,
            };
          } catch {
            // If parsing fails, try regex extraction
            const descMatch = itemStr.match(/"description"\s*:\s*"([^"]+)"/);
            const quoteMatch = itemStr.match(/"quote"\s*:\s*"([^"]+)"/);
            const timestampMatch = itemStr.match(/"timestamp"\s*:\s*"([^"]+)"/);
            
            return {
              description: descMatch ? descMatch[1] : itemStr,
              quote: quoteMatch ? quoteMatch[1] : undefined,
              timestamp: timestampMatch ? timestampMatch[1] : undefined,
            };
          }
        }
        
        return { description: itemStr };
      }
      
      // If it's an object, extract fields
      if (typeof item === 'object' && item !== null) {
        return {
          type: item.type,
          title: item.title,
          description: item.description || item.text || '',
          quote: item.quote,
          timestamp: item.timestamp,
          severity: item.severity,
          impact: item.impact,
          references: Array.isArray(item.references) ? item.references : undefined,
          evidenceQuotes: Array.isArray(item.evidence_quotes) ? item.evidence_quotes : undefined,
          missingInfo: Array.isArray(item.missing_info_to_resolve) ? item.missing_info_to_resolve : undefined,
        };
      }
      
      return { description: String(item) };
    }).filter(item => item.description && item.description.trim());
  }
  
  return [];
};

/**
 * Parses calendar events array - extracts title, description, startTime, endTime, timezone, attendees, status
 */
const parseCalendarEvents = (value: any): CalendarEvent[] => {
  if (!value) return [];
  
  const parsedFromArray = tryParseJsonFromArray(value);
  if (parsedFromArray) {
    return parseCalendarEvents(parsedFromArray);
  }

  // If value is a string with markdown code blocks, parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    const parsedJson = tryParseJson(valueStr);
    if (parsedJson) {
      return parseCalendarEvents(parsedJson);
    }
  }
  
  // If it's an object with nested events array
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (value.suggestedEvents && Array.isArray(value.suggestedEvents)) {
      return value.suggestedEvents.map((item: any) => ({
        title: item.title || item.summary || '',
        description: item.description,
        startTime: item.start || item.startTime || item.start_time,
        endTime: item.end || item.endTime || item.end_time,
        timezone: item.timezone || item.timeZone,
        attendees: Array.isArray(item.attendees) ? item.attendees : [],
        status: item.status,
        references: Array.isArray(item.references) ? item.references : undefined,
        missingInfo: Array.isArray(item.missing_info) ? item.missing_info : undefined,
      })).filter(item => item.title && item.title.trim());
    }
    if (value.events && Array.isArray(value.events)) {
      return value.events.map((item: any) => ({
        title: item.title || item.Title || item.summary || '',
        description: item.description || item.Description,
        startTime: item.startTime || item.start_time || item['Start time'],
        endTime: item.endTime || item.end_time || item['End time'],
        timezone: item.timezone || item.Timezone || item.timeZone,
        attendees: Array.isArray(item.attendees) ? item.attendees : (item.Attendees ? (Array.isArray(item.Attendees) ? item.Attendees : []) : []),
        status: item.status || item.Status,
        references: Array.isArray(item.references) ? item.references : undefined,
        missingInfo: Array.isArray(item.missing_info) ? item.missing_info : undefined,
      })).filter(item => item.title && item.title.trim());
    }
  }
  
  // If it's already an array of CalendarEvent objects, return as-is
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && (value[0].title || value[0].Title)) {
    return value.map(item => ({
      title: item.title || item.Title || item.summary || '',
      description: item.description || item.Description,
      startTime: item.startTime || item.start_time || item['Start time'],
      endTime: item.endTime || item.end_time || item['End time'],
      timezone: item.timezone || item.Timezone || item.timeZone,
      attendees: Array.isArray(item.attendees) ? item.attendees : (item.Attendees ? (Array.isArray(item.Attendees) ? item.Attendees : []) : []),
      status: item.status || item.Status,
      references: Array.isArray(item.references) ? item.references : undefined,
      missingInfo: Array.isArray(item.missing_info) ? item.missing_info : undefined,
    }));
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    const parsedJson = tryParseJson(valueStr);
    if (parsedJson) {
      return parseCalendarEvents(parsedJson);
    }
  }
  
  // If it's an array, parse each item
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') {
        let itemStr = item.trim();
        
        // Strip markdown if present
        if (itemStr.includes('```')) {
          itemStr = stripMarkdown(itemStr);
        }
        
        // If it looks like JSON, parse it
        if (itemStr.startsWith('{') || itemStr.startsWith('[')) {
          try {
            const parsed = JSON.parse(itemStr);
            return {
              title: parsed.title || parsed.Title || parsed.summary || '',
              description: parsed.description || parsed.Description,
              startTime: parsed.startTime || parsed.start_time || parsed['Start time'],
              endTime: parsed.endTime || parsed.end_time || parsed['End time'],
              timezone: parsed.timezone || parsed.Timezone || parsed.timeZone,
              attendees: Array.isArray(parsed.attendees) ? parsed.attendees : (parsed.Attendees ? (Array.isArray(parsed.Attendees) ? parsed.Attendees : []) : []),
              status: parsed.status || parsed.Status,
              references: Array.isArray(parsed.references) ? parsed.references : undefined,
              missingInfo: Array.isArray(parsed.missing_info) ? parsed.missing_info : undefined,
            };
          } catch {
            // If parsing fails, try regex extraction
            const titleMatch = itemStr.match(/"title"\s*:\s*"([^"]+)"/i);
            const descMatch = itemStr.match(/"description"\s*:\s*"([^"]+)"/i);
            
            return {
              title: titleMatch ? titleMatch[1] : itemStr,
              description: descMatch ? descMatch[1] : undefined,
            };
          }
        }
        
        return { title: itemStr };
      }
      
      // If it's an object, extract fields
      if (typeof item === 'object' && item !== null) {
        return {
          title: item.title || item.Title || item.summary || '',
          description: item.description || item.Description,
          startTime: item.startTime || item.start_time || item['Start time'],
          endTime: item.endTime || item.end_time || item['End time'],
          timezone: item.timezone || item.Timezone || item.timeZone,
          attendees: Array.isArray(item.attendees) ? item.attendees : (item.Attendees ? (Array.isArray(item.Attendees) ? item.Attendees : []) : []),
          status: item.status || item.Status,
          references: Array.isArray(item.references) ? item.references : undefined,
          missingInfo: Array.isArray(item.missing_info) ? item.missing_info : undefined,
        };
      }
      
      return { title: String(item) };
    }).filter(item => item.title && item.title.trim());
  }
  
  return [];
};

/**
 * Parses email data - extracts reason, recipients, subject, body, and references
 */
const formatReference = (ref: any): string => {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object') {
    const speaker = ref.speaker || ref.Speaker || '';
    const timestamp = ref.timestamp || ref.Timestamp || ref.time || '';
    const text = ref.text || ref.Text || ref.message || ref.content || '';
    const parts = [speaker, timestamp && `(${timestamp})`, text].filter(Boolean);
    return parts.join(' ').trim();
  }
  return String(ref);
};

const parseEmails = (value: any): EmailData[] => {
  if (!value) return [];

  const parsedFromArray = tryParseJsonFromArray(value);
  if (parsedFromArray) {
    return parseEmails(parsedFromArray);
  }
  
  // If value is a string with multiple JSON objects (multiple email drafts), take the first one
  if (typeof value === 'string') {
    // Check if it contains multiple JSON objects
    const jsonMatches = value.match(/```json\s*([\s\S]*?)```/g);
    if (jsonMatches && jsonMatches.length > 0) {
      // Parse the first email draft
      try {
        const firstJson = jsonMatches[0];
        const cleaned = stripMarkdown(firstJson);
        const parsed = JSON.parse(cleaned);
        return parseEmails(parsed);
      } catch {
        // Continue to other parsing methods
      }
    }

    const parsedJson = tryParseJson(value);
    if (parsedJson) {
      return parseEmails(parsedJson);
    }
  }
  
  // If it's an array of email drafts, take the first one
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item: any) => parseEmails(item)).flat();
  }
  
  // If it's already an EmailData object, return as-is
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (value.allEmails && Array.isArray(value.allEmails)) {
      return value.allEmails.map((item: any) => ({
        reason: item.reason || item.Reason,
        recipients: Array.isArray(item.recipients || item.Recipients) ? (item.recipients || item.Recipients) : [],
        subject: item.subject || item.Subject || item.SubjectLine,
        body: item.body || item.Body || item.text || item.content || '',
        references: Array.isArray(item.references || item.References)
          ? (item.references || item.References).map(formatReference).filter(Boolean)
          : undefined,
      })).filter(item => item.body && item.body.trim());
    }

    // Parse references if they exist
    let references: string[] | undefined;
    if (value.references || value.References) {
      const refs = value.references || value.References;
      if (Array.isArray(refs)) {
        references = refs.map(formatReference).filter(Boolean);
      }
    }
    
    return [{
      reason: value.reason || value.Reason,
      recipients: Array.isArray(value.recipients) ? value.recipients : (value.recipients ? [value.recipients] : []),
      subject: value.subject || value.Subject || value.SubjectLine,
      body: value.body || value.Body || value.text || value.content || '',
      references: references,
    }];
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    const parsedJson = tryParseJson(valueStr);
    if (parsedJson) {
      return parseEmails(parsedJson);
    }
    
    // If it's just a plain string, treat it as the body
    return [{ body: valueStr }];
  }
  
  // If it's an object, extract fields
  if (typeof value === 'object' && value !== null) {
    return parseEmails(value);
  }
  
  return [{ body: String(value) }];
};

/**
 * Main helper function to parse raw analysis results and return formatted data for each card
 * 
 * @param rawResults - Raw analysis results from the API (may contain JSON strings)
 * @returns Formatted analysis results with structured data for each card
 */
export const parseAnalysisResults = (rawResults: RawAnalysisResults): AnalysisResults => {
  return {
    summary: parseSummary(rawResults.summary),
    nextTasks: parseTasks(rawResults.nextTasks),
    email: parseEmails(rawResults.email),
    calendar: parseCalendarEvents(rawResults.calendar),
    blockers: parseBlockers(rawResults.blockers),
  };
};
