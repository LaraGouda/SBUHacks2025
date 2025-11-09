/**
 * Helper function to parse JSON analysis results and convert them to human-readable text
 * for display in the ResultsDisplay component cards.
 */

// Type definitions for each card type
export interface TaskItem {
  task: string;
  rationale?: string;
  priority?: string;
}

export interface BlockerItem {
  description: string;
  quote?: string;
  timestamp?: string;
}

export interface CalendarEvent {
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  attendees?: string[];
  status?: string;
}

export interface EmailData {
  reason?: string;
  recipients?: string[];
  subject?: string;
  body: string;
  references?: Array<{ speaker: string; text: string; timestamp: string }>;
}

export interface AnalysisResults {
  summary: string;
  nextTasks: TaskItem[];
  email: EmailData;
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

/**
 * Parses a JSON string to extract readable text for summary
 */
const parseSummary = (value: any): string => {
  if (!value) return "No summary generated";
  
  // If it's an object, check for display_text first
  if (typeof value === 'object' && value !== null) {
    if (value.display_text || value.displayText) {
      return value.display_text || value.displayText;
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
          return summaryObj.display_text || summaryObj.displayText;
        }
        if (summaryObj.meeting_summary) {
          const innerSummary = summaryObj.meeting_summary;
          let summaryText = innerSummary.summary || innerSummary.text || '';
          
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
              .join('\n');
            if (decisions) {
              summaryText += '\n\n' + decisions;
            }
          }
          
          return summaryText || String(value);
        }
      }
    }
    
    if (value.summary) return value.summary;
    if (value.text) return value.text;
  }
  
  if (typeof value === 'string') {
    let trimmed = value.trim();
    
    // Strip markdown code blocks first
    if (trimmed.includes('```')) {
      trimmed = stripMarkdown(trimmed);
    }
    
    // If it looks like JSON, try to parse it
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseSummary(parsed);
      } catch {
        // If parsing fails, return as-is
      }
    }
    
    return trimmed;
  }
  
  return String(value);
};

/**
 * Parses tasks array - extracts task, rationale, and priority
 */
