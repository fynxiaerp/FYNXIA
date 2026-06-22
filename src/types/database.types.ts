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
      agent_outreach_log: {
        Row: {
          agent_type: string
          appointment_id: string | null
          created_at: string
          error_message: string | null
          id: string
          intent_result: string | null
          patient_id: string | null
          receivable_id: string | null
          status: string
          tenant_id: string
          to_phone: string | null
          updated_at: string
          whatsapp_message_id: string | null
        }
        Insert: {
          agent_type: string
          appointment_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          intent_result?: string | null
          patient_id?: string | null
          receivable_id?: string | null
          status?: string
          tenant_id: string
          to_phone?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          agent_type?: string
          appointment_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          intent_result?: string | null
          patient_id?: string | null
          receivable_id?: string | null
          status?: string
          tenant_id?: string
          to_phone?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_outreach_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outreach_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outreach_log_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outreach_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_config: {
        Row: {
          agent_key: string
          autonomy_level: string
          clinic_id: string
          created_at: string
          enabled: boolean
          id: string
          limits: Json
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_key: string
          autonomy_level?: string
          clinic_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          limits?: Json
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_key?: string
          autonomy_level?: string
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          limits?: Json
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_decision_log: {
        Row: {
          action: string
          actor_id: string | null
          agent_key: string
          autonomy_level: string
          clinic_id: string
          created_at: string
          decision: string
          id: string
          payload: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          agent_key: string
          autonomy_level: string
          clinic_id: string
          created_at?: string
          decision: string
          id?: string
          payload?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          agent_key?: string
          autonomy_level?: string
          clinic_id?: string
          created_at?: string
          decision?: string
          id?: string
          payload?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      anamneses: {
        Row: {
          created_at: string
          flow: string
          id: string
          ip_address: unknown
          patient_id: string
          responses: Json
          signature_hash: string
          signature_url: string | null
          signed_at: string
          tenant_id: string
          token: string | null
          token_expires_at: string | null
          token_used_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          flow?: string
          id?: string
          ip_address?: unknown
          patient_id: string
          responses?: Json
          signature_hash: string
          signature_url?: string | null
          signed_at?: string
          tenant_id: string
          token?: string | null
          token_expires_at?: string | null
          token_used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          flow?: string
          id?: string
          ip_address?: unknown
          patient_id?: string
          responses?: Json
          signature_hash?: string
          signature_url?: string | null
          signed_at?: string
          tenant_id?: string
          token?: string | null
          token_expires_at?: string | null
          token_used_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_procedures: {
        Row: {
          appointment_id: string
          clinic_id: string
          created_at: string
          dente: string | null
          desconto: number
          face: string | null
          id: string
          nota: string | null
          professional_id: string | null
          quantity: number
          service_id: string
          updated_at: string
          valor_unitario: number
        }
        Insert: {
          appointment_id: string
          clinic_id: string
          created_at?: string
          dente?: string | null
          desconto?: number
          face?: string | null
          id?: string
          nota?: string | null
          professional_id?: string | null
          quantity?: number
          service_id: string
          updated_at?: string
          valor_unitario: number
        }
        Update: {
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          dente?: string | null
          desconto?: number
          face?: string | null
          id?: string
          nota?: string | null
          professional_id?: string | null
          quantity?: number
          service_id?: string
          updated_at?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_procedures_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_procedures_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_procedures_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          arrived_at: string | null
          called_at: string | null
          created_at: string
          dentist_id: string
          end_time: string
          finished_at: string | null
          id: string
          notes: string | null
          patient_id: string | null
          presence_status: string | null
          resource_id: string | null
          source: string
          start_time: string
          started_at: string | null
          status: string
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          called_at?: string | null
          created_at?: string
          dentist_id: string
          end_time: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          presence_status?: string | null
          resource_id?: string | null
          source?: string
          start_time: string
          started_at?: string | null
          status?: string
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          called_at?: string | null
          created_at?: string
          dentist_id?: string
          end_time?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          presence_status?: string | null
          resource_id?: string | null
          source?: string
          start_time?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          agent_key: string | null
          approver: string | null
          clinic_id: string
          created_at: string
          decided_at: string | null
          executed_at: string | null
          expires_at: string | null
          id: string
          idempotency_key: string | null
          payload: Json
          reason: string | null
          requested_by: string
          required_role: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_key?: string | null
          approver?: string | null
          clinic_id: string
          created_at?: string
          decided_at?: string | null
          executed_at?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          payload?: Json
          reason?: string | null
          requested_by: string
          required_role?: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          agent_key?: string | null
          approver?: string | null
          clinic_id?: string
          created_at?: string
          decided_at?: string | null
          executed_at?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          payload?: Json
          reason?: string | null
          requested_by?: string
          required_role?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_approver_fkey"
            columns: ["approver"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_approver_fkey"
            columns: ["approver"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_06: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_07: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_08: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_09: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_10: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026_11: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          clinic_id: string
          conta: string | null
          created_at: string
          data_abertura: string | null
          id: string
          name: string
          saldo_atual: number
          saldo_inicial: number
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          clinic_id: string
          conta?: string | null
          created_at?: string
          data_abertura?: string | null
          id?: string
          name: string
          saldo_atual?: number
          saldo_inicial?: number
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          clinic_id?: string
          conta?: string | null
          created_at?: string
          data_abertura?: string | null
          id?: string
          name?: string
          saldo_atual?: number
          saldo_inicial?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          clinic_id: string
          created_at: string
          filename: string | null
          fonte: string
          id: string
          imported_by: string | null
          periodo_fim: string
          periodo_inicio: string
        }
        Insert: {
          bank_account_id: string
          clinic_id: string
          created_at?: string
          filename?: string | null
          fonte?: string
          id?: string
          imported_by?: string | null
          periodo_fim: string
          periodo_inicio: string
        }
        Update: {
          bank_account_id?: string
          clinic_id?: string
          created_at?: string
          filename?: string | null
          fonte?: string
          id?: string
          imported_by?: string | null
          periodo_fim?: string
          periodo_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          cert_password_enc: string
          clinic_id: string
          cnpj: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          id: string
          issuer_cn: string | null
          not_after: string
          not_before: string
          serial_number: string | null
          storage_path: string
          subject_cn: string
          thumbprint_sha1: string
          uploaded_by: string | null
        }
        Insert: {
          cert_password_enc: string
          clinic_id: string
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          issuer_cn?: string | null
          not_after: string
          not_before: string
          serial_number?: string | null
          storage_path: string
          subject_cn: string
          thumbprint_sha1: string
          uploaded_by?: string | null
        }
        Update: {
          cert_password_enc?: string
          clinic_id?: string
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          issuer_cn?: string | null
          not_after?: string
          not_before?: string
          serial_number?: string | null
          storage_path?: string
          subject_cn?: string
          thumbprint_sha1?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          billing_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          installment_count: number
          patient_id: string | null
          provider: string
          provider_charge_id: string | null
          provider_installment_id: string | null
          service_order_id: string | null
          status: string
          tenant_id: string
          total_value: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          billing_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          installment_count?: number
          patient_id?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_installment_id?: string | null
          service_order_id?: string | null
          status?: string
          tenant_id: string
          total_value: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          billing_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          installment_count?: number
          patient_id?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_installment_id?: string | null
          service_order_id?: string | null
          status?: string
          tenant_id?: string
          total_value?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          ativo: boolean
          clinic_id: string
          code: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinic_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_documents: {
        Row: {
          appointment_id: string | null
          cert_not_after: string | null
          cert_pem: string | null
          cert_thumbprint: string | null
          clinic_id: string
          content_hash: string | null
          content_json: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          doc_number: string
          doc_type: string
          id: string
          patient_id: string
          portal_visible: boolean
          professional_id: string | null
          signature: string | null
          signed_at: string | null
          signed_by: string | null
          signer_cn: string | null
          status: string
          storage_path: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          cert_not_after?: string | null
          cert_pem?: string | null
          cert_thumbprint?: string | null
          clinic_id: string
          content_hash?: string | null
          content_json?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          doc_number: string
          doc_type: string
          id?: string
          patient_id: string
          portal_visible?: boolean
          professional_id?: string | null
          signature?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_cn?: string | null
          status?: string
          storage_path?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          cert_not_after?: string | null
          cert_pem?: string | null
          cert_thumbprint?: string | null
          clinic_id?: string
          content_hash?: string | null
          content_json?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          doc_number?: string
          doc_type?: string
          id?: string
          patient_id?: string
          portal_visible?: boolean
          professional_id?: string | null
          signature?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_cn?: string | null
          status?: string
          storage_path?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          plan: string
          regime_tributario: string | null
          slug: string
          specialty: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          plan?: string
          regime_tributario?: string | null
          slug: string
          specialty?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: string
          regime_tributario?: string | null
          slug?: string
          specialty?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      collection_log: {
        Row: {
          channel: string
          id: string
          milestone: string
          receivable_id: string
          sent_at: string
          tenant_id: string
        }
        Insert: {
          channel?: string
          id?: string
          milestone: string
          receivable_id: string
          sent_at?: string
          tenant_id: string
        }
        Update: {
          channel?: string
          id?: string
          milestone?: string
          receivable_id?: string
          sent_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_log_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_rules: {
        Row: {
          created_at: string
          due_date_reminder_enabled: boolean
          id: string
          overdue_interval_days: number
          overdue_reminder_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date_reminder_enabled?: boolean
          id?: string
          overdue_interval_days?: number
          overdue_reminder_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date_reminder_enabled?: boolean
          id?: string
          overdue_interval_days?: number
          overdue_reminder_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      competencia_fechamentos: {
        Row: {
          clinic_id: string
          competencia: string
          fechado_at: string
          fechado_por: string | null
          id: string
          unit_id: string
        }
        Insert: {
          clinic_id: string
          competencia: string
          fechado_at?: string
          fechado_por?: string | null
          id?: string
          unit_id: string
        }
        Update: {
          clinic_id?: string
          competencia?: string
          fechado_at?: string
          fechado_por?: string | null
          id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencia_fechamentos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencia_fechamentos_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencia_fechamentos_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencia_fechamentos_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          ativo: boolean
          clinic_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      dental_records: {
        Row: {
          appointment_id: string | null
          created_at: string
          dentist_id: string
          id: string
          notes: string | null
          patient_id: string
          status: string
          tenant_id: string
          tooth_number: number
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          dentist_id: string
          id?: string
          notes?: string | null
          patient_id: string
          status: string
          tenant_id: string
          tooth_number: number
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          dentist_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          tenant_id?: string
          tooth_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "dental_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_records_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_records_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      document_seq_counters: {
        Row: {
          clinic_id: string
          doc_type: string
          id: string
          last_seq: number
        }
        Insert: {
          clinic_id: string
          doc_type: string
          id?: string
          last_seq?: number
        }
        Update: {
          clinic_id?: string
          doc_type?: string
          id?: string
          last_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_seq_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          clinic_id: string
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          category: string
          clinic_id: string
          content: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          category?: string
          clinic_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          cert_not_after: string | null
          cert_pem: string | null
          cert_thumbprint: string | null
          clinic_id: string
          content: string
          content_hash: string
          created_at: string
          document_id: string
          id: string
          is_content_encrypted: boolean
          signature: string | null
          signed_at: string | null
          signed_by: string | null
          signer_cn: string | null
          storage_path: string | null
          supersedes_id: string | null
          version_number: number
        }
        Insert: {
          cert_not_after?: string | null
          cert_pem?: string | null
          cert_thumbprint?: string | null
          clinic_id: string
          content: string
          content_hash: string
          created_at?: string
          document_id: string
          id?: string
          is_content_encrypted?: boolean
          signature?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_cn?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          version_number: number
        }
        Update: {
          cert_not_after?: string | null
          cert_pem?: string | null
          cert_thumbprint?: string | null
          clinic_id?: string
          content?: string
          content_hash?: string
          created_at?: string
          document_id?: string
          id?: string
          is_content_encrypted?: boolean
          signature?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_cn?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          clinic_id: string
          created_at: string
          created_by: string | null
          current_version: number
          deleted_at: string | null
          id: string
          patient_id: string | null
          status: string
          template_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          deleted_at?: string | null
          id?: string
          patient_id?: string | null
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          deleted_at?: string | null
          id?: string
          patient_id?: string | null
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          type: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number
          bank_account_id: string | null
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string | null
          id: string
          posted_by: string | null
          receivable_id: string | null
          reconciliation_status: string
          statement_line_id: string | null
          tenant_id: string
          transaction_date: string
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          posted_by?: string | null
          receivable_id?: string | null
          reconciliation_status?: string
          statement_line_id?: string | null
          tenant_id: string
          transaction_date: string
          type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          posted_by?: string | null
          receivable_id?: string | null
          reconciliation_status?: string
          statement_line_id?: string | null
          tenant_id?: string
          transaction_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "statement_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      glosa_motivos: {
        Row: {
          ativo: boolean
          clinic_id: string | null
          codigo_ans: string
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean
          clinic_id?: string | null
          codigo_ans: string
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string | null
          codigo_ans?: string
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glosa_motivos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      inss_tax_tables: {
        Row: {
          aliquota: number
          created_at: string
          faixa_max: number | null
          faixa_min: number
          id: string
          parcela_deduzir: number
          teto: number | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aliquota: number
          created_at?: string
          faixa_max?: number | null
          faixa_min: number
          id?: string
          parcela_deduzir?: number
          teto?: number | null
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          aliquota?: number
          created_at?: string
          faixa_max?: number | null
          faixa_min?: number
          id?: string
          parcela_deduzir?: number
          teto?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      insurer_prices: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          insurer_id: string
          service_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          insurer_id: string
          service_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          insurer_id?: string
          service_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_insurer_prices_insurer"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_prices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          ativo: boolean
          clinic_id: string
          cnpj: string | null
          connector_id: string | null
          contato_email: string | null
          contato_phone: string | null
          created_at: string
          id: string
          name: string
          prazo_pagamento_dias: number
          registro_ans: string | null
          status: string
          tiss_version: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinic_id: string
          cnpj?: string | null
          connector_id?: string | null
          contato_email?: string | null
          contato_phone?: string | null
          created_at?: string
          id?: string
          name: string
          prazo_pagamento_dias?: number
          registro_ans?: string | null
          status?: string
          tiss_version?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string
          cnpj?: string | null
          connector_id?: string | null
          contato_email?: string | null
          contato_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          prazo_pagamento_dias?: number
          registro_ans?: string | null
          status?: string
          tiss_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurers_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connectors: {
        Row: {
          clinic_id: string | null
          config: Json
          created_at: string
          credential_enc: string | null
          deleted_at: string | null
          id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          config?: Json
          created_at?: string
          credential_enc?: string | null
          deleted_at?: string | null
          id?: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          config?: Json
          created_at?: string
          credential_enc?: string | null
          deleted_at?: string | null
          id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connectors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          attempts: number
          clinic_id: string | null
          connector_id: string | null
          created_at: string
          direction: string
          event_type: string | null
          external_event_id: string | null
          id: string
          last_error: string | null
          max_attempts: number
          payload_ref: string | null
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          clinic_id?: string | null
          connector_id?: string | null
          created_at?: string
          direction: string
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload_ref?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          clinic_id?: string | null
          connector_id?: string | null
          created_at?: string
          direction?: string
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload_ref?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_events_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      irrf_tax_tables: {
        Row: {
          aliquota: number
          created_at: string
          faixa_max: number | null
          faixa_min: number
          formula_desconto: string | null
          id: string
          parcela_deduzir: number
          teto: number | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aliquota: number
          created_at?: string
          faixa_max?: number | null
          faixa_min: number
          formula_desconto?: string | null
          id?: string
          parcela_deduzir?: number
          teto?: number | null
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          aliquota?: number
          created_at?: string
          faixa_max?: number | null
          faixa_min?: number
          formula_desconto?: string | null
          id?: string
          parcela_deduzir?: number
          teto?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      iss_tax_tables: {
        Row: {
          aliquota: number
          codigo_ibge: string
          created_at: string
          id: string
          municipio: string
          servico_lc116: string | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aliquota: number
          codigo_ibge: string
          created_at?: string
          id?: string
          municipio: string
          servico_lc116?: string | null
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          aliquota?: number
          codigo_ibge?: string
          created_at?: string
          id?: string
          municipio?: string
          servico_lc116?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      kit_usages: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          kit_label: string | null
          patient_id: string
          sterilization_cycle_id: string
          unit_id: string | null
          used_at: string
          used_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kit_label?: string | null
          patient_id: string
          sterilization_cycle_id: string
          unit_id?: string | null
          used_at?: string
          used_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kit_label?: string | null
          patient_id?: string
          sterilization_cycle_id?: string
          unit_id?: string | null
          used_at?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kit_usages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_usages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_usages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_usages_sterilization_cycle_id_fkey"
            columns: ["sterilization_cycle_id"]
            isOneToOne: false
            referencedRelation: "sterilization_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_usages_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_usages_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_usages_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string | null
          financial_transaction_id: string | null
          id: string
          lab_id: string
          notes: string | null
          order_number: string | null
          patient_id: string
          prosthesis_type: string
          stages: Json
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          financial_transaction_id?: string | null
          id?: string
          lab_id: string
          notes?: string | null
          order_number?: string | null
          patient_id: string
          prosthesis_type: string
          stages?: Json
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          financial_transaction_id?: string | null
          id?: string
          lab_id?: string
          notes?: string | null
          order_number?: string | null
          patient_id?: string
          prosthesis_type?: string
          stages?: Json
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "prosthetic_labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          created_at: string
          dentist_id: string
          diagnosis: string | null
          id: string
          patient_id: string
          prescription: string | null
          tenant_id: string
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          dentist_id: string
          diagnosis?: string | null
          id?: string
          patient_id: string
          prescription?: string | null
          tenant_id: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          dentist_id?: string
          diagnosis?: string | null
          id?: string
          patient_id?: string
          prescription?: string | null
          tenant_id?: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          allergen_tags: string[]
          common_dosages: string[]
          created_at: string
          generic_name: string | null
          id: string
          name: string
          requires_special_control: boolean
          therapeutic_class: string
        }
        Insert: {
          active?: boolean
          allergen_tags?: string[]
          common_dosages?: string[]
          created_at?: string
          generic_name?: string | null
          id?: string
          name: string
          requires_special_control?: boolean
          therapeutic_class: string
        }
        Update: {
          active?: boolean
          allergen_tags?: string[]
          common_dosages?: string[]
          created_at?: string
          generic_name?: string | null
          id?: string
          name?: string
          requires_special_control?: boolean
          therapeutic_class?: string
        }
        Relationships: []
      }
      message_log: {
        Row: {
          appointment_id: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          id: string
          sent_at: string
          tenant_id: string
          type: string
        }
        Insert: {
          appointment_id: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          id?: string
          sent_at?: string
          tenant_id: string
          type: string
        }
        Update: {
          appointment_id?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          id?: string
          sent_at?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      message_outbox: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          last_attempted_at: string | null
          max_attempts: number
          payload: Json
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          last_attempted_at?: string | null
          max_attempts?: number
          payload: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          last_attempted_at?: string | null
          max_attempts?: number
          payload?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      nfse_records: {
        Row: {
          aliquota_iss: number
          cancelada_at: string | null
          clinic_id: string
          created_at: string
          emitida_at: string | null
          error_message: string | null
          id: string
          iss_retido: boolean
          numero: string | null
          pdf_storage_path: string | null
          provider_ref: string | null
          serie: string | null
          service_order_id: string | null
          status: string
          tomador_nome: string | null
          unit_id: string | null
          updated_at: string
          valor_iss: number
          valor_liquido: number
          valor_servicos: number
          xml_storage_path: string | null
        }
        Insert: {
          aliquota_iss: number
          cancelada_at?: string | null
          clinic_id: string
          created_at?: string
          emitida_at?: string | null
          error_message?: string | null
          id?: string
          iss_retido?: boolean
          numero?: string | null
          pdf_storage_path?: string | null
          provider_ref?: string | null
          serie?: string | null
          service_order_id?: string | null
          status?: string
          tomador_nome?: string | null
          unit_id?: string | null
          updated_at?: string
          valor_iss: number
          valor_liquido: number
          valor_servicos: number
          xml_storage_path?: string | null
        }
        Update: {
          aliquota_iss?: number
          cancelada_at?: string | null
          clinic_id?: string
          created_at?: string
          emitida_at?: string | null
          error_message?: string | null
          id?: string
          iss_retido?: boolean
          numero?: string | null
          pdf_storage_path?: string | null
          provider_ref?: string | null
          serie?: string | null
          service_order_id?: string | null
          status?: string
          tomador_nome?: string | null
          unit_id?: string | null
          updated_at?: string
          valor_iss?: number
          valor_liquido?: number
          valor_servicos?: number
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfse_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfse_records_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfse_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_extractions: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          extracted_fields: Json
          id: string
          min_confidence: number
          reviewed_at: string | null
          reviewed_by: string | null
          source_filename: string | null
          status: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          extracted_fields: Json
          id?: string
          min_confidence: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_filename?: string | null
          status?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          extracted_fields?: Json
          id?: string
          min_confidence?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_filename?: string | null
          status?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_extractions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_extractions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_extractions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_extractions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_extractions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_consents: {
        Row: {
          consent_type: string
          consented_at: string
          created_at: string
          id: string
          ip_address: unknown
          patient_id: string
          policy_version: string
          revoked_at: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          consent_type: string
          consented_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          patient_id: string
          policy_version: string
          revoked_at?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          consent_type?: string
          consented_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          patient_id?: string
          policy_version?: string
          revoked_at?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          asaas_customer_id: string | null
          cpf: string
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_anonymized: boolean
          medical_history: string | null
          medications: string | null
          phone: string | null
          registered_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          asaas_customer_id?: string | null
          cpf: string
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_anonymized?: boolean
          medical_history?: string | null
          medications?: string | null
          phone?: string | null
          registered_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          asaas_customer_id?: string | null
          cpf?: string
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_anonymized?: boolean
          medical_history?: string | null
          medications?: string | null
          phone?: string | null
          registered_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_installments: {
        Row: {
          clinic_id: string
          created_at: string
          due_date: string
          financial_transaction_id: string | null
          id: string
          numero: number
          paid_at: string | null
          payable_id: string
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          due_date: string
          financial_transaction_id?: string | null
          id?: string
          numero?: number
          paid_at?: string | null
          payable_id: string
          status?: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          due_date?: string
          financial_transaction_id?: string | null
          id?: string
          numero?: number
          paid_at?: string | null
          payable_id?: string
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_installments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_installments_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_installments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          account_id: string | null
          bank_account_id: string | null
          clinic_id: string
          competencia: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          descricao: string
          document_id: string | null
          id: string
          lab_order_id: string | null
          notes: string | null
          origem: string
          payout_id: string | null
          recorrente_template_id: string | null
          status: string
          supplier_id: string | null
          unit_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          account_id?: string | null
          bank_account_id?: string | null
          clinic_id: string
          competencia?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao: string
          document_id?: string | null
          id?: string
          lab_order_id?: string | null
          notes?: string | null
          origem?: string
          payout_id?: string | null
          recorrente_template_id?: string | null
          status?: string
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
          valor_total: number
        }
        Update: {
          account_id?: string | null
          bank_account_id?: string | null
          clinic_id?: string
          competencia?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string
          document_id?: string | null
          id?: string
          lab_order_id?: string | null
          notes?: string | null
          origem?: string
          payout_id?: string | null
          recorrente_template_id?: string | null
          status?: string
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_payables_payout"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "professional_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_items: {
        Row: {
          clinic_id: string
          created_at: string
          descricao: string
          id: string
          payout_id: string
          percentual_item: number
          service_order_id: string | null
          statement_line_id: string | null
          valor_base_item: number
          valor_recebido: number
          valor_repasse_item: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          descricao: string
          id?: string
          payout_id: string
          percentual_item: number
          service_order_id?: string | null
          statement_line_id?: string | null
          valor_base_item: number
          valor_recebido: number
          valor_repasse_item: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          descricao?: string
          id?: string
          payout_id?: string
          percentual_item?: number
          service_order_id?: string | null
          statement_line_id?: string | null
          valor_base_item?: number
          valor_recebido?: number
          valor_repasse_item?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "professional_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "statement_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability: {
        Row: {
          clinic_id: string
          created_at: string
          end_time: string
          id: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability_exceptions: {
        Row: {
          clinic_id: string
          created_at: string
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          professional_id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          end_time?: string | null
          exception_date: string
          exception_type: string
          id?: string
          professional_id: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_exceptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_payouts: {
        Row: {
          clinic_id: string
          competencia: string
          created_at: string
          created_by: string | null
          deducoes: Json
          id: string
          payable_id: string | null
          percentual: number
          professional_id: string
          status: string
          unit_id: string | null
          updated_at: string
          valor_base: number
          valor_bruto: number
          valor_repasse: number
        }
        Insert: {
          clinic_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          deducoes?: Json
          id?: string
          payable_id?: string | null
          percentual: number
          professional_id: string
          status?: string
          unit_id?: string | null
          updated_at?: string
          valor_base: number
          valor_bruto: number
          valor_repasse: number
        }
        Update: {
          clinic_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          deducoes?: Json
          id?: string
          payable_id?: string | null
          percentual?: number
          professional_id?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
          valor_base?: number
          valor_bruto?: number
          valor_repasse?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_payouts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_payouts_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_payouts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_payouts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          ativo: boolean
          clinic_id: string
          commission_rules: Json
          created_at: string
          cro: string
          cro_uf: string
          deleted_at: string | null
          especialidades: string[]
          full_name: string
          id: string
          supplier_id: string | null
          unit_id: string | null
          updated_at: string
          user_id: string | null
          vinculo: string
        }
        Insert: {
          ativo?: boolean
          clinic_id: string
          commission_rules?: Json
          created_at?: string
          cro: string
          cro_uf: string
          deleted_at?: string | null
          especialidades?: string[]
          full_name: string
          id?: string
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
          vinculo?: string
        }
        Update: {
          ativo?: boolean
          clinic_id?: string
          commission_rules?: Json
          created_at?: string
          cro?: string
          cro_uf?: string
          deleted_at?: string | null
          especialidades?: string[]
          full_name?: string
          id?: string
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
          vinculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      prosthetic_labs: {
        Row: {
          clinic_id: string
          cnpj: string | null
          contato_nome: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          nome: string
          notes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          cnpj?: string | null
          contato_nome?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome: string
          notes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          cnpj?: string | null
          contato_nome?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          notes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prosthetic_labs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          charge_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          paid_at: string | null
          patient_id: string | null
          provider_charge_id: string | null
          status: string
          tenant_id: string
          unit_id: string
          updated_at: string
          value: number
        }
        Insert: {
          charge_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          patient_id?: string | null
          provider_charge_id?: string | null
          status?: string
          tenant_id: string
          unit_id: string
          updated_at?: string
          value: number
        }
        Update: {
          charge_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          patient_id?: string | null
          provider_charge_id?: string | null
          status?: string
          tenant_id?: string
          unit_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "receivables_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      recorrente_templates: {
        Row: {
          account_id: string | null
          ativo: boolean
          clinic_id: string
          cost_center_id: string | null
          created_at: string
          descricao: string
          dia_vencimento: number
          id: string
          supplier_id: string | null
          unit_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          account_id?: string | null
          ativo?: boolean
          clinic_id: string
          cost_center_id?: string | null
          created_at?: string
          descricao: string
          dia_vencimento: number
          id?: string
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          account_id?: string | null
          ativo?: boolean
          clinic_id?: string
          cost_center_id?: string | null
          created_at?: string
          descricao?: string
          dia_vencimento?: number
          id?: string
          supplier_id?: string | null
          unit_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recorrente_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrente_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrente_templates_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrente_templates_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrente_templates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      reinf_events: {
        Row: {
          clinic_id: string
          competencia: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          payload: Json
          protocolo: string | null
          provider_ref: string | null
          status: string
          tipo: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          payload: Json
          protocolo?: string | null
          provider_ref?: string | null
          status?: string
          tipo: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          payload?: Json
          protocolo?: string | null
          provider_ref?: string | null
          status?: string
          tipo?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reinf_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reinf_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reinf_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reinf_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          manutencao_prevista: string | null
          nome: string
          numero_serie: string | null
          patrimonio: string | null
          status: string
          tipo: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          manutencao_prevista?: string | null
          nome: string
          numero_serie?: string | null
          patrimonio?: string | null
          status?: string
          tipo: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          manutencao_prevista?: string | null
          nome?: string
          numero_serie?: string | null
          patrimonio?: string | null
          status?: string
          tipo?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rpa_records: {
        Row: {
          aliquota_inss: number | null
          aliquota_irrf: number | null
          aliquota_iss: number | null
          clinic_id: string
          competencia: string
          created_at: string
          created_by: string | null
          data_pagamento: string
          id: string
          modalidade_inss: string | null
          municipio_ibge: string | null
          numero: string
          payable_id: string | null
          payout_id: string | null
          pdf_storage_path: string | null
          professional_id: string | null
          regime_tributario: string | null
          reinf_event_id: string | null
          status: string
          supplier_id: string
          unit_id: string | null
          updated_at: string
          valor_bruto: number
          valor_inss: number
          valor_irrf: number
          valor_iss: number
          valor_liquido: number
        }
        Insert: {
          aliquota_inss?: number | null
          aliquota_irrf?: number | null
          aliquota_iss?: number | null
          clinic_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          data_pagamento: string
          id?: string
          modalidade_inss?: string | null
          municipio_ibge?: string | null
          numero: string
          payable_id?: string | null
          payout_id?: string | null
          pdf_storage_path?: string | null
          professional_id?: string | null
          regime_tributario?: string | null
          reinf_event_id?: string | null
          status?: string
          supplier_id: string
          unit_id?: string | null
          updated_at?: string
          valor_bruto: number
          valor_inss?: number
          valor_irrf?: number
          valor_iss?: number
          valor_liquido: number
        }
        Update: {
          aliquota_inss?: number | null
          aliquota_irrf?: number | null
          aliquota_iss?: number | null
          clinic_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          id?: string
          modalidade_inss?: string | null
          municipio_ibge?: string | null
          numero?: string
          payable_id?: string | null
          payout_id?: string | null
          pdf_storage_path?: string | null
          professional_id?: string | null
          regime_tributario?: string | null
          reinf_event_id?: string | null
          status?: string
          supplier_id?: string
          unit_id?: string | null
          updated_at?: string
          valor_bruto?: number
          valor_inss?: number
          valor_irrf?: number
          valor_iss?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_rpa_reinf_event"
            columns: ["reinf_event_id"]
            isOneToOne: false
            referencedRelation: "reinf_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "professional_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpa_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          account_id: string | null
          clinic_id: string
          cost_center_id: string | null
          created_at: string
          dente: string | null
          desconto: number
          description: string
          face: string | null
          id: string
          professional_id: string | null
          quantity: number
          service_id: string | null
          service_order_id: string
          tuss_code: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          account_id?: string | null
          clinic_id: string
          cost_center_id?: string | null
          created_at?: string
          dente?: string | null
          desconto?: number
          description: string
          face?: string | null
          id?: string
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          service_order_id: string
          tuss_code?: string | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          account_id?: string | null
          clinic_id?: string
          cost_center_id?: string | null
          created_at?: string
          dente?: string | null
          desconto?: number
          description?: string
          face?: string | null
          id?: string
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          service_order_id?: string
          tuss_code?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          acrescimo_total: number
          appointment_id: string | null
          cancel_reason: string | null
          cancelada_at: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          desconto_total: number
          faturada_at: string | null
          id: string
          idempotency_key: string | null
          insurer_id: string | null
          notes: string | null
          numero: string
          pagador: string
          patient_id: string | null
          professional_id: string | null
          status: string
          total: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          acrescimo_total?: number
          appointment_id?: string | null
          cancel_reason?: string | null
          cancelada_at?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          desconto_total?: number
          faturada_at?: string | null
          id?: string
          idempotency_key?: string | null
          insurer_id?: string | null
          notes?: string | null
          numero: string
          pagador?: string
          patient_id?: string | null
          professional_id?: string | null
          status?: string
          total?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          acrescimo_total?: number
          appointment_id?: string | null
          cancel_reason?: string | null
          cancelada_at?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          desconto_total?: number
          faturada_at?: string | null
          id?: string
          idempotency_key?: string | null
          insurer_id?: string | null
          notes?: string | null
          numero?: string
          pagador?: string
          patient_id?: string | null
          professional_id?: string | null
          status?: string
          total?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          account_id: string | null
          aliquota_iss_override: number | null
          ativo: boolean
          clinic_id: string
          code: string | null
          created_at: string
          description: string | null
          id: string
          item_lista_servico_override: string | null
          name: string
          tuss_code: string | null
          updated_at: string
          valor_particular: number
        }
        Insert: {
          account_id?: string | null
          aliquota_iss_override?: number | null
          ativo?: boolean
          clinic_id: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_lista_servico_override?: string | null
          name: string
          tuss_code?: string | null
          updated_at?: string
          valor_particular?: number
        }
        Update: {
          account_id?: string | null
          aliquota_iss_override?: number | null
          ativo?: boolean
          clinic_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_lista_servico_override?: string | null
          name?: string
          tuss_code?: string | null
          updated_at?: string
          valor_particular?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      soap_records: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          deleted_at: string | null
          dentist_id: string
          id: string
          patient_id: string
          soap_assessment: string | null
          soap_objective: string | null
          soap_plan: string | null
          soap_subjective: string | null
          teleconsultation_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          dentist_id: string
          id?: string
          patient_id: string
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          teleconsultation_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          dentist_id?: string
          id?: string
          patient_id?: string
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          teleconsultation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soap_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soap_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soap_records_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soap_records_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soap_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soap_records_teleconsultation_id_fkey"
            columns: ["teleconsultation_id"]
            isOneToOne: false
            referencedRelation: "teleconsultations"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_lines: {
        Row: {
          amount: number
          bank_account_id: string
          bank_statement_id: string
          check_number: string | null
          clinic_id: string
          created_at: string
          fee_transaction_id: string | null
          fitid: string | null
          fitid_fallback: string | null
          id: string
          matched_transaction_ids: string[] | null
          memo: string | null
          reconciliation_status: string
          transaction_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          bank_statement_id: string
          check_number?: string | null
          clinic_id: string
          created_at?: string
          fee_transaction_id?: string | null
          fitid?: string | null
          fitid_fallback?: string | null
          id?: string
          matched_transaction_ids?: string[] | null
          memo?: string | null
          reconciliation_status?: string
          transaction_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          bank_statement_id?: string
          check_number?: string | null
          clinic_id?: string
          created_at?: string
          fee_transaction_id?: string | null
          fitid?: string | null
          fitid_fallback?: string | null
          id?: string
          matched_transaction_ids?: string[] | null
          memo?: string | null
          reconciliation_status?: string
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_lines_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_lines_bank_statement_id_fkey"
            columns: ["bank_statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_lines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_lines_fee_transaction_id_fkey"
            columns: ["fee_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      sterilization_cycles: {
        Row: {
          autoclave_id: string
          biological_result: string
          clinic_id: string
          created_at: string
          created_by: string | null
          cycle_date: string
          cycle_number: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          operator_id: string | null
          pressao: number | null
          status: string
          temperatura: number | null
          tempo_minutos: number | null
          unit_id: string | null
          updated_at: string
          validade: string | null
        }
        Insert: {
          autoclave_id: string
          biological_result?: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          cycle_date?: string
          cycle_number?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          pressao?: number | null
          status?: string
          temperatura?: number | null
          tempo_minutos?: number | null
          unit_id?: string | null
          updated_at?: string
          validade?: string | null
        }
        Update: {
          autoclave_id?: string
          biological_result?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          cycle_date?: string
          cycle_number?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          pressao?: number | null
          status?: string
          temperatura?: number | null
          tempo_minutos?: number | null
          unit_id?: string | null
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sterilization_cycles_autoclave_id_fkey"
            columns: ["autoclave_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sterilization_cycles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sterilization_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sterilization_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sterilization_cycles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sterilization_cycles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sterilization_cycles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          clinic_id: string
          cnpj_cpf: string | null
          conta: string | null
          created_at: string
          deleted_at: string | null
          id: string
          iss_override: number | null
          iss_retido_fonte: boolean
          lab_id: string | null
          modalidade_inss: string
          name: string
          pix_key: string | null
          professional_id: string | null
          tipo: string
          updated_at: string
          vinculo: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          clinic_id: string
          cnpj_cpf?: string | null
          conta?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          iss_override?: number | null
          iss_retido_fonte?: boolean
          lab_id?: string | null
          modalidade_inss?: string
          name: string
          pix_key?: string | null
          professional_id?: string | null
          tipo: string
          updated_at?: string
          vinculo?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          clinic_id?: string
          cnpj_cpf?: string | null
          conta?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          iss_override?: number | null
          iss_retido_fonte?: boolean
          lab_id?: string | null
          modalidade_inss?: string
          name?: string
          pix_key?: string | null
          professional_id?: string | null
          tipo?: string
          updated_at?: string
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "prosthetic_labs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      teleconsultations: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          consent_given: boolean
          consent_given_at: string | null
          consent_ip: unknown
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ended_at: string | null
          external_link: string | null
          id: string
          notes: string | null
          patient_id: string
          professional_id: string | null
          started_at: string | null
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          consent_given?: boolean
          consent_given_at?: string | null
          consent_ip?: unknown
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          external_link?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          professional_id?: string | null
          started_at?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          consent_given?: boolean
          consent_given_at?: string | null
          consent_ip?: unknown
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          external_link?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          professional_id?: string | null
          started_at?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teleconsultations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsultations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsultations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsultations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsultations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleconsultations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_guide_items: {
        Row: {
          clinic_id: string
          created_at: string
          dente: string | null
          description: string
          face: string | null
          glosa_status: string | null
          guide_id: string
          id: string
          motivo_glosa_id: string | null
          quantity: number
          recurso_at: string | null
          recurso_texto: string | null
          service_order_item_id: string | null
          tuss_code: string | null
          updated_at: string
          valor_glosado: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          dente?: string | null
          description: string
          face?: string | null
          glosa_status?: string | null
          guide_id: string
          id?: string
          motivo_glosa_id?: string | null
          quantity?: number
          recurso_at?: string | null
          recurso_texto?: string | null
          service_order_item_id?: string | null
          tuss_code?: string | null
          updated_at?: string
          valor_glosado?: number
          valor_total: number
          valor_unitario: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          dente?: string | null
          description?: string
          face?: string | null
          glosa_status?: string | null
          guide_id?: string
          id?: string
          motivo_glosa_id?: string | null
          quantity?: number
          recurso_at?: string | null
          recurso_texto?: string | null
          service_order_item_id?: string | null
          tuss_code?: string | null
          updated_at?: string
          valor_glosado?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "tiss_guide_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guide_items_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "tiss_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guide_items_motivo_glosa_id_fkey"
            columns: ["motivo_glosa_id"]
            isOneToOne: false
            referencedRelation: "glosa_motivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guide_items_service_order_item_id_fkey"
            columns: ["service_order_item_id"]
            isOneToOne: false
            referencedRelation: "service_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_guides: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          insurer_id: string
          lote_id: string | null
          numero_carteira: string | null
          numero_guia: string
          patient_id: string | null
          protocolo: string | null
          provider_ref: string | null
          registro_ans: string | null
          service_order_id: string
          status: string
          updated_at: string
          valor_autorizado: number | null
          valor_glosado: number
          valor_pago: number | null
          valor_total: number
          xml_storage_path: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          insurer_id: string
          lote_id?: string | null
          numero_carteira?: string | null
          numero_guia: string
          patient_id?: string | null
          protocolo?: string | null
          provider_ref?: string | null
          registro_ans?: string | null
          service_order_id: string
          status?: string
          updated_at?: string
          valor_autorizado?: number | null
          valor_glosado?: number
          valor_pago?: number | null
          valor_total?: number
          xml_storage_path?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          insurer_id?: string
          lote_id?: string | null
          numero_carteira?: string | null
          numero_guia?: string
          patient_id?: string | null
          protocolo?: string | null
          provider_ref?: string | null
          registro_ans?: string | null
          service_order_id?: string
          status?: string
          updated_at?: string
          valor_autorizado?: number | null
          valor_glosado?: number
          valor_pago?: number | null
          valor_total?: number
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiss_guides_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guides_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guides_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "tiss_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guides_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_lotes: {
        Row: {
          clinic_id: string
          competencia: string
          created_at: string
          data_envio: string | null
          id: string
          insurer_id: string
          numero: string
          protocolo: string | null
          provider_ref: string | null
          status: string
          updated_at: string
          valor_total: number
          xml_storage_path: string | null
        }
        Insert: {
          clinic_id: string
          competencia: string
          created_at?: string
          data_envio?: string | null
          id?: string
          insurer_id: string
          numero: string
          protocolo?: string | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
          xml_storage_path?: string | null
        }
        Update: {
          clinic_id?: string
          competencia?: string
          created_at?: string
          data_envio?: string | null
          id?: string
          insurer_id?: string
          numero?: string
          protocolo?: string | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiss_lotes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_lotes_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_fiscal_config: {
        Row: {
          aliquota_iss_padrao: number
          ativo: boolean
          clinic_id: string
          created_at: string
          emitente_cnpj: string
          emitente_inscricao_mun: string | null
          id: string
          item_lista_servico: string
          municipio_codigo_ibge: string
          proximo_numero_rps: number
          regime_emissao: string
          serie_rps: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          aliquota_iss_padrao?: number
          ativo?: boolean
          clinic_id: string
          created_at?: string
          emitente_cnpj: string
          emitente_inscricao_mun?: string | null
          id?: string
          item_lista_servico?: string
          municipio_codigo_ibge: string
          proximo_numero_rps?: number
          regime_emissao?: string
          serie_rps?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          aliquota_iss_padrao?: number
          ativo?: boolean
          clinic_id?: string
          created_at?: string
          emitente_cnpj?: string
          emitente_inscricao_mun?: string | null
          id?: string
          item_lista_servico?: string
          municipio_codigo_ibge?: string
          proximo_numero_rps?: number
          regime_emissao?: string
          serie_rps?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_fiscal_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_fiscal_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_os_counters: {
        Row: {
          clinic_id: string
          last_os_number: number
          unit_id: string
        }
        Insert: {
          clinic_id: string
          last_os_number?: number
          unit_id: string
        }
        Update: {
          clinic_id?: string
          last_os_number?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_os_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_os_counters_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_rpa_counters: {
        Row: {
          clinic_id: string
          last_rpa_number: number
          unit_id: string
        }
        Insert: {
          clinic_id: string
          last_rpa_number?: number
          unit_id: string
        }
        Update: {
          clinic_id?: string
          last_rpa_number?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_rpa_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_rpa_counters_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          ativo: boolean
          clinic_id: string
          cnpj: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          name: string
          phone: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          ativo?: boolean
          clinic_id: string
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          phone?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          ativo?: boolean
          clinic_id?: string
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_units: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          unit_id: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          unit_id: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_units_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_units_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_units_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          role: string
          sensitive_data: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          role?: string
          sensitive_data?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string
          sensitive_data?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          asaas_event_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          processed: boolean
        }
        Insert: {
          asaas_event_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean
        }
        Update: {
          asaas_event_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean
        }
        Relationships: []
      }
      whatsapp_inbound_events: {
        Row: {
          created_at: string
          from_phone: string
          id: string
          payload: Json
          processed: boolean
          wamid: string
        }
        Insert: {
          created_at?: string
          from_phone: string
          id?: string
          payload: Json
          processed?: boolean
          wamid: string
        }
        Update: {
          created_at?: string
          from_phone?: string
          id?: string
          payload?: Json
          processed?: boolean
          wamid?: string
        }
        Relationships: []
      }
    }
    Views: {
      users_masked: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          role: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          role?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          role?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_my_role: { Args: never; Returns: string }
      get_my_tenant_id: { Args: never; Returns: string }
      get_my_unit_ids: { Args: never; Returns: string[] }
      next_doc_number: {
        Args: { p_clinic_id: string; p_doc_type: string }
        Returns: string
      }
      next_os_number: { Args: { p_unit_id: string }; Returns: string }
      next_rpa_number: { Args: { p_unit_id: string }; Returns: string }
    }
    Enums: {
      message_channel: "whatsapp" | "email"
      message_status: "pending" | "sent" | "failed"
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
      message_channel: ["whatsapp", "email"],
      message_status: ["pending", "sent", "failed"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.107.0 (currently installed v2.105.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
