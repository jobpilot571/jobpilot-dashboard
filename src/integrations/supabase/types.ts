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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      application_detail_documents: {
        Row: {
          application_details_id: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          status: string
          student_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          application_details_id?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          status?: string
          student_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          application_details_id?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          status?: string
          student_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      application_detail_requests: {
        Row: {
          id: string
          sent_at: string
          sent_by: string | null
          sent_by_name: string | null
          sent_to_email: string
          status: string
          student_id: string
        }
        Insert: {
          id?: string
          sent_at?: string
          sent_by?: string | null
          sent_by_name?: string | null
          sent_to_email: string
          status?: string
          student_id: string
        }
        Update: {
          id?: string
          sent_at?: string
          sent_by?: string | null
          sent_by_name?: string | null
          sent_to_email?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_detail_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_placement_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "application_detail_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      application_details_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          disabled: boolean
          expires_at: string
          id: string
          student_id: string
          submitted_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          disabled?: boolean
          expires_at?: string
          id?: string
          student_id: string
          submitted_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          disabled?: boolean
          expires_at?: string
          id?: string
          student_id?: string
          submitted_at?: string | null
          token?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          email: string
          email_type: string
          error_message: string | null
          id: string
          provider_message_id: string | null
          role: string | null
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_type?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          role?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_type?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          role?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          avatar: string
          created_at: string
          daily_target: number
          email: string
          id: string
          job_role_category: string
          joining_date: string | null
          last_active_at: string | null
          name: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar?: string
          created_at?: string
          daily_target?: number
          email: string
          id?: string
          job_role_category?: string
          joining_date?: string | null
          last_active_at?: string | null
          name: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar?: string
          created_at?: string
          daily_target?: number
          email?: string
          id?: string
          job_role_category?: string
          joining_date?: string | null
          last_active_at?: string | null
          name?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      job_actions: {
        Row: {
          action_type: string
          created_at: string
          employee_id: string | null
          id: string
          job_id: string
          note: string | null
          student_id: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id: string
          note?: string | null
          student_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          job_id?: string
          note?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_actions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_actions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_placement_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "job_actions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applied_at: string
          applied_date: string
          applied_link: string
          applied_time: string
          company_name: string
          created_at: string
          created_by_employee_id: string | null
          id: string
          job_role: string
          resume_file_url: string | null
          serial_no: number
          status: string
          student_id: string
        }
        Insert: {
          applied_at?: string
          applied_date?: string
          applied_link?: string
          applied_time?: string
          company_name?: string
          created_at?: string
          created_by_employee_id?: string | null
          id?: string
          job_role?: string
          resume_file_url?: string | null
          serial_no: number
          status?: string
          student_id: string
        }
        Update: {
          applied_at?: string
          applied_date?: string
          applied_link?: string
          applied_time?: string
          company_name?: string
          created_at?: string
          created_by_employee_id?: string | null
          id?: string
          job_role?: string
          resume_file_url?: string | null
          serial_no?: number
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_created_by_employee_id_fkey"
            columns: ["created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_placement_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "job_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string
          sender_role: string
          trial_student_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name?: string
          sender_role: string
          trial_student_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
          trial_student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_trial_student_id_fkey"
            columns: ["trial_student_id"]
            isOneToOne: false
            referencedRelation: "trial_students"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_pipeline_events: {
        Row: {
          company_name: string | null
          completed: boolean | null
          created_at: string
          created_by: string | null
          document_url: string | null
          due_date: string | null
          employee_id: string | null
          employment_type: string | null
          event_date: string | null
          event_link: string | null
          event_time: string | null
          id: string
          interview_mode: string | null
          interviewer_name: string | null
          job_role: string | null
          joining_date: string | null
          notes: string | null
          panel_members: string | null
          phone_number: string | null
          recruiter_email: string | null
          recruiter_name: string | null
          result: string | null
          salary_or_rate: string | null
          screenshot_url: string | null
          stage: string
          status: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          completed?: boolean | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          due_date?: string | null
          employee_id?: string | null
          employment_type?: string | null
          event_date?: string | null
          event_link?: string | null
          event_time?: string | null
          id?: string
          interview_mode?: string | null
          interviewer_name?: string | null
          job_role?: string | null
          joining_date?: string | null
          notes?: string | null
          panel_members?: string | null
          phone_number?: string | null
          recruiter_email?: string | null
          recruiter_name?: string | null
          result?: string | null
          salary_or_rate?: string | null
          screenshot_url?: string | null
          stage: string
          status?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          completed?: boolean | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          due_date?: string | null
          employee_id?: string | null
          employment_type?: string | null
          event_date?: string | null
          event_link?: string | null
          event_time?: string | null
          id?: string
          interview_mode?: string | null
          interviewer_name?: string | null
          job_role?: string | null
          joining_date?: string | null
          notes?: string | null
          panel_members?: string | null
          phone_number?: string | null
          recruiter_email?: string | null
          recruiter_name?: string | null
          result?: string | null
          salary_or_rate?: string | null
          screenshot_url?: string | null
          stage?: string
          status?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_pipeline_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_pipeline_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_placement_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "placement_pipeline_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_access_logs: {
        Row: {
          accessed_by: string
          action: string
          created_at: string
          field_name: string
          id: string
          student_id: string
        }
        Insert: {
          accessed_by: string
          action: string
          created_at?: string
          field_name: string
          id?: string
          student_id: string
        }
        Update: {
          accessed_by?: string
          action?: string
          created_at?: string
          field_name?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      student_application_details: {
        Row: {
          address_info: Json
          admin_notes: string
          application_preferences: Json
          completion_percentage: number
          created_at: string
          credentials_info: Json
          education_info: Json
          emergency_contact: Json
          employee_notes: string
          id: string
          identity_info: Json
          personal_info: Json
          student_id: string
          student_notes: string
          updated_at: string
          visa_info: Json
        }
        Insert: {
          address_info?: Json
          admin_notes?: string
          application_preferences?: Json
          completion_percentage?: number
          created_at?: string
          credentials_info?: Json
          education_info?: Json
          emergency_contact?: Json
          employee_notes?: string
          id?: string
          identity_info?: Json
          personal_info?: Json
          student_id: string
          student_notes?: string
          updated_at?: string
          visa_info?: Json
        }
        Update: {
          address_info?: Json
          admin_notes?: string
          application_preferences?: Json
          completion_percentage?: number
          created_at?: string
          credentials_info?: Json
          education_info?: Json
          emergency_contact?: Json
          employee_notes?: string
          id?: string
          identity_info?: Json
          personal_info?: Json
          student_id?: string
          student_notes?: string
          updated_at?: string
          visa_info?: Json
        }
        Relationships: []
      }
      students: {
        Row: {
          applied_date: string
          assigned_to: string | null
          created_at: string
          documents_submitted: number
          documents_total: number
          email: string
          id: string
          inactive_at: string | null
          inactive_reason: string | null
          joining_date: string | null
          last_active_at: string | null
          last_assigned_to: string | null
          name: string
          payment_amount: number | null
          payment_date: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_status: string
          phone: string
          profile_json: Json | null
          program: string
          status: string
          user_id: string | null
        }
        Insert: {
          applied_date?: string
          assigned_to?: string | null
          created_at?: string
          documents_submitted?: number
          documents_total?: number
          email: string
          id?: string
          inactive_at?: string | null
          inactive_reason?: string | null
          joining_date?: string | null
          last_active_at?: string | null
          last_assigned_to?: string | null
          name: string
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_status?: string
          phone?: string
          profile_json?: Json | null
          program?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          applied_date?: string
          assigned_to?: string | null
          created_at?: string
          documents_submitted?: number
          documents_total?: number
          email?: string
          id?: string
          inactive_at?: string | null
          inactive_reason?: string | null
          joining_date?: string | null
          last_active_at?: string | null
          last_assigned_to?: string | null
          name?: string
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_status?: string
          phone?: string
          profile_json?: Json | null
          program?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trial_students: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string
          resume_url: string | null
          signup_date: string
          target_role: string
          trial_end_date: string
          trial_status: string
          updated_at: string
          user_id: string | null
          visa_status: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          email: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          resume_url?: string | null
          signup_date?: string
          target_role?: string
          trial_end_date?: string
          trial_status?: string
          updated_at?: string
          user_id?: string | null
          visa_status?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          resume_url?: string | null
          signup_date?: string
          target_role?: string
          trial_end_date?: string
          trial_status?: string
          updated_at?: string
          user_id?: string | null
          visa_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_students_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          must_change_password: boolean
          password_updated_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          temporary_password_active: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          must_change_password?: boolean
          password_updated_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          temporary_password_active?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          must_change_password?: boolean
          password_updated_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          temporary_password_active?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      student_placement_summary: {
        Row: {
          assessment_count: number | null
          assigned_employee_id: string | null
          employee_name: string | null
          has_needs_update: boolean | null
          has_overdue_assessment: boolean | null
          joined_date: string | null
          last_application_at: string | null
          last_early_stage_at: string | null
          last_interview_offer_at: string | null
          last_pipeline_at: string | null
          offer_count: number | null
          panel_count: number | null
          screening_count: number | null
          student_email: string | null
          student_id: string | null
          student_name: string | null
          student_status: string | null
          technical_count: number | null
          total_applications: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_assigned_to_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_resume_path: { Args: { _path: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_student_counselor_id: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_student_ids_for_user: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_trial_student_ids_for_user: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_active_employee: { Args: { _user_id: string }; Returns: boolean }
      is_active_student: { Args: { _user_id: string }; Returns: boolean }
      is_role_active: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      parse_job_application_applied_at: {
        Args: { _applied_date: string; _applied_time: string }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "student"
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
    Enums: {
      app_role: ["admin", "employee", "student"],
    },
  },
} as const
