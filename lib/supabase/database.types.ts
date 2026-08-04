export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_calls: {
        Row: {
          cache_read_tokens: number
          concept_id: string | null
          cost_inr: number
          created_at: string
          error: string | null
          id: string
          input_tokens: number
          kind: string
          latency_ms: number | null
          lesson_id: string | null
          model: string
          ok: boolean
          output_tokens: number
          student_id: string | null
          ttft_ms: number | null
        }
        Insert: {
          cache_read_tokens?: number
          concept_id?: string | null
          cost_inr?: number
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number
          kind: string
          latency_ms?: number | null
          lesson_id?: string | null
          model: string
          ok?: boolean
          output_tokens?: number
          student_id?: string | null
          ttft_ms?: number | null
        }
        Update: {
          cache_read_tokens?: number
          concept_id?: string | null
          cost_inr?: number
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number
          kind?: string
          latency_ms?: number | null
          lesson_id?: string | null
          model?: string
          ok?: boolean
          output_tokens?: number
          student_id?: string | null
          ttft_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          concept_id: string
          created_at: string
          given_answer: string
          hints_used: number
          id: string
          is_correct: boolean
          ms_taken: number | null
          question_id: string
          quiz_session_id: string | null
          session_kind: string
          student_id: string
          submission_id: string | null
        }
        Insert: {
          concept_id: string
          created_at?: string
          given_answer: string
          hints_used?: number
          id?: string
          is_correct: boolean
          ms_taken?: number | null
          question_id: string
          quiz_session_id?: string | null
          session_kind: string
          student_id: string
          submission_id?: string | null
        }
        Update: {
          concept_id?: string
          created_at?: string
          given_answer?: string
          hints_used?: number
          id?: string
          is_correct?: boolean
          ms_taken?: number | null
          question_id?: string
          quiz_session_id?: string | null
          session_kind?: string
          student_id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          grade: number
          i18n: Json
          id: string
          ncert_ref: string | null
          number: number
          order_index: number
          slug: string
          summary: string | null
          title: string
        }
        Insert: {
          grade: number
          i18n?: Json
          id?: string
          ncert_ref?: string | null
          number: number
          order_index?: number
          slug: string
          summary?: string | null
          title: string
        }
        Update: {
          grade?: number
          i18n?: Json
          id?: string
          ncert_ref?: string | null
          number?: number
          order_index?: number
          slug?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      concept_mastery: {
        Row: {
          attempts_count: number
          concept_id: string
          is_mastered: boolean
          score: number
          student_id: string
          updated_at: string
        }
        Insert: {
          attempts_count?: number
          concept_id: string
          is_mastered?: boolean
          score?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          attempts_count?: number
          concept_id?: string
          is_mastered?: boolean
          score?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_mastery_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_mastery_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          chapter_id: string
          i18n: Json
          id: string
          name: string
          order_index: number
          slug: string
        }
        Insert: {
          chapter_id: string
          i18n?: Json
          id?: string
          name: string
          order_index?: number
          slug: string
        }
        Update: {
          chapter_id?: string
          i18n?: Json
          id?: string
          name?: string
          order_index?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          props: Json
          student_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          props?: Json
          student_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          props?: Json
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_reasons: {
        Row: {
          created_at: string
          id: string
          locale: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          locale?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string | null
          reason?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          lesson_id: string
          started_at: string
          status: string
          student_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lesson_id: string
          started_at?: string
          status?: string
          student_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          lesson_id?: string
          started_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body_md: string
          chapter_id: string
          concept_id: string
          est_minutes: number
          i18n: Json
          id: string
          order_index: number
          slug: string | null
          steps: Json | null
          title: string
        }
        Insert: {
          body_md: string
          chapter_id: string
          concept_id: string
          est_minutes?: number
          i18n?: Json
          id?: string
          order_index?: number
          slug?: string | null
          steps?: Json | null
          title: string
        }
        Update: {
          body_md?: string
          chapter_id?: string
          concept_id?: string
          est_minutes?: number
          i18n?: Json
          id?: string
          order_index?: number
          slug?: string | null
          steps?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_requests: {
        Row: {
          concept_id: string | null
          context: Json
          created_at: string
          id: string
          learner_note: string | null
          status: string
          student_id: string
          trigger: string
        }
        Insert: {
          concept_id?: string | null
          context?: Json
          created_at?: string
          id?: string
          learner_note?: string | null
          status?: string
          student_id: string
          trigger: string
        }
        Update: {
          concept_id?: string | null
          context?: Json
          created_at?: string
          id?: string
          learner_note?: string | null
          status?: string
          student_id?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_requests_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          code: string
          context: Json
          earned_at: string
          id: string
          student_id: string
        }
        Insert: {
          code: string
          context?: Json
          earned_at?: string
          id?: string
          student_id: string
        }
        Update: {
          code?: string
          context?: Json
          earned_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_links: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          link_code: string
          parent_id: string | null
          status: string
          student_id: string
          whatsapp_e164: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          link_code: string
          parent_id?: string | null
          status?: string
          student_id: string
          whatsapp_e164?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          link_code?: string
          parent_id?: string | null
          status?: string
          student_id?: string
          whatsapp_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_summaries: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          id: string
          opened_at: string | null
          parent_link_id: string | null
          payload: Json
          summary_link_id: string | null
          tracking_token: string | null
          week_start: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          opened_at?: string | null
          parent_link_id?: string | null
          payload?: Json
          summary_link_id?: string | null
          tracking_token?: string | null
          week_start: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          opened_at?: string | null
          parent_link_id?: string | null
          payload?: Json
          summary_link_id?: string | null
          tracking_token?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_summaries_parent_link_id_fkey"
            columns: ["parent_link_id"]
            isOneToOne: false
            referencedRelation: "parent_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_summaries_summary_link_id_fkey"
            columns: ["summary_link_id"]
            isOneToOne: false
            referencedRelation: "summary_links"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feedback: {
        Row: {
          confusing: string | null
          created_at: string
          id: string
          improve_most: string | null
          locale: string
          respondent_role: string
          understood: string
          updated_at: string
          user_id: string
          worked_well: string | null
          would_return: string
        }
        Insert: {
          confusing?: string | null
          created_at?: string
          id?: string
          improve_most?: string | null
          locale?: string
          respondent_role: string
          understood: string
          updated_at?: string
          user_id: string
          worked_well?: string | null
          would_return: string
        }
        Update: {
          confusing?: string | null
          created_at?: string
          id?: string
          improve_most?: string | null
          locale?: string
          respondent_role?: string
          understood?: string
          updated_at?: string
          user_id?: string
          worked_well?: string | null
          would_return?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          grade: number | null
          id: string
          locale: string
          role: string
          timezone: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id: string
          locale?: string
          role: string
          timezone?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id?: string
          locale?: string
          role?: string
          timezone?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer_type: string
          answer_value: string
          chapter_id: string
          choices: Json | null
          concept_id: string
          created_at: string
          difficulty: number
          i18n: Json
          id: string
          input: Json | null
          kind: string
          slug: string | null
          solution_md: string
          stem_md: string
          stem_viz: Json | null
        }
        Insert: {
          answer_type: string
          answer_value: string
          chapter_id: string
          choices?: Json | null
          concept_id: string
          created_at?: string
          difficulty: number
          i18n?: Json
          id?: string
          input?: Json | null
          kind: string
          slug?: string | null
          solution_md: string
          stem_md: string
          stem_viz?: Json | null
        }
        Update: {
          answer_type?: string
          answer_value?: string
          chapter_id?: string
          choices?: Json | null
          concept_id?: string
          created_at?: string
          difficulty?: number
          i18n?: Json
          id?: string
          input?: Json | null
          kind?: string
          slug?: string | null
          solution_md?: string
          stem_md?: string
          stem_viz?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          chapter_id: string
          id: string
          mastery_band: string | null
          question_ids: string[] | null
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
          total: number | null
        }
        Insert: {
          chapter_id: string
          id?: string
          mastery_band?: string | null
          question_ids?: string[] | null
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
          total?: number | null
        }
        Update: {
          chapter_id?: string
          id?: string
          mastery_band?: string | null
          question_ids?: string[] | null
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          current: number
          grace_used_on: string | null
          last_active_date: string | null
          longest: number
          student_id: string
          updated_at: string
        }
        Insert: {
          current?: number
          grace_used_on?: string | null
          last_active_date?: string | null
          longest?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          current?: number
          grace_used_on?: string | null
          last_active_date?: string | null
          longest?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      summary_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_sent_at: string | null
          last_viewed_at: string | null
          recipient_e164: string | null
          recipient_opted_in_at: string | null
          revoked_at: string | null
          student_id: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          last_sent_at?: string | null
          last_viewed_at?: string | null
          recipient_e164?: string | null
          recipient_opted_in_at?: string | null
          revoked_at?: string | null
          student_id: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_sent_at?: string | null
          last_viewed_at?: string | null
          recipient_e164?: string | null
          recipient_opted_in_at?: string | null
          revoked_at?: string | null
          student_id?: string
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "summary_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_feedback: {
        Row: {
          created_at: string
          helpful: boolean
          id: string
          student_id: string
          tutor_message_id: string
        }
        Insert: {
          created_at?: string
          helpful: boolean
          id?: string
          student_id: string
          tutor_message_id: string
        }
        Update: {
          created_at?: string
          helpful?: boolean
          id?: string
          student_id?: string
          tutor_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_feedback_tutor_message_id_fkey"
            columns: ["tutor_message_id"]
            isOneToOne: false
            referencedRelation: "tutor_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string | null
          role: string
          student_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          role: string
          student_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          role?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_messages_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      questions_public: {
        Row: {
          answer_type: string | null
          chapter_id: string | null
          choices: Json | null
          concept_id: string | null
          created_at: string | null
          difficulty: number | null
          i18n: Json | null
          id: string | null
          input: Json | null
          kind: string | null
          slug: string | null
          stem_md: string | null
          stem_viz: Json | null
        }
        Insert: {
          answer_type?: string | null
          chapter_id?: string | null
          choices?: Json | null
          concept_id?: string | null
          created_at?: string | null
          difficulty?: number | null
          i18n?: never
          id?: string | null
          input?: Json | null
          kind?: string | null
          slug?: string | null
          stem_md?: string | null
          stem_viz?: Json | null
        }
        Update: {
          answer_type?: string | null
          chapter_id?: string | null
          choices?: Json | null
          concept_id?: string | null
          created_at?: string | null
          difficulty?: number | null
          i18n?: never
          id?: string | null
          input?: Json | null
          kind?: string | null
          slug?: string | null
          stem_md?: string | null
          stem_viz?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ai_spend_today: { Args: never; Returns: number }
      award_milestones: {
        Args: { p_context?: Json; p_student_id: string }
        Returns: string[]
      }
      extend_streak: {
        Args: { p_date?: string; p_student_id: string }
        Returns: {
          current: number
          grace_used_on: string | null
          last_active_date: string | null
          longest: number
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "streaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_concept_mastery: {
        Args: { p_concept_id: string; p_student_id: string }
        Returns: {
          attempts_count: number
          concept_id: string
          is_mastered: boolean
          score: number
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "concept_mastery"
          isOneToOne: true
          isSetofReturn: false
        }
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
