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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
