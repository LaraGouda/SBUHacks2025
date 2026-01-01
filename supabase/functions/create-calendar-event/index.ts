import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, summary, description, startTime, endTime, timezone, attendees, location } = await req.json();

    if (!accessToken || !summary) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event: Record<string, unknown> = {
      summary,
      description: description || '',
      start: {
        dateTime: startTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime || new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (location && typeof location === 'string' && location.trim()) {
      event.location = location.trim();
    }

    if (Array.isArray(attendees)) {
      const attendeeList = attendees
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
      if (attendeeList.length > 0) {
        event.attendees = attendeeList.map((email) => ({ email }));
      }
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to create calendar event');
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ success: true, eventId: data.id, htmlLink: data.htmlLink }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
