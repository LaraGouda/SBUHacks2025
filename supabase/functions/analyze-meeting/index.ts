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
  nextTasks: Array<{ description: string }>;
  email: { subject: string; body: string };
  calendar: Array<{ title: string; description: string; start_time: string; end_time: string }>;
  blockers: Array<{ description: string; severity: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Verify user session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transcript, title } = await req.json();
    
    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const neuralseekApiKey = Deno.env.get('NEURALSEEK_API_KEY');
    const neuralseekBaseUrl = Deno.env.get('NEURALSEEK_BASE_URL') || 'https://stagingapi.neuralseek.com';
    const neuralseekWorkspace = Deno.env.get('NEURALSEEK_WORKSPACE') || 'stony52';
    
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
      `${neuralseekBaseUrl}/v1/${neuralseekWorkspace}/maistro`,
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
    let nextTasks: Array<{ description: string }> = [];
    let email = { subject: '', body: '' };
    let calendarEvents: Array<{ title: string; description: string; start_time: string; end_time: string }> = [];
    let blockers: Array<{ description: string; severity: string }> = [];

    // Extract data from BigAgent response
    if (bigAgentData.answer) {
      const answer = bigAgentData.answer;
      
      // Try to parse structured output
      try {
        const parsed = typeof answer === 'string' ? JSON.parse(answer) : answer;
        
        summary = parsed.summary || parsed.meetingSummary || '';
        
        // Parse tasks
        if (parsed.nextTasks || parsed.actionItems) {
          const tasks = parsed.nextTasks || parsed.actionItems;
          if (Array.isArray(tasks)) {
            nextTasks = tasks.map((t: string) => ({ description: t }));
          } else if (typeof tasks === 'string') {
            nextTasks = tasks.split('\n').filter((t: string) => t.trim()).map((t: string) => ({ description: t }));
          }
        }
        
        // Parse email
        if (parsed.emailDraft || parsed.email) {
          const emailData = parsed.emailDraft || parsed.email;
          if (typeof emailData === 'string') {
            email.body = emailData;
            email.subject = parsed.emailSubject || 'Meeting Follow-up';
          } else if (typeof emailData === 'object') {
            email = {
              subject: emailData.subject || parsed.emailSubject || 'Meeting Follow-up',
              body: emailData.body || emailData.text || ''
            };
          }
        }
        
        // Parse calendar events
        if (parsed.calendarEvents || parsed.calendar) {
          const events = parsed.calendarEvents || parsed.calendar;
          if (Array.isArray(events)) {
            calendarEvents = events.map((e: any) => ({
              title: e.title || e.summary || 'Meeting Follow-up',
              description: e.description || '',
              start_time: e.start_time || e.start || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              end_time: e.end_time || e.end || new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
            }));
          }
        }
        
        // Parse blockers
        if (parsed.blockers || parsed.issues) {
          const blockerList = parsed.blockers || parsed.issues;
          if (Array.isArray(blockerList)) {
            blockers = blockerList.map((b: string | any) => ({
              description: typeof b === 'string' ? b : b.description || b.text || '',
              severity: typeof b === 'object' ? (b.severity || 'medium') : 'medium'
            }));
          } else if (typeof blockerList === 'string') {
            blockers = blockerList.split('\n').filter((b: string) => b.trim()).map((b: string) => ({
              description: b,
              severity: 'medium'
            }));
          }
        }
      } catch (e) {
        console.log('BigAgent returned unstructured response, parsing text...');
        summary = answer;
      }
    }

    // If BigAgent didn't return structured data, call individual agents
    if (!summary || nextTasks.length === 0) {
      console.log('Calling individual NeuralSeek agents...');
      
      const neuralseekApiUrl = `${neuralseekBaseUrl}/v1/${neuralseekWorkspace}/maistro`;
      const [summaryRes, tasksRes, emailRes, calendarRes, blockersRes] = await Promise.all([
        fetch(neuralseekApiUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpSummarizer', params: { meetingTranscript: transcript } }),
        }),
        fetch(neuralseekApiUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpNextTasks', params: { meetingTranscript: transcript } }),
        }),
        fetch(neuralseekApiUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpEmail', params: { meetingTranscript: transcript } }),
        }),
        fetch(neuralseekApiUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpCalendar', params: { meetingTranscript: transcript } }),
        }),
        fetch(neuralseekApiUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${neuralseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'FollowUpBlockers', params: { meetingTranscript: transcript } }),
        }),
      ]);

      const [summaryData, tasksData, emailData, calendarData, blockersData] = await Promise.all([
        summaryRes.json(),
        tasksRes.json(),
        emailRes.json(),
        calendarRes.json(),
        blockersRes.json(),
      ]);

      summary = summaryData.answer || summary;
      
      // Parse tasks
      if (tasksData.answer) {
        if (Array.isArray(tasksData.answer)) {
          nextTasks = tasksData.answer.map((t: string) => ({ description: t }));
        } else {
          nextTasks = tasksData.answer.split('\n').filter((t: string) => t.trim()).map((t: string) => ({ description: t }));
        }
      }
      
      // Parse email
      if (emailData.answer) {
        email.body = emailData.answer;
        email.subject = 'Meeting Follow-up';
      }
      
      // Parse calendar events
      if (calendarData.answer) {
        if (Array.isArray(calendarData.answer)) {
          calendarEvents = calendarData.answer.map((e: any) => ({
            title: e.title || 'Meeting Follow-up',
            description: e.description || '',
            start_time: e.start_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            end_time: e.end_time || new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
          }));
        } else {
          calendarEvents = calendarData.answer.split('\n').filter((e: string) => e.trim()).map((e: string) => ({
            title: e,
            description: '',
            start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
          }));
        }
      }
      
      // Parse blockers
      if (blockersData.answer) {
        if (Array.isArray(blockersData.answer)) {
          blockers = blockersData.answer.map((b: string) => ({
            description: b,
            severity: 'medium'
          }));
        } else {
          blockers = blockersData.answer.split('\n').filter((b: string) => b.trim()).map((b: string) => ({
            description: b,
            severity: 'medium'
          }));
        }
      }
    }

    // Save analysis results to database using the function
    const { data: savedMeetingId, error: saveError } = await supabase.rpc('save_meeting_analysis', {
      p_user_id: user.id,
      p_title: meetingTitle,
      p_transcript: transcript,
      p_summary: summary || null,
      p_tasks: nextTasks.length > 0 ? nextTasks : null,
      p_email_subject: email.subject || null,
      p_email_body: email.body || null,
      p_calendar_events: calendarEvents.length > 0 ? calendarEvents : null,
      p_blockers: blockers.length > 0 ? blockers : null
    });

    if (saveError) {
      console.error('Error saving analysis:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save analysis results', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analysis complete');

    return new Response(
      JSON.stringify({
        meetingId: savedMeetingId,
        summary,
        nextTasks: nextTasks.map(t => t.description),
        email: email.body,
        calendar: calendarEvents.map(e => e.title),
        blockers: blockers.map(b => b.description),
      }),
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
