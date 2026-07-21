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
      erf_asset_events: {
        Row: {
          asset_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          parcel_id: string
          user_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          parcel_id: string
          user_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          parcel_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erf_asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "erf_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      erf_assets: {
        Row: {
          asset_category: string
          asset_type: string
          checksum_sha256: string | null
          created_at: string
          id: string
          local_migration_fingerprint: string | null
          metadata: Json
          mime_type: string
          original_file_name: string
          parcel_id: string
          size_bytes: number
          source_label: string | null
          status: string
          storage_bucket: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_category: string
          asset_type: string
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          local_migration_fingerprint?: string | null
          metadata?: Json
          mime_type: string
          original_file_name: string
          parcel_id: string
          size_bytes: number
          source_label?: string | null
          status?: string
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_category?: string
          asset_type?: string
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          local_migration_fingerprint?: string | null
          metadata?: Json
          mime_type?: string
          original_file_name?: string
          parcel_id?: string
          size_bytes?: number
          source_label?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      erf_design_pack_items: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          created_at: string
          design_pack_id: string
          failure_code: string | null
          failure_message: string | null
          generated_asset_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          next_attempt_at: string
          option_index: number
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          created_at?: string
          design_pack_id: string
          failure_code?: string | null
          failure_message?: string | null
          generated_asset_id?: string | null
          heartbeat_at?: string | null
          id?: string
          lease_expires_at?: string | null
          next_attempt_at?: string
          option_index: number
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          created_at?: string
          design_pack_id?: string
          failure_code?: string | null
          failure_message?: string | null
          generated_asset_id?: string | null
          heartbeat_at?: string | null
          id?: string
          lease_expires_at?: string | null
          next_attempt_at?: string
          option_index?: number
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erf_design_pack_items_design_pack_id_fkey"
            columns: ["design_pack_id"]
            isOneToOne: false
            referencedRelation: "erf_design_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erf_design_pack_items_generated_asset_id_fkey"
            columns: ["generated_asset_id"]
            isOneToOne: false
            referencedRelation: "erf_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      erf_design_packs: {
        Row: {
          claimed_at: string | null
          completed_count: number
          created_at: string
          entitlement_status: string
          failure_code: string | null
          failure_message: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          next_attempt_at: string
          parcel_id: string
          payment_provider: string | null
          payment_reference: string | null
          prompt_snapshot: Json
          requested_count: number
          site_project_id: string
          status: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          completed_count?: number
          created_at?: string
          entitlement_status?: string
          failure_code?: string | null
          failure_message?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key: string
          lease_expires_at?: string | null
          next_attempt_at?: string
          parcel_id: string
          payment_provider?: string | null
          payment_reference?: string | null
          prompt_snapshot?: Json
          requested_count?: number
          site_project_id: string
          status?: string
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          completed_count?: number
          created_at?: string
          entitlement_status?: string
          failure_code?: string | null
          failure_message?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string
          lease_expires_at?: string | null
          next_attempt_at?: string
          parcel_id?: string
          payment_provider?: string | null
          payment_reference?: string | null
          prompt_snapshot?: Json
          requested_count?: number
          site_project_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erf_design_packs_site_project_id_fkey"
            columns: ["site_project_id"]
            isOneToOne: false
            referencedRelation: "erf_site_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      erf_site_project_assets: {
        Row: {
          asset_id: string
          created_at: string
          display_order: number
          id: string
          role: string
          site_project_id: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          display_order?: number
          id?: string
          role: string
          site_project_id: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          display_order?: number
          id?: string
          role?: string
          site_project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erf_site_project_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "erf_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erf_site_project_assets_site_project_id_fkey"
            columns: ["site_project_id"]
            isOneToOne: false
            referencedRelation: "erf_site_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      erf_site_projects: {
        Row: {
          created_at: string
          custom_instructions: string | null
          design_brief: string | null
          generation_status: string
          id: string
          metadata: Json
          mode: string
          parcel_id: string
          renovation_level: string | null
          requested_features: string[]
          requested_rooms: string[]
          rights_confirmed_at: string | null
          selected_design_asset_id: string | null
          selected_style: string | null
          skipped_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_instructions?: string | null
          design_brief?: string | null
          generation_status?: string
          id?: string
          metadata?: Json
          mode?: string
          parcel_id: string
          renovation_level?: string | null
          requested_features?: string[]
          requested_rooms?: string[]
          rights_confirmed_at?: string | null
          selected_design_asset_id?: string | null
          selected_style?: string | null
          skipped_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_instructions?: string | null
          design_brief?: string | null
          generation_status?: string
          id?: string
          metadata?: Json
          mode?: string
          parcel_id?: string
          renovation_level?: string | null
          requested_features?: string[]
          requested_rooms?: string[]
          rights_confirmed_at?: string | null
          selected_design_asset_id?: string | null
          selected_style?: string | null
          skipped_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erf_site_projects_selected_design_asset_id_fkey"
            columns: ["selected_design_asset_id"]
            isOneToOne: false
            referencedRelation: "erf_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_listings: {
        Row: {
          agency: string | null
          agent: string | null
          asking_price_cents: number | null
          created_at: string
          found_at: string | null
          id: string
          notes: string | null
          parcel_id: string
          status: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          agency?: string | null
          agent?: string | null
          asking_price_cents?: number | null
          created_at?: string
          found_at?: string | null
          id?: string
          notes?: string | null
          parcel_id: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          agency?: string | null
          agent?: string | null
          asking_price_cents?: number | null
          created_at?: string
          found_at?: string | null
          id?: string
          notes?: string | null
          parcel_id?: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      property_notes: {
        Row: {
          agent_contact: string | null
          checklist: Json
          cons: string | null
          created_at: string
          id: string
          municipality: string | null
          parcel_id: string
          personal: string | null
          pros: string | null
          questions: string | null
          renovation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_contact?: string | null
          checklist?: Json
          cons?: string | null
          created_at?: string
          id?: string
          municipality?: string | null
          parcel_id: string
          personal?: string | null
          pros?: string | null
          questions?: string | null
          renovation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_contact?: string | null
          checklist?: Json
          cons?: string | null
          created_at?: string
          id?: string
          municipality?: string | null
          parcel_id?: string
          personal?: string | null
          pros?: string | null
          questions?: string | null
          renovation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      property_research_links: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          note: string | null
          parcel_id: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          label: string
          note?: string | null
          parcel_id: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          parcel_id?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["provider_audit_action"]
          at: string
          error_code: string | null
          id: string
          latency_ms: number | null
          meta: Json
          provider: Database["public"]["Enums"]["provider_id"]
          purpose: string | null
          resource_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["provider_audit_action"]
          at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          meta?: Json
          provider: Database["public"]["Enums"]["provider_id"]
          purpose?: string | null
          resource_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["provider_audit_action"]
          at?: string
          error_code?: string | null
          id?: string
          latency_ms?: number | null
          meta?: Json
          provider?: Database["public"]["Enums"]["provider_id"]
          purpose?: string | null
          resource_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      provider_cache: {
        Row: {
          created_at: string
          expires_at: string
          fetched_at: string
          id: string
          payload: Json
          provider: Database["public"]["Enums"]["provider_id"]
          resource_id: string
          resource_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          fetched_at?: string
          id?: string
          payload?: Json
          provider: Database["public"]["Enums"]["provider_id"]
          resource_id: string
          resource_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          payload?: Json
          provider?: Database["public"]["Enums"]["provider_id"]
          resource_id?: string
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_settings: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_health: string | null
          provider: Database["public"]["Enums"]["provider_id"]
          secret_ref: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_health?: string | null
          provider: Database["public"]["Enums"]["provider_id"]
          secret_ref?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_health?: string | null
          provider?: Database["public"]["Enums"]["provider_id"]
          secret_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_orders: {
        Row: {
          completed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          parcel_id: string
          payload: Json
          pdf_storage_path: string | null
          price_cents: number
          provider: string
          provider_id: Database["public"]["Enums"]["provider_id"]
          provider_order_ref: string | null
          report_type: string
          status: string
          status_enum: Database["public"]["Enums"]["report_order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          parcel_id: string
          payload?: Json
          pdf_storage_path?: string | null
          price_cents?: number
          provider?: string
          provider_id?: Database["public"]["Enums"]["provider_id"]
          provider_order_ref?: string | null
          report_type: string
          status?: string
          status_enum?: Database["public"]["Enums"]["report_order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          parcel_id?: string
          payload?: Json
          pdf_storage_path?: string | null
          price_cents?: number
          provider?: string
          provider_id?: Database["public"]["Enums"]["provider_id"]
          provider_order_ref?: string | null
          report_type?: string
          status?: string
          status_enum?: Database["public"]["Enums"]["report_order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_properties: {
        Row: {
          created_at: string
          external_links: Json
          id: string
          manual_price_cents: number | null
          manual_value_cents: number | null
          note: string | null
          parcel_id: string
          priority: string
          research_status: string
          status: string
          tags: string[]
          user_data: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          external_links?: Json
          id?: string
          manual_price_cents?: number | null
          manual_value_cents?: number | null
          note?: string | null
          parcel_id: string
          priority?: string
          research_status?: string
          status?: string
          tags?: string[]
          user_data?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          external_links?: Json
          id?: string
          manual_price_cents?: number | null
          manual_value_cents?: number | null
          note?: string | null
          parcel_id?: string
          priority?: string
          research_status?: string
          status?: string
          tags?: string[]
          user_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      site_potential_beta_access_requests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          parcel_id: string | null
          reason: string | null
          requested_mode: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          parcel_id?: string | null
          reason?: string | null
          requested_mode?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          parcel_id?: string | null
          reason?: string | null
          requested_mode?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_potential_beta_credits: {
        Row: {
          created_at: string
          credits_granted: number
          credits_used: number
          expires_at: string | null
          granted_by: string | null
          id: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_granted: number
          credits_used?: number
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_granted?: number
          credits_used?: number
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_potential_credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          credits_delta: number
          design_pack_id: string | null
          entry_type: string
          id: string
          idempotency_key: string
          metadata: Json
          purchase_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          credits_delta: number
          design_pack_id?: string | null
          entry_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          purchase_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          credits_delta?: number
          design_pack_id?: string | null
          entry_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          purchase_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_potential_credit_ledger_design_pack_id_fkey"
            columns: ["design_pack_id"]
            isOneToOne: false
            referencedRelation: "erf_design_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_potential_credit_ledger_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "site_potential_credit_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      site_potential_credit_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          credit_count: number
          currency: string
          id: string
          metadata: Json
          payment_provider: string | null
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_count: number
          currency?: string
          id?: string
          metadata?: Json
          payment_provider?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_count?: number
          currency?: string
          id?: string
          metadata?: Json
          payment_provider?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_potential_credit_wallets: {
        Row: {
          balance: number
          created_at: string
          lifetime_consumed: number
          lifetime_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          lifetime_consumed?: number
          lifetime_purchased?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          lifetime_consumed?: number
          lifetime_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          parcel_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parcel_ids?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parcel_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_site_potential_item: {
        Args: {
          p_lease_expires_at: string
          p_max_attempts?: number
          p_now?: string
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          design_pack_id: string
          item_id: string
          option_index: number
          parcel_id: string
          site_project_id: string
          user_id: string
        }[]
      }
      consume_site_potential_beta_credit: {
        Args: {
          p_idempotency_prefix: string
          p_now?: string
          p_parcel_id: string
          p_site_project_id: string
          p_user_id: string
        }
        Returns: {
          beta_credit_id: string
          credits_remaining: number
          design_pack_id: string
        }[]
      }
      finalize_site_potential_item: {
        Args: {
          p_asset_id: string
          p_asset_type: string
          p_item_id: string
          p_metadata: Json
          p_mime_type: string
          p_original_file_name: string
          p_parcel_id: string
          p_site_project_id: string
          p_size_bytes: number
          p_source_label?: string
          p_storage_bucket: string
          p_storage_path: string
          p_user_id: string
          p_worker_id: string
        }
        Returns: {
          asset_category: string
          asset_type: string
          checksum_sha256: string | null
          created_at: string
          id: string
          local_migration_fingerprint: string | null
          metadata: Json
          mime_type: string
          original_file_name: string
          parcel_id: string
          size_bytes: number
          source_label: string | null
          status: string
          storage_bucket: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "erf_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      grant_site_potential_credits: {
        Args: {
          p_credits: number
          p_entry_type: string
          p_idempotency_key: string
          p_metadata?: Json
          p_purchase_id?: string
          p_user_id: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recover_stale_site_potential_jobs: {
        Args: { p_max_attempts?: number; p_now?: string }
        Returns: {
          recovered_items: number
          recovered_packs: number
        }[]
      }
      redeem_site_potential_pack_v2: {
        Args: {
          p_now?: string
          p_parcel_id: string
          p_request_id: string
          p_site_project_id: string
          p_user_id: string
        }
        Returns: {
          beta_credits_remaining: number
          design_pack_id: string
          entitlement_source: string
          free_used_24h: number
          free_used_30d: number
          free_used_7d: number
          purchased_credits_remaining: number
        }[]
      }
      renew_site_potential_item_lease: {
        Args: {
          p_item_id: string
          p_lease_expires_at: string
          p_now?: string
          p_worker_id: string
        }
        Returns: boolean
      }
      settle_site_potential_pack_entitlement: {
        Args: { p_design_pack_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      provider_audit_action:
        | "search"
        | "get_property"
        | "get_geometry"
        | "get_ownership"
        | "get_valuation"
        | "get_transfers"
        | "get_reports"
        | "order_report"
        | "health"
      provider_id:
        | "demo"
        | "surveyor-general"
        | "municipal-gis"
        | "windeed"
        | "lightstone"
      report_order_status:
        | "pending"
        | "paid"
        | "fulfilling"
        | "complete"
        | "failed"
        | "cancelled"
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
      app_role: ["admin", "moderator", "user"],
      provider_audit_action: [
        "search",
        "get_property",
        "get_geometry",
        "get_ownership",
        "get_valuation",
        "get_transfers",
        "get_reports",
        "order_report",
        "health",
      ],
      provider_id: [
        "demo",
        "surveyor-general",
        "municipal-gis",
        "windeed",
        "lightstone",
      ],
      report_order_status: [
        "pending",
        "paid",
        "fulfilling",
        "complete",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
