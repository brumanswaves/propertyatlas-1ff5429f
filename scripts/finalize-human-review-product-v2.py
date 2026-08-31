from pathlib import Path


def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Bring the checked-in Supabase TypeScript contract forward with the migration.
types = Path("src/integrations/supabase/types.ts")
text = types.read_text()
old_block = '''      report_orders: {
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
'''
new_block = '''      human_review_requests: {
        Row: {
          context: string | null
          created_at: string
          focus: string
          id: string
          intended_use: string | null
          parcel_id: string | null
          property_reference_hint: string | null
          report_order_id: string | null
          source_surface: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          focus: string
          id?: string
          intended_use?: string | null
          parcel_id?: string | null
          property_reference_hint?: string | null
          report_order_id?: string | null
          source_surface?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          focus?: string
          id?: string
          intended_use?: string | null
          parcel_id?: string | null
          property_reference_hint?: string | null
          report_order_id?: string | null
          source_surface?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "human_review_requests_report_order_id_fkey"
            columns: ["report_order_id"]
            isOneToOne: true
            referencedRelation: "report_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      report_orders: {
        Row: {
          completed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          intended_use: string | null
          parcel_id: string | null
          payload: Json
          pdf_storage_path: string | null
          price_cents: number
          provider: string
          provider_id: Database["public"]["Enums"]["provider_id"] | null
          provider_order_ref: string | null
          report_type: string
          review_content: Json | null
          review_content_updated_at: string | null
          review_context: string | null
          review_focus: string | null
          review_request_id: string | null
          reviewed_by: string | null
          status: string
          status_enum: Database["public"]["Enums"]["report_order_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          intended_use?: string | null
          parcel_id?: string | null
          payload?: Json
          pdf_storage_path?: string | null
          price_cents?: number
          provider?: string
          provider_id?: Database["public"]["Enums"]["provider_id"] | null
          provider_order_ref?: string | null
          report_type: string
          review_content?: Json | null
          review_content_updated_at?: string | null
          review_context?: string | null
          review_focus?: string | null
          review_request_id?: string | null
          reviewed_by?: string | null
          status?: string
          status_enum?: Database["public"]["Enums"]["report_order_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          intended_use?: string | null
          parcel_id?: string | null
          payload?: Json
          pdf_storage_path?: string | null
          price_cents?: number
          provider?: string
          provider_id?: Database["public"]["Enums"]["provider_id"] | null
          provider_order_ref?: string | null
          report_type?: string
          review_content?: Json | null
          review_content_updated_at?: string | null
          review_context?: string | null
          review_focus?: string | null
          review_request_id?: string | null
          reviewed_by?: string | null
          status?: string
          status_enum?: Database["public"]["Enums"]["report_order_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_orders_review_request_id_fkey"
            columns: ["review_request_id"]
            isOneToOne: true
            referencedRelation: "human_review_requests"
            referencedColumns: ["id"]
          },
        ]
      }
'''
if text.count(old_block) != 1:
    raise SystemExit(f"types.ts report_orders block mismatch: {text.count(old_block)}")
types.write_text(text.replace(old_block, new_block, 1))

# Migration inventory is an explicit guardrail in this repository.
replace_once(
    "src/lib/sitePotential/__tests__/sitePotentialRepair.test.ts",
    "    expect(migrationNames).toHaveLength(34);",
    "    expect(migrationNames).toHaveLength(35);",
)
replace_once(
    "src/lib/sitePotential/__tests__/sitePotentialRepair.test.ts",
    '      "20260831142610_reopen_easy_erf_human_review.sql",\n',
    '      "20260831142610_reopen_easy_erf_human_review.sql",\n      "20260831160318_controlled_human_review_product_v2.sql",\n',
)
