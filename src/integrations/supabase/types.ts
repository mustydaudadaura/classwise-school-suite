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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admissions: {
        Row: {
          application_no: string
          class_applied_id: string | null
          created_at: string
          created_by: string | null
          dob: string | null
          entrance_score: number | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          last_name: string
          middle_name: string | null
          notes: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          previous_school: string | null
          relationship: string | null
          school_id: string
          stage: string
          state_of_origin: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          application_no: string
          class_applied_id?: string | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          entrance_score?: number | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          last_name: string
          middle_name?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          previous_school?: string | null
          relationship?: string | null
          school_id: string
          stage?: string
          state_of_origin?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          application_no?: string
          class_applied_id?: string | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          entrance_score?: number | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          last_name?: string
          middle_name?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          previous_school?: string | null
          relationship?: string | null
          school_id?: string
          stage?: string
          state_of_origin?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissions_class_applied_id_fkey"
            columns: ["class_applied_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          ca1: number | null
          ca2: number | null
          class_id: string | null
          created_at: string
          exam: number | null
          grade: string | null
          id: string
          remark: string | null
          review_remark: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          session: string
          status: Database["public"]["Enums"]["assessment_status"]
          student_id: string
          subject_id: string
          teacher_id: string | null
          term: Database["public"]["Enums"]["term_name"]
          total: number | null
          updated_at: string
        }
        Insert: {
          ca1?: number | null
          ca2?: number | null
          class_id?: string | null
          created_at?: string
          exam?: number | null
          grade?: string | null
          id?: string
          remark?: string | null
          review_remark?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          session: string
          status?: Database["public"]["Enums"]["assessment_status"]
          student_id: string
          subject_id: string
          teacher_id?: string | null
          term: Database["public"]["Enums"]["term_name"]
          total?: number | null
          updated_at?: string
        }
        Update: {
          ca1?: number | null
          ca2?: number | null
          class_id?: string | null
          created_at?: string
          exam?: number | null
          grade?: string | null
          id?: string
          remark?: string | null
          review_remark?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          session?: string
          status?: Database["public"]["Enums"]["assessment_status"]
          student_id?: string
          subject_id?: string
          teacher_id?: string | null
          term?: Database["public"]["Enums"]["term_name"]
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          instructions: string | null
          school_id: string
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          school_id: string
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          school_id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          note: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          note?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_attempts: {
        Row: {
          accuracy: number | null
          action: string
          created_at: string
          device_user_id: string | null
          distance_m: number | null
          id: string
          lat: number | null
          lng: number | null
          method: string
          result: string
          school_id: string
          user_id: string | null
        }
        Insert: {
          accuracy?: number | null
          action: string
          created_at?: string
          device_user_id?: string | null
          distance_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          method: string
          result: string
          school_id: string
          user_id?: string | null
        }
        Update: {
          accuracy?: number | null
          action?: string
          created_at?: string
          device_user_id?: string | null
          distance_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          method?: string
          result?: string
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exemptions: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          kind: string
          reason: string
          school_id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          kind?: string
          reason: string
          school_id: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          kind?: string
          reason?: string
          school_id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_exemptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          apply_penalties_in_payroll: boolean
          closing_time: string
          early_departure_minutes: number
          gps_kiosk: boolean
          gps_phone: boolean
          grace_minutes: number
          late_threshold_minutes: number
          latitude: number | null
          leave_requires_approval: boolean
          longitude: number | null
          min_hours: number
          penalties: Json
          radius_m: number
          report_time: string
          school_id: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          apply_penalties_in_payroll?: boolean
          closing_time?: string
          early_departure_minutes?: number
          gps_kiosk?: boolean
          gps_phone?: boolean
          grace_minutes?: number
          late_threshold_minutes?: number
          latitude?: number | null
          leave_requires_approval?: boolean
          longitude?: number | null
          min_hours?: number
          penalties?: Json
          radius_m?: number
          report_time?: string
          school_id: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          apply_penalties_in_payroll?: boolean
          closing_time?: string
          early_departure_minutes?: number
          gps_kiosk?: boolean
          gps_phone?: boolean
          grace_minutes?: number
          late_threshold_minutes?: number
          latitude?: number | null
          leave_requires_approval?: boolean
          longitude?: number | null
          min_hours?: number
          penalties?: Json
          radius_m?: number
          report_time?: string
          school_id?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sites: {
        Row: {
          active: boolean
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          radius_m: number
          school_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          radius_m?: number
          school_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          radius_m?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          school_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          school_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campuses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          active: boolean
          arm: string | null
          campus_id: string | null
          created_at: string
          id: string
          level: string | null
          name: string
          pending_activation: boolean
          rejected_at: string | null
          rejection_reason: string | null
          reviewed_by: string | null
          school_id: string
          section: Database["public"]["Enums"]["class_section"] | null
          submitted_by: string | null
          teacher_id: string | null
        }
        Insert: {
          active?: boolean
          arm?: string | null
          campus_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
          pending_activation?: boolean
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          school_id: string
          section?: Database["public"]["Enums"]["class_section"] | null
          submitted_by?: string | null
          teacher_id?: string | null
        }
        Update: {
          active?: boolean
          arm?: string | null
          campus_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          pending_activation?: boolean
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          school_id?: string
          section?: Database["public"]["Enums"]["class_section"] | null
          submitted_by?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_documents: {
        Row: {
          created_at: string
          created_by: string
          file_name: string | null
          id: string
          school_id: string
          subject_id: string | null
          summary: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_name?: string | null
          id?: string
          school_id: string
          subject_id?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string | null
          id?: string
          school_id?: string
          subject_id?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          discount_amount: number
          discount_approved_at: string | null
          discount_approved_by: string | null
          discount_kind: string | null
          discount_reason: string | null
          due_date: string | null
          fee_item_id: string | null
          id: string
          school_id: string
          session: string
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term: Database["public"]["Enums"]["term_name"]
          title: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          discount_amount?: number
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_kind?: string | null
          discount_reason?: string | null
          due_date?: string | null
          fee_item_id?: string | null
          id?: string
          school_id: string
          session: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term: Database["public"]["Enums"]["term_name"]
          title: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          discount_amount?: number
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_kind?: string | null
          discount_reason?: string | null
          due_date?: string | null
          fee_item_id?: string | null
          id?: string
          school_id?: string
          session?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          term?: Database["public"]["Enums"]["term_name"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoices_fee_item_id_fkey"
            columns: ["fee_item_id"]
            isOneToOne: false
            referencedRelation: "fee_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_items: {
        Row: {
          active: boolean
          amount: number
          class_id: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          session: string
          term: Database["public"]["Enums"]["term_name"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          class_id?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          session: string
          term: Database["public"]["Enums"]["term_name"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          class_id?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          session?: string
          term?: Database["public"]["Enums"]["term_name"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_at: string
          receipt_no: string
          recorded_by: string | null
          reference: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_no?: string
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_no?: string
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      islamic_enrollments: {
        Row: {
          enrolled_at: string
          id: string
          notes: string | null
          programme_id: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          enrolled_at?: string
          id?: string
          notes?: string | null
          programme_id: string
          school_id: string
          status?: string
          student_id: string
        }
        Update: {
          enrolled_at?: string
          id?: string
          notes?: string | null
          programme_id?: string
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "islamic_enrollments_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "islamic_programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "islamic_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "islamic_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      islamic_programmes: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          programme_type: string
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          programme_type?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          programme_type?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "islamic_programmes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          id: string
          leave_type_id: string | null
          reason: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          leave_type_id?: string | null
          reason: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          leave_type_id?: string | null
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          paid: boolean
          school_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          paid?: boolean
          school_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          paid?: boolean
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          acknowledged_at: string | null
          class_id: string | null
          content: string
          created_at: string
          created_by: string
          duration_minutes: number | null
          header: Json | null
          id: string
          lesson_date: string | null
          plan: Json | null
          review_remark: string | null
          review_score: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          subject_id: string | null
          teacher_reply: string | null
          term: Database["public"]["Enums"]["term_name"] | null
          topic: string
          updated_at: string
          week: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          class_id?: string | null
          content: string
          created_at?: string
          created_by: string
          duration_minutes?: number | null
          header?: Json | null
          id?: string
          lesson_date?: string | null
          plan?: Json | null
          review_remark?: string | null
          review_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          subject_id?: string | null
          teacher_reply?: string | null
          term?: Database["public"]["Enums"]["term_name"] | null
          topic: string
          updated_at?: string
          week?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          class_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          header?: Json | null
          id?: string
          lesson_date?: string | null
          plan?: Json | null
          review_remark?: string | null
          review_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          subject_id?: string | null
          teacher_reply?: string | null
          term?: Database["public"]["Enums"]["term_name"] | null
          topic?: string
          updated_at?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          school_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          school_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          school_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          delivered: boolean | null
          error: string | null
          id: string
          meta: Json | null
          read_at: string | null
          school_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered?: boolean | null
          error?: string | null
          id?: string
          meta?: Json | null
          read_at?: string | null
          school_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered?: boolean | null
          error?: string | null
          id?: string
          meta?: Json | null
          read_at?: string | null
          school_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      parent_notifications: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          meta: Json
          parent_id: string | null
          read_at: string | null
          school_id: string
          student_id: string | null
          title: string
          type: Database["public"]["Enums"]["parent_notification_type"]
          visible_from: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          parent_id?: string | null
          read_at?: string | null
          school_id: string
          student_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["parent_notification_type"]
          visible_from?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          parent_id?: string | null
          read_at?: string | null
          school_id?: string
          student_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["parent_notification_type"]
          visible_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_preferences: {
        Row: {
          muted_types: string[]
          parent_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          muted_types?: string[]
          parent_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          muted_types?: string[]
          parent_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_preferences_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: true
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_preferences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          occupation: string | null
          phone: string | null
          school_id: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          occupation?: string | null
          phone?: string | null
          school_id: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          occupation?: string | null
          phone?: string | null
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          amount: number
          id: string
          kind: string
          label: string
          record_id: string
          school_id: string
        }
        Insert: {
          amount: number
          id?: string
          kind: string
          label: string
          record_id: string
          school_id: string
        }
        Update: {
          amount?: number
          id?: string
          kind?: string
          label?: string
          record_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          end_date: string
          generated_at: string | null
          id: string
          kind: string
          name: string
          paid_at: string | null
          paid_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          start_date: string
          status: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          generated_at?: string | null
          id?: string
          kind: string
          name: string
          paid_at?: string | null
          paid_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          start_date: string
          status?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          generated_at?: string | null
          id?: string
          kind?: string
          name?: string
          paid_at?: string | null
          paid_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          start_date?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          absence_penalty: number
          allowances: number
          basic: number
          created_at: string
          days_absent: number
          days_exempt: number
          days_present: number
          gross: number
          id: string
          late_count: number
          late_penalty: number
          net: number
          other_deductions: number
          other_penalty: number
          period_id: string
          school_id: string
          staff_name: string | null
          total_deductions: number
          user_id: string
          version: number
        }
        Insert: {
          absence_penalty?: number
          allowances?: number
          basic?: number
          created_at?: string
          days_absent?: number
          days_exempt?: number
          days_present?: number
          gross?: number
          id?: string
          late_count?: number
          late_penalty?: number
          net?: number
          other_deductions?: number
          other_penalty?: number
          period_id: string
          school_id: string
          staff_name?: string | null
          total_deductions?: number
          user_id: string
          version?: number
        }
        Update: {
          absence_penalty?: number
          allowances?: number
          basic?: number
          created_at?: string
          days_absent?: number
          days_exempt?: number
          days_present?: number
          gross?: number
          id?: string
          late_count?: number
          late_penalty?: number
          net?: number
          other_deductions?: number
          other_penalty?: number
          period_id?: string
          school_id?: string
          staff_name?: string | null
          total_deductions?: number
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_cards: {
        Row: {
          affective: Json | null
          average: number | null
          class_id: string | null
          class_size: number | null
          created_at: string
          days_absent: number | null
          days_present: number | null
          days_total: number | null
          gpa: number | null
          id: string
          next_resumption_date: string | null
          pdf_url: string | null
          position: number | null
          principal_remark: string | null
          psychomotor: Json | null
          published: boolean | null
          school_id: string
          session: string
          student_id: string
          subjects_count: number | null
          teacher_remark: string | null
          term: Database["public"]["Enums"]["term_name"]
          total_score: number | null
          verification_code: string | null
        }
        Insert: {
          affective?: Json | null
          average?: number | null
          class_id?: string | null
          class_size?: number | null
          created_at?: string
          days_absent?: number | null
          days_present?: number | null
          days_total?: number | null
          gpa?: number | null
          id?: string
          next_resumption_date?: string | null
          pdf_url?: string | null
          position?: number | null
          principal_remark?: string | null
          psychomotor?: Json | null
          published?: boolean | null
          school_id: string
          session: string
          student_id: string
          subjects_count?: number | null
          teacher_remark?: string | null
          term: Database["public"]["Enums"]["term_name"]
          total_score?: number | null
          verification_code?: string | null
        }
        Update: {
          affective?: Json | null
          average?: number | null
          class_id?: string | null
          class_size?: number | null
          created_at?: string
          days_absent?: number | null
          days_present?: number | null
          days_total?: number | null
          gpa?: number | null
          id?: string
          next_resumption_date?: string | null
          pdf_url?: string | null
          position?: number | null
          principal_remark?: string | null
          psychomotor?: Json | null
          published?: boolean | null
          school_id?: string
          session?: string
          student_id?: string
          subjects_count?: number | null
          teacher_remark?: string | null
          term?: Database["public"]["Enums"]["term_name"]
          total_score?: number | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_items: {
        Row: {
          class_id: string | null
          class_label: string | null
          created_at: string
          created_by: string
          document_id: string
          id: string
          lesson_note_id: string | null
          objectives: Json
          review_remark: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          sub_topics: Json
          subject_id: string | null
          term: Database["public"]["Enums"]["term_name"] | null
          topic: string
          week: number | null
        }
        Insert: {
          class_id?: string | null
          class_label?: string | null
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          lesson_note_id?: string | null
          objectives?: Json
          review_remark?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          sub_topics?: Json
          subject_id?: string | null
          term?: Database["public"]["Enums"]["term_name"] | null
          topic: string
          week?: number | null
        }
        Update: {
          class_id?: string | null
          class_label?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          lesson_note_id?: string | null
          objectives?: Json
          review_remark?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          sub_topics?: Json
          subject_id?: string | null
          term?: Database["public"]["Enums"]["term_name"] | null
          topic?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scheme_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "curriculum_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_items_lesson_note_id_fkey"
            columns: ["lesson_note_id"]
            isOneToOne: false
            referencedRelation: "lesson_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheme_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      school_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          school_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          school_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_certificates: {
        Row: {
          created_at: string
          details: Json
          id: string
          issued_by: string | null
          kind: string
          school_id: string
          serial_no: string
          student_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          issued_by?: string | null
          kind: string
          school_id: string
          serial_no: string
          student_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          issued_by?: string | null
          kind?: string
          school_id?: string
          serial_no?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      school_controls: {
        Row: {
          enabled_modules: string[]
          enabled_sections: string[]
          school_id: string
          updated_at: string
        }
        Insert: {
          enabled_modules?: string[]
          enabled_sections?: string[]
          school_id: string
          updated_at?: string
        }
        Update: {
          enabled_modules?: string[]
          enabled_sections?: string[]
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_controls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_custom_roles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          permissions: string[]
          school_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          permissions?: string[]
          school_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          permissions?: string[]
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_custom_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_no: string
          id: string
          method: string
          notes: string | null
          paid_to: string | null
          recorded_by: string | null
          reference: string | null
          school_id: string
          spent_on: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          expense_no: string
          id?: string
          method?: string
          notes?: string | null
          paid_to?: string | null
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          spent_on?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_no?: string
          id?: string
          method?: string
          notes?: string | null
          paid_to?: string | null
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          spent_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_role_assignments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role_id: string
          school_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role_id: string
          school_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role_id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_role_assignments_role_id_school_id_fkey"
            columns: ["role_id", "school_id"]
            isOneToOne: false
            referencedRelation: "school_custom_roles"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "school_role_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          active: boolean
          address: string | null
          admission_no_start: string | null
          branch_name: string | null
          code: string
          created_at: string
          current_session: string | null
          current_term: Database["public"]["Enums"]["term_name"] | null
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          motto: string | null
          name: string
          phone: string | null
          principal_name: string | null
          principal_signature_url: string | null
          report_template: Json
          stamp_url: string | null
          theme_color: string | null
          twitter_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          admission_no_start?: string | null
          branch_name?: string | null
          code: string
          created_at?: string
          current_session?: string | null
          current_term?: Database["public"]["Enums"]["term_name"] | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          motto?: string | null
          name: string
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          report_template?: Json
          stamp_url?: string | null
          theme_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          admission_no_start?: string | null
          branch_name?: string | null
          code?: string
          created_at?: string
          current_session?: string | null
          current_term?: Database["public"]["Enums"]["term_name"] | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          motto?: string | null
          name?: string
          phone?: string | null
          principal_name?: string | null
          principal_signature_url?: string | null
          report_template?: Json
          stamp_url?: string | null
          theme_color?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      staff_attendance: {
        Row: {
          check_in_at: string | null
          check_out_at: string | null
          corrected_by: string | null
          correction_reason: string | null
          created_at: string
          date: string
          early_minutes: number
          id: string
          in_accuracy: number | null
          in_distance_m: number | null
          in_lat: number | null
          in_lng: number | null
          in_method: string | null
          in_verified: boolean | null
          late_minutes: number
          out_accuracy: number | null
          out_distance_m: number | null
          out_lat: number | null
          out_lng: number | null
          out_method: string | null
          out_verified: boolean | null
          school_id: string
          status: string
          updated_at: string
          user_id: string
          worked_minutes: number
        }
        Insert: {
          check_in_at?: string | null
          check_out_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          date: string
          early_minutes?: number
          id?: string
          in_accuracy?: number | null
          in_distance_m?: number | null
          in_lat?: number | null
          in_lng?: number | null
          in_method?: string | null
          in_verified?: boolean | null
          late_minutes?: number
          out_accuracy?: number | null
          out_distance_m?: number | null
          out_lat?: number | null
          out_lng?: number | null
          out_method?: string | null
          out_verified?: boolean | null
          school_id: string
          status?: string
          updated_at?: string
          user_id: string
          worked_minutes?: number
        }
        Update: {
          check_in_at?: string | null
          check_out_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          date?: string
          early_minutes?: number
          id?: string
          in_accuracy?: number | null
          in_distance_m?: number | null
          in_lat?: number | null
          in_lng?: number | null
          in_method?: string | null
          in_verified?: boolean | null
          late_minutes?: number
          out_accuracy?: number | null
          out_distance_m?: number | null
          out_lat?: number | null
          out_lng?: number | null
          out_method?: string | null
          out_verified?: boolean | null
          school_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_department_history: {
        Row: {
          category: string | null
          changed_at: string
          changed_by: string | null
          department: string | null
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          changed_at?: string
          changed_by?: string | null
          department?: string | null
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          category?: string | null
          changed_at?: string
          changed_by?: string | null
          department?: string | null
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_department_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          kind: string
          school_id: string
          start_date: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          kind?: string
          school_id: string
          start_date: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          kind?: string
          school_id?: string
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_holidays_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_penalties: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          kind: string
          minutes: number | null
          payroll_record_id: string | null
          school_id: string
          status: string
          user_id: string
          waive_reason: string | null
          waived_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          id?: string
          kind: string
          minutes?: number | null
          payroll_record_id?: string | null
          school_id: string
          status?: string
          user_id: string
          waive_reason?: string | null
          waived_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          kind?: string
          minutes?: number | null
          payroll_record_id?: string | null
          school_id?: string
          status?: string
          user_id?: string
          waive_reason?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_penalties_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          active: boolean
          attendance_exempt: boolean
          category: string
          created_at: string
          department: string | null
          id: string
          photo_url: string | null
          pin_hash: string | null
          school_id: string
          staff_no: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          attendance_exempt?: boolean
          category?: string
          created_at?: string
          department?: string | null
          id?: string
          photo_url?: string | null
          pin_hash?: string | null
          school_id: string
          staff_no?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          attendance_exempt?: boolean
          category?: string
          created_at?: string
          department?: string | null
          id?: string
          photo_url?: string | null
          pin_hash?: string | null
          school_id?: string
          staff_no?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salaries: {
        Row: {
          allowances: number
          basic: number
          created_at: string
          deductions: number
          id: string
          method: string | null
          month: string
          net: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payslip_no: string
          recorded_by: string | null
          reference: string | null
          school_id: string
          status: string
          user_id: string
        }
        Insert: {
          allowances?: number
          basic?: number
          created_at?: string
          deductions?: number
          id?: string
          method?: string | null
          month: string
          net?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payslip_no: string
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          status?: string
          user_id: string
        }
        Update: {
          allowances?: number
          basic?: number
          created_at?: string
          deductions?: number
          id?: string
          method?: string | null
          month?: string
          net?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payslip_no?: string
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salary_settings: {
        Row: {
          allowances: number
          basic: number
          effective_from: string | null
          id: string
          other_deductions: number
          salary_type: string
          school_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowances?: number
          basic?: number
          effective_from?: string | null
          id?: string
          other_deductions?: number
          salary_type?: string
          school_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowances?: number
          basic?: number
          effective_from?: string | null
          id?: string
          other_deductions?: number
          salary_type?: string
          school_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salary_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          event: string
          id: string
          school_id: string
          session: string | null
          student_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          event?: string
          id?: string
          school_id: string
          session?: string | null
          student_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          event?: string
          id?: string
          school_id?: string
          session?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parents: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          parent_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_scholarships: {
        Row: {
          approved_by: string | null
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          label: string
          school_id: string
          session: string
          status: string
          student_id: string
          term: Database["public"]["Enums"]["term_name"] | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          discount_type?: string
          discount_value: number
          id?: string
          label: string
          school_id: string
          session: string
          status?: string
          student_id: string
          term?: Database["public"]["Enums"]["term_name"] | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          label?: string
          school_id?: string
          session?: string
          status?: string
          student_id?: string
          term?: Database["public"]["Enums"]["term_name"] | null
        }
        Relationships: [
          {
            foreignKeyName: "student_scholarships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_scholarships_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          address: string | null
          admission_date: string | null
          admission_no: string
          admitted_by: string | null
          allergies: string | null
          blood_group: string | null
          campus_id: string | null
          class_id: string | null
          created_at: string
          dob: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          genotype: string | null
          house: string | null
          id: string
          last_name: string
          lga: string | null
          medical_notes: string | null
          middle_name: string | null
          next_resumption_date: string | null
          pending_activation: boolean
          photo_url: string | null
          previous_school: string | null
          rejected_at: string | null
          rejection_reason: string | null
          religion: string | null
          reviewed_by: string | null
          school_id: string
          state_of_origin: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          admission_date?: string | null
          admission_no: string
          admitted_by?: string | null
          allergies?: string | null
          blood_group?: string | null
          campus_id?: string | null
          class_id?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          genotype?: string | null
          house?: string | null
          id?: string
          last_name: string
          lga?: string | null
          medical_notes?: string | null
          middle_name?: string | null
          next_resumption_date?: string | null
          pending_activation?: boolean
          photo_url?: string | null
          previous_school?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          religion?: string | null
          reviewed_by?: string | null
          school_id: string
          state_of_origin?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          admission_date?: string | null
          admission_no?: string
          admitted_by?: string | null
          allergies?: string | null
          blood_group?: string | null
          campus_id?: string | null
          class_id?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          genotype?: string | null
          house?: string | null
          id?: string
          last_name?: string
          lga?: string | null
          medical_notes?: string | null
          middle_name?: string | null
          next_resumption_date?: string | null
          pending_activation?: boolean
          photo_url?: string | null
          previous_school?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          religion?: string | null
          reviewed_by?: string | null
          school_id?: string
          state_of_origin?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          active: boolean
          class_id: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          pending_activation: boolean
          rejected_at: string | null
          rejection_reason: string | null
          reviewed_by: string | null
          school_id: string
          submitted_by: string | null
        }
        Insert: {
          active?: boolean
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          pending_activation?: boolean
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          school_id: string
          submitted_by?: string | null
        }
        Update: {
          active?: boolean
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          pending_activation?: boolean
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          school_id?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tahfiz_records: {
        Row: {
          assessment_type: string
          ayah_from: number
          ayah_to: number
          created_at: string
          grade: string | null
          id: string
          record_date: string
          remarks: string | null
          school_id: string
          score: number | null
          session: string
          student_id: string
          surah_from: string
          surah_to: string
          teacher_id: string | null
          term: string
        }
        Insert: {
          assessment_type?: string
          ayah_from?: number
          ayah_to?: number
          created_at?: string
          grade?: string | null
          id?: string
          record_date?: string
          remarks?: string | null
          school_id: string
          score?: number | null
          session: string
          student_id: string
          surah_from: string
          surah_to: string
          teacher_id?: string | null
          term: string
        }
        Update: {
          assessment_type?: string
          ayah_from?: number
          ayah_to?: number
          created_at?: string
          grade?: string | null
          id?: string
          record_date?: string
          remarks?: string | null
          school_id?: string
          score?: number | null
          session?: string
          student_id?: string
          surah_from?: string
          surah_to?: string
          teacher_id?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "tahfiz_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tahfiz_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_allocations: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_class_teacher: boolean
          school_id: string
          subject_id: string | null
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id: string
          subject_id?: string | null
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_class_teacher?: boolean
          school_id?: string
          subject_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_allocations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_allocations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_allocations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          label: string | null
          room: string | null
          school_id: string
          start_time: string
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          label?: string | null
          room?: string | null
          school_id: string
          start_time: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          label?: string | null
          room?: string | null
          school_id?: string
          start_time?: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_pending_classes: { Args: { _ids: string[] }; Returns: number }
      activate_pending_students: { Args: { _ids: string[] }; Returns: number }
      activate_pending_subjects: { Args: { _ids: string[] }; Returns: number }
      assign_form_master: {
        Args: { _class_id: string; _school_id: string; _teacher_id?: string }
        Returns: Json
      }
      can_enter_class_scores: {
        Args: { _class_id: string; _school_id: string; _user_id: string }
        Returns: boolean
      }
      can_enter_subject_scores: {
        Args: {
          _class_id: string
          _school_id: string
          _subject_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_review_class_results: {
        Args: { _class_id: string; _school_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      can_submit_school_registration: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      can_submit_school_subject: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      find_parent_by_phone: {
        Args: { _phone: string }
        Returns: {
          full_name: string
          parent_id: string
          school_id: string
        }[]
      }
      form_master_admit_student: {
        Args: {
          _admission_no: string
          _class_id: string
          _dob: string
          _first_name: string
          _gender: Database["public"]["Enums"]["gender_type"]
          _last_name: string
          _middle_name: string
          _parent_email: string
          _parent_name: string
          _parent_phone: string
        }
        Returns: string
      }
      form_master_candidates: {
        Args: { _school_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_user_school: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      in_same_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_form_master: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_link_owner: {
        Args: { _parent_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_school_staff: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      manage_registry_item: {
        Args: { _action: string; _id: string; _table: string }
        Returns: Json
      }
      manages_school_finance: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      next_admission_number: { Args: { _school_id: string }; Returns: Json }
      notify_fee_defaulters: {
        Args: { _created_by: string; _school_id: string }
        Returns: number
      }
      parent_has_child_in_class: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      report_subject_positions: {
        Args: { _report_id: string }
        Returns: {
          subject_id: string
          subject_position: number
        }[]
      }
      review_pending_registration: {
        Args: {
          _action: string
          _changes?: Json
          _id: string
          _reason?: string
          _table: string
        }
        Returns: Json
      }
      school_module_enabled: {
        Args: { _module: string; _school_id: string }
        Returns: boolean
      }
      school_permission: {
        Args: { _permission: string; _school_id: string; _user_id: string }
        Returns: boolean
      }
      storage_school_folder: { Args: { _name: string }; Returns: string }
      student_school_id: { Args: { _student_id: string }; Returns: string }
      submit_student_admission: {
        Args: {
          _admission_no: string
          _class_id: string
          _dob: string
          _first_name: string
          _gender: Database["public"]["Enums"]["gender_type"]
          _last_name: string
          _middle_name: string
          _parent_email: string
          _parent_name: string
          _parent_phone: string
        }
        Returns: string
      }
      teaches_class: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      teaches_subject: {
        Args: { _class_id: string; _subject_id: string; _user_id: string }
        Returns: boolean
      }
      verify_report_card: {
        Args: { _code: string }
        Returns: {
          admission_no: string
          average: number
          class_name: string
          position: number
          published: boolean
          school_name: string
          session: string
          student_name: string
          term: Database["public"]["Enums"]["term_name"]
          total_score: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "school_admin"
        | "teacher"
        | "student"
        | "parent"
        | "accountant"
      assessment_status: "draft" | "submitted" | "approved"
      attendance_status: "present" | "absent" | "late" | "excused"
      class_section: "nursery" | "primary" | "secondary"
      gender_type: "male" | "female"
      invoice_status: "unpaid" | "partial" | "paid" | "overdue"
      parent_notification_type:
        | "news"
        | "fee_reminder"
        | "defaulter"
        | "message"
        | "general"
      term_name: "first" | "second" | "third"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "super_admin",
        "school_admin",
        "teacher",
        "student",
        "parent",
        "accountant",
      ],
      assessment_status: ["draft", "submitted", "approved"],
      attendance_status: ["present", "absent", "late", "excused"],
      class_section: ["nursery", "primary", "secondary"],
      gender_type: ["male", "female"],
      invoice_status: ["unpaid", "partial", "paid", "overdue"],
      parent_notification_type: [
        "news",
        "fee_reminder",
        "defaulter",
        "message",
        "general",
      ],
      term_name: ["first", "second", "third"],
    },
  },
} as const
