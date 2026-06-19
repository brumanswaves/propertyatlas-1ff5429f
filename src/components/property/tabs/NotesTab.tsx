import { useEffect, useState } from "react";
import { Save, CheckSquare, Square } from "lucide-react";
import { DUE_DILIGENCE } from "@/lib/research/checklist";
import { SourceBadge } from "@/components/data/SourceBadge";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NoteRow {
  personal: string | null;
  pros: string | null;
  cons: string | null;
  questions: string | null;
  agent_contact: string | null;
  municipality: string | null;
  renovation: string | null;
  checklist: Record<string, boolean>;
}

const FIELDS: {
  key: keyof Omit<NoteRow, "checklist">;
  label: string;
  placeholder: string;
  rows?: number;
}[] = [
  {
    key: "personal",
    label: "Personal notes",
    placeholder: "First impressions, ideas, plans…",
    rows: 3,
  },
  { key: "pros", label: "Pros", placeholder: "What you like about this property" },
  { key: "cons", label: "Cons", placeholder: "Risks, concerns, deal-breakers" },
  {
    key: "questions",
    label: "Questions to verify",
    placeholder: "What you need to confirm before deciding",
  },
  { key: "agent_contact", label: "Agent contact", placeholder: "Name, agency, phone, email" },
  {
    key: "municipality",
    label: "Municipality notes",
    placeholder: "Rates, zoning queries, planning enquiries",
  },
  { key: "renovation", label: "Renovation notes", placeholder: "Scope, quotes, contractors" },
];

const EMPTY: NoteRow = {
  personal: "",
  pros: "",
  cons: "",
  questions: "",
  agent_contact: "",
  municipality: "",
  renovation: "",
  checklist: {},
};

function normalizeChecklist(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

export function NotesTab({
  parcelId,
  showSourceBadge = true,
}: {
  parcelId: string;
  showSourceBadge?: boolean;
}) {
  const { user } = useAuth();
  const [row, setRow] = useState<NoteRow>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }
    supabase
      .from("property_notes")
      .select("*")
      .eq("parcel_id", parcelId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRow({ ...EMPTY, ...data, checklist: normalizeChecklist(data.checklist) });
        setLoaded(true);
      });
  }, [user, parcelId]);

  async function save() {
    if (!user) {
      toast.message("Sign in to save notes");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("property_notes").upsert(
      {
        user_id: user.id,
        parcel_id: parcelId,
        ...row,
      },
      { onConflict: "user_id,parcel_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Notes saved");
  }

  function toggle(id: string) {
    setRow((r) => ({ ...r, checklist: { ...r.checklist, [id]: !r.checklist[id] } }));
  }

  if (!loaded) return <div className="text-xs text-muted-foreground">Loading notes…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Private notes</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your research is private and only visible to you.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <section className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {f.label}
            </span>
            <textarea
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              rows={f.rows ?? 2}
              placeholder={f.placeholder}
              value={(row[f.key] as string) ?? ""}
              onChange={(e) => setRow({ ...row, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </section>

      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Due diligence checklist
        </div>
        <ul className="grid gap-1.5 rounded-2xl border border-border bg-card p-2 sm:grid-cols-2">
          {DUE_DILIGENCE.map((item) => {
            const checked = !!row.checklist[item.id];
            return (
              <li key={item.id}>
                <button
                  onClick={() => toggle(item.id)}
                  className={
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition " +
                    (checked
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "hover:bg-muted")
                  }
                >
                  {checked ? (
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={checked ? "line-through opacity-70" : ""}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <ComplianceNotice tone="soft">
        Notes are stored for your account only. Do not paste copyrighted listing text or proprietary
        report content.
      </ComplianceNotice>
      {showSourceBadge && <SourceBadge source="demo" />}
    </div>
  );
}
