import type { Json } from "@/integrations/supabase/types";

export function toSupabaseJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSupabaseJson(item));
  }
  if (value && typeof value === "object") {
    const jsonObject: { [key: string]: Json | undefined } = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      jsonObject[key] = toSupabaseJson(nestedValue);
    }
    return jsonObject;
  }
  return null;
}
