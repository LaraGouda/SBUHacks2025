export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      oauth_tokens: {
        Row: {
          id: string
          user_id: string
          provider: string
          access_token: string
          refresh_token: string | null
          expires_at: string
          scope: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: string
          access_token: string
          refresh_token?: string | null
          expires_at: string
          scope?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          access_token?: string
          refresh_token?: string | null
          expires_at?: string
          scope?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          user_id: string
          title: string
          transcript: string
          summary: string | null
          status: 'pending' | 'analyzing' | 'analyzed' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          transcript: string
          summary?: string | null
          status?: 'pending' | 'analyzing' | 'analyzed' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          transcript?: string
          summary?: string | null
          status?: 'pending' | 'analyzing' | 'analyzed' | 'failed'
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          meeting_id: string | null
          user_id: string
          description: string
          completed: boolean
          completed_at: string | null
          priority: 'low' | 'normal' | 'high' | 'urgent'
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id?: string | null
          user_id: string
          description: string
          completed?: boolean
          completed_at?: string | null
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string | null
          user_id?: string
          description?: string
          completed?: boolean
          completed_at?: string | null
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      email_drafts: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          subject: string | null
          body: string
          recipient: string | null
          status: 'draft' | 'sent' | 'scheduled'
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          subject?: string | null
          body: string
          recipient?: string | null
          status?: 'draft' | 'sent' | 'scheduled'
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          subject?: string | null
          body?: string
          recipient?: string | null
          status?: 'draft' | 'sent' | 'scheduled'
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calendar_events: {
        Row: {
          id: string
          meeting_id: string | null
          user_id: string
          title: string
          description: string | null
          start_time: string
          end_time: string
          timezone: string | null
          location: string | null
          google_event_id: string | null
          status: 'pending' | 'created' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id?: string | null
          user_id: string
          title: string
          description?: string | null
          start_time: string
          end_time: string
          timezone?: string | null
          location?: string | null
          google_event_id?: string | null
          status?: 'pending' | 'created' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string | null
          user_id?: string
          title?: string
          description?: string | null
          start_time?: string
          end_time?: string
          timezone?: string | null
          location?: string | null
          google_event_id?: string | null
          status?: 'pending' | 'created' | 'failed'
          created_at?: string
          updated_at?: string
        }
      }
      blockers: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          description: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          resolved: boolean
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          description: string
          severity?: 'low' | 'medium' | 'high' | 'critical'
          resolved?: boolean
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_id?: string
          description?: string
          severity?: 'low' | 'medium' | 'high' | 'critical'
          resolved?: boolean
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_dashboard_stats: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      save_meeting_analysis: {
        Args: {
          p_user_id: string
          p_title: string
          p_transcript: string
          p_summary: string | null
          p_tasks: Json | null
          p_email_subject: string | null
          p_email_body: string | null
          p_calendar_events: Json | null
          p_blockers: Json | null
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