const parseTasks = (value: any): TaskItem[] => {
  if (!value) return [];
  
  // If value has display_text but we need structured data, parse the nested JSON
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Check if it has a nested structure like { next_steps: [...], display_text: "..." }
    if (value.next_steps || value.nextSteps) {
      const steps = value.next_steps || value.nextSteps;
      if (Array.isArray(steps)) {
        return steps.map((item: any) => ({
          task: item.task || item.item || item.description || '',
          rationale: item.rationale,
          priority: item.priority,
        })).filter(item => item.task && item.task.trim());
      }
    }
    
    // If it's a string with markdown code blocks, parse it
    if (typeof value === 'string' && value.includes('```')) {
      const trimmed = stripMarkdown(value);
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return parseTasks(parsed);
        } catch {
          // Continue to other parsing methods
        }
      }
    }
  }
  
  // If it's already an array of TaskItem objects, return as-is
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].task) {
    return value.map(item => ({
      task: item.task || '',
      rationale: item.rationale,
      priority: item.priority,
    }));
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    // Strip markdown if present
    if (valueStr.includes('```')) {
      valueStr = stripMarkdown(valueStr);
    }
    
    // If it looks like JSON, parse it
    if (valueStr.startsWith('[') || valueStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(valueStr);
        // Check if parsed has next_steps array
        if (parsed.next_steps || parsed.nextSteps) {
          const steps = parsed.next_steps || parsed.nextSteps;
          if (Array.isArray(steps)) {
            return steps.map((item: any) => ({
              task: item.task || item.item || item.description || '',
              rationale: item.rationale,
              priority: item.priority,
            })).filter(item => item.task && item.task.trim());
          }
        }
        // If it's directly an array, parse it
        if (Array.isArray(parsed)) {
          return parseTasks(parsed);
        }
        return parseTasks(parsed);
      } catch {
        // If parsing fails, try to extract from string
      }
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
              rationale: parsed.rationale,
              priority: parsed.priority,
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
          task: item.task || item.item || item.description || '',
          rationale: item.rationale,
          priority: item.priority,
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
  
  // If value is a string with human-readable text at the end, extract blockers from structured data
  if (typeof value === 'string') {
    // Check if it contains structured JSON before the human-readable text
    const jsonMatch = value.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(stripMarkdown(jsonMatch[1]));
        return parseBlockers(parsed);
      } catch {
        // Continue to other parsing methods
      }
    }
  }
  
  // If it's an object with nested structures
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Check for open_questions, uncertainties, risks, blockers arrays
    const allBlockers: BlockerItem[] = [];
    
    if (value.open_questions && Array.isArray(value.open_questions)) {
      allBlockers.push(...value.open_questions.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
      })));
    }
    
    if (value.uncertainties && Array.isArray(value.uncertainties)) {
      allBlockers.push(...value.uncertainties.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
      })));
    }
    
    if (value.risks && Array.isArray(value.risks)) {
      allBlockers.push(...value.risks.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
      })));
    }
    
    if (value.blockers && Array.isArray(value.blockers)) {
      allBlockers.push(...value.blockers.map((item: any) => ({
        description: item.description || '',
        quote: item.quote,
        timestamp: item.timestamp,
      })));
    }
    
    if (allBlockers.length > 0) {
      return allBlockers.filter(item => item.description && item.description.trim());
    }
  }
  
  // If it's already an array of BlockerItem objects, return as-is
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].description) {
    return value.map(item => ({
      description: item.description || '',
      quote: item.quote,
      timestamp: item.timestamp,
    }));
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    // Strip markdown if present
    if (valueStr.includes('```')) {
      valueStr = stripMarkdown(valueStr);
    }
    
    // If it looks like JSON, parse it
    if (valueStr.startsWith('[') || valueStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(valueStr);
        return parseBlockers(parsed);
      } catch {
        // If parsing fails, try to extract from string
      }
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
              description: parsed.description || parsed.text || '',
              quote: parsed.quote,
              timestamp: parsed.timestamp,
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
          description: item.description || item.text || '',
          quote: item.quote,
          timestamp: item.timestamp,
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
  
  // If value is a string with markdown code blocks, parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    // Strip markdown if present
    if (valueStr.includes('```')) {
      valueStr = stripMarkdown(valueStr);
    }
    
    // If it looks like JSON, parse it
    if (valueStr.startsWith('[') || valueStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(valueStr);
        return parseCalendarEvents(parsed);
      } catch {
        // Continue to other parsing methods
      }
    }
  }
  
  // If it's an object with nested events array
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (value.events && Array.isArray(value.events)) {
      return value.events.map((item: any) => ({
        title: item.title || item.Title || item.summary || '',
        description: item.description || item.Description,
        startTime: item.startTime || item.start_time || item['Start time'],
        endTime: item.endTime || item.end_time || item['End time'],
        timezone: item.timezone || item.Timezone || item.timeZone,
        attendees: Array.isArray(item.attendees) ? item.attendees : (item.Attendees ? (Array.isArray(item.Attendees) ? item.Attendees : []) : []),
        status: item.status || item.Status,
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
    }));
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    // Strip markdown if present
    if (valueStr.includes('```')) {
      valueStr = stripMarkdown(valueStr);
    }
    
    // If it looks like JSON, parse it
    if (valueStr.startsWith('[') || valueStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(valueStr);
        return parseCalendarEvents(parsed);
      } catch {
        // If parsing fails, try to extract from string
      }
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
const parseEmail = (value: any): EmailData => {
  if (!value) return { body: '' };
  
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
        return parseEmail(parsed);
      } catch {
        // Continue to other parsing methods
      }
    }
  }
  
  // If it's an array of email drafts, take the first one
  if (Array.isArray(value) && value.length > 0) {
    return parseEmail(value[0]);
  }
  
  // If it's already an EmailData object, return as-is
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Parse references if they exist
    let references: Array<{ speaker: string; text: string; timestamp: string }> | undefined;
    if (value.references || value.References) {
      const refs = value.references || value.References;
      if (Array.isArray(refs)) {
        references = refs.map((ref: any) => {
          if (typeof ref === 'string') {
            // Try to parse string reference (e.g., "Sam (01:40): Right, I'll email Finance...")
            const match = ref.match(/^([^(]+)\s*\(([^)]+)\):\s*(.+)$/);
            if (match) {
              return {
                speaker: match[1].trim(),
                timestamp: match[2].trim(),
                text: match[3].trim(),
              };
            }
            // Try format without text: "Sam (01:40)"
            const simpleMatch = ref.match(/^([^(]+)\s*\(([^)]+)\)$/);
            if (simpleMatch) {
              return {
                speaker: simpleMatch[1].trim(),
                timestamp: simpleMatch[2].trim(),
                text: '',
              };
            }
            return {
              speaker: '',
              timestamp: '',
              text: ref,
            };
          }
          return {
            speaker: ref.speaker || ref.Speaker || '',
            timestamp: ref.timestamp || ref.Timestamp || ref.time || '',
            text: ref.text || ref.Text || ref.message || ref.content || '',
          };
        });
      }
    }
    
    return {
      reason: value.reason || value.Reason,
      recipients: Array.isArray(value.recipients) ? value.recipients : (value.recipients ? [value.recipients] : []),
      subject: value.subject || value.Subject,
      body: value.body || value.Body || value.text || value.content || '',
      references: references,
    };
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    let valueStr = value.trim();
    
    // Strip markdown if present
    if (valueStr.includes('```')) {
      valueStr = stripMarkdown(valueStr);
    }
    
    // If it looks like JSON, parse it
    if (valueStr.startsWith('{') || valueStr.startsWith('[')) {
      try {
        const parsed = JSON.parse(valueStr);
        // Parse references if they exist
        let references: Array<{ speaker: string; text: string; timestamp: string }> | undefined;
        if (parsed.references || parsed.References) {
          const refs = parsed.references || parsed.References;
          if (Array.isArray(refs)) {
            references = refs.map((ref: any) => {
              if (typeof ref === 'string') {
                // Try to parse string reference (e.g., "Sam (01:40): Right, I'll email Finance...")
                const match = ref.match(/^([^(]+)\s*\(([^)]+)\):\s*(.+)$/);
                if (match) {
                  return {
                    speaker: match[1].trim(),
                    timestamp: match[2].trim(),
                    text: match[3].trim(),
                  };
                }
                return {
                  speaker: '',
                  timestamp: '',
                  text: ref,
                };
              }
              return {
                speaker: ref.speaker || ref.Speaker || '',
                timestamp: ref.timestamp || ref.Timestamp || ref.time || '',
                text: ref.text || ref.Text || ref.message || ref.content || '',
              };
            });
          }
        }
        
        return {
          reason: parsed.reason || parsed.Reason,
          recipients: Array.isArray(parsed.recipients) ? parsed.recipients : (parsed.recipients ? [parsed.recipients] : []),
          subject: parsed.subject || parsed.Subject,
          body: parsed.body || parsed.Body || parsed.text || parsed.content || '',
          references: references,
        };
      } catch {
        // If parsing fails, try to extract from string
        const bodyMatch = valueStr.match(/"body"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/s);
        const subjectMatch = valueStr.match(/"subject"\s*:\s*"([^"]+)"/i);
        const reasonMatch = valueStr.match(/"reason"\s*:\s*"([^"]+)"/i);
        
        return {
          reason: reasonMatch ? reasonMatch[1] : undefined,
          recipients: [],
          subject: subjectMatch ? subjectMatch[1] : undefined,
          body: bodyMatch ? bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'") : valueStr,
          references: undefined,
        };
      }
    }
    
    // If it's just a plain string, treat it as the body
    return { body: valueStr };
  }
  
  // If it's an object, extract fields
  if (typeof value === 'object' && value !== null) {
    // Parse references if they exist
    let references: Array<{ speaker: string; text: string; timestamp: string }> | undefined;
    if (value.references || value.References) {
      const refs = value.references || value.References;
      if (Array.isArray(refs)) {
        references = refs.map((ref: any) => {
          if (typeof ref === 'string') {
            // Try to parse string reference (e.g., "Sam (01:40): Right, I'll email Finance...")
            const match = ref.match(/^([^(]+)\s*\(([^)]+)\):\s*(.+)$/);
            if (match) {
              return {
                speaker: match[1].trim(),
                timestamp: match[2].trim(),
                text: match[3].trim(),
              };
            }
            return {
              speaker: '',
              timestamp: '',
              text: ref,
            };
          }
          return {
            speaker: ref.speaker || ref.Speaker || '',
            timestamp: ref.timestamp || ref.Timestamp || ref.time || '',
            text: ref.text || ref.Text || ref.message || ref.content || '',
          };
        });
      }
    }
    
    return {
      reason: value.reason || value.Reason,
      recipients: Array.isArray(value.recipients) ? value.recipients : (value.recipients ? [value.recipients] : []),
      subject: value.subject || value.Subject,
      body: value.body || value.Body || value.text || value.content || '',
      references: references,
    };
  }
  
  return { body: String(value) };
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
    email: parseEmail(rawResults.email),
    calendar: parseCalendarEvents(rawResults.calendar),
    blockers: parseBlockers(rawResults.blockers),
  };
};
