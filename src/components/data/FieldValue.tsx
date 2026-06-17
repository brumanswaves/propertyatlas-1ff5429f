import type { Field } from "@/lib/providers/types";
import { cn } from "@/lib/utils";

interface Props<T> {
  field?: Field<T> | null;
  format?: (v: T) => string;
  className?: string;
  fallback?: string;
}

// Graceful "Not Available" rendering for normalized fields. Respects
// `displayAllowed=false` (e.g. compliance-restricted fields like ID numbers).
export function FieldValue<T>({ field, format, className, fallback = "Not Available" }: Props<T>) {
  if (!field || field.value == null) {
    return <span className={cn("text-muted-foreground italic", className)}>{fallback}</span>;
  }
  if (!field.compliance.displayAllowed) {
    return <span className={cn("text-muted-foreground italic", className)}>Restricted by provider</span>;
  }
  return <span className={className}>{format ? format(field.value) : String(field.value)}</span>;
}
