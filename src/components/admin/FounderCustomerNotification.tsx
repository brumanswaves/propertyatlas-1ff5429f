import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, ExternalLink, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const RECORD_CONFIRMATION = "I SENT THIS EMAIL";

type NotificationDraft = {
  recipient: string;
  subject: string;
  body: string;
  reportUrl: string;
  mailtoUrl: string;
};

type NotificationReceipt = {
  status: "sent";
  channel: "manual_email";
  recipient: string;
  sentAt: string;
  sentBy: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseReceipt(value: unknown): NotificationReceipt | null {
  if (!isRecord(value) || !isRecord(value.customerNotification)) return null;
  const receipt = value.customerNotification;
  const status = cleanText(receipt.status);
  const channel = cleanText(receipt.channel);
  const recipient = cleanText(receipt.recipient);
  const sentAt = cleanText(receipt.sentAt);
  const sentBy = cleanText(receipt.sentBy);
  if (status !== "sent" || channel !== "manual_email" || !recipient || !sentAt || !sentBy) {
    return null;
  }
  return { status, channel, recipient, sentAt, sentBy };
}

function parseDraft(value: unknown): NotificationDraft | null {
  if (!isRecord(value)) return null;
  const recipient = cleanText(value.recipient);
  const subject = cleanText(value.subject);
  const body = cleanText(value.body);
  const reportUrl = cleanText(value.reportUrl);
  const mailtoUrl = cleanText(value.mailtoUrl);
  if (!recipient || !subject || !body || !reportUrl || !mailtoUrl) return null;
  return { recipient, subject, body, reportUrl, mailtoUrl };
}

export function FounderCustomerNotification({
  orderId,
  initialContent,
  available,
  onRecorded,
}: {
  orderId: string;
  initialContent: unknown;
  available: boolean;
  onRecorded?: () => void | Promise<void>;
}) {
  const receiptFromContent = useMemo(() => parseReceipt(initialContent), [initialContent]);
  const [receipt, setReceipt] = useState<NotificationReceipt | null>(receiptFromContent);
  const [draft, setDraft] = useState<NotificationDraft | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [confirmedSent, setConfirmedSent] = useState(false);

  useEffect(() => {
    setReceipt(receiptFromContent);
  }, [receiptFromContent]);

  useEffect(() => {
    setDraft(null);
    setConfirmedSent(false);
  }, [orderId]);

  if (!available) return null;

  async function prepare() {
    setPreparing(true);
    const { data, error } = await supabase.functions.invoke(
      "easy-erf-founder-customer-notification",
      { body: { orderId, action: "prepare" } },
    );
    setPreparing(false);

    const preparedDraft = parseDraft(data?.draft);
    if (error || !data?.ok || !preparedDraft) {
      toast.error(data?.error ?? error?.message ?? "The customer email could not be prepared.");
      return;
    }

    setDraft(preparedDraft);
    setConfirmedSent(false);
    const preparedReceipt = parseReceipt({ customerNotification: data.receipt });
    if (preparedReceipt) setReceipt(preparedReceipt);
    toast.success("Customer email prepared. Easy Erf has not sent it automatically.");
  }

  async function copyDraft() {
    if (!draft) return;
    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard access is unavailable. Select and copy the email text manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `To: ${draft.recipient}\nSubject: ${draft.subject}\n\n${draft.body}`,
      );
      toast.success("Customer email copied");
    } catch {
      toast.error("The email could not be copied. Select and copy the text manually.");
    }
  }

  async function recordSent() {
    if (!draft || !confirmedSent) return;
    setRecording(true);
    const { data, error } = await supabase.functions.invoke(
      "easy-erf-founder-customer-notification",
      {
        body: {
          orderId,
          action: "record_sent",
          confirmation: RECORD_CONFIRMATION,
          recipient: draft.recipient,
        },
      },
    );
    setRecording(false);

    const recordedReceipt = parseReceipt({ customerNotification: data?.receipt });
    if (error || !data?.ok || !recordedReceipt) {
      if (data?.code === "RECIPIENT_CHANGED") {
        setDraft(null);
        setConfirmedSent(false);
      }
      toast.error(data?.error ?? error?.message ?? "The notification receipt could not be saved.");
      return;
    }

    setReceipt(recordedReceipt);
    setDraft(null);
    setConfirmedSent(false);
    toast.success("Customer notification recorded");
    await onRecorded?.();
  }

  return (
    <section className="mt-4 rounded-[1.5rem] border border-emerald-500/25 bg-emerald-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
            <Mail className="h-4 w-4 text-emerald-700" /> Notify the customer
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#64748B]">
            Early Access uses a founder-sent email. Easy Erf prepares the exact customer, property
            and secure report link, but it does not send or contact anyone automatically.
          </p>
        </div>
        {receipt ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <CheckCircle2 className="h-3.5 w-3.5" /> Notification recorded
          </span>
        ) : null}
      </div>

      {receipt ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-white p-4 text-xs leading-5 text-[#0D1B2A]">
          <div className="font-semibold">Customer email recorded as sent</div>
          <div className="mt-1 text-[#64748B]">
            Recipient: {receipt.recipient} · {new Date(receipt.sentAt).toLocaleString("en-ZA")}
          </div>
          <p className="mt-2 text-[11px] text-[#64748B]">
            Reopening the report clears this receipt so a corrected report cannot appear already
            notified.
          </p>
        </div>
      ) : (
        <>
          {!draft ? (
            <button
              type="button"
              disabled={preparing}
              onClick={() => void prepare()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" />
              {preparing ? "Preparing customer email…" : "Prepare customer email"}
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/20 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    To
                  </div>
                  <div className="mt-1 break-all text-xs font-semibold text-[#0D1B2A]">
                    {draft.recipient}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Subject
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#0D1B2A]">{draft.subject}</div>
                </div>
              </div>

              <textarea
                readOnly
                value={draft.body}
                rows={10}
                className="w-full rounded-2xl border border-emerald-500/20 bg-white px-4 py-3 text-xs leading-5 text-[#0D1B2A] outline-none"
              />

              <div className="flex flex-wrap gap-2">
                <a
                  href={draft.mailtoUrl}
                  className="inline-flex items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2.5 text-xs font-semibold text-white"
                >
                  <Send className="h-3.5 w-3.5" /> Open email draft{" "}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={() => void copyDraft()}
                  className="inline-flex items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2.5 text-xs font-semibold text-[#0D1B2A]"
                >
                  <Clipboard className="h-3.5 w-3.5" /> Copy email
                </button>
              </div>

              <label className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <input
                  type="checkbox"
                  checked={confirmedSent}
                  onChange={(event) => setConfirmedSent(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  I sent this exact email to <strong>{draft.recipient}</strong>. Recording this does
                  not send the email and must not be used before the message is actually sent.
                </span>
              </label>

              <button
                type="button"
                disabled={recording || !confirmedSent}
                onClick={() => void recordSent()}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {recording ? "Recording notification…" : "Record customer notified"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
