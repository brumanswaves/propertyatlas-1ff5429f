import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type NotificationReceipt = {
  status: "sent" | "failed";
  channel: "automatic_email" | "manual_email";
  provider: string | null;
  recipient: string;
  reportVersion: string | null;
  attemptedAt: string;
  sentAt: string | null;
  sentBy: string;
  providerMessageId: string | null;
  errorCode: string | null;
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
  const provider = cleanText(receipt.provider);
  const recipient = cleanText(receipt.recipient);
  const reportVersion = cleanText(receipt.reportVersion);
  const attemptedAt = cleanText(receipt.attemptedAt) ?? cleanText(receipt.sentAt);
  const sentAt = cleanText(receipt.sentAt);
  const sentBy = cleanText(receipt.sentBy);
  const providerMessageId = cleanText(receipt.providerMessageId);
  const errorCode = cleanText(receipt.errorCode);

  if (
    (status !== "sent" && status !== "failed") ||
    (channel !== "automatic_email" && channel !== "manual_email") ||
    !recipient ||
    !attemptedAt ||
    !sentBy
  ) {
    return null;
  }
  if (status === "sent" && !sentAt) return null;
  if (status === "failed" && (!errorCode || channel !== "automatic_email")) return null;

  return {
    status,
    channel,
    provider,
    recipient,
    reportVersion,
    attemptedAt,
    sentAt,
    sentBy,
    providerMessageId,
    errorCode,
  };
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-ZA");
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
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setReceipt(receiptFromContent);
  }, [receiptFromContent]);

  useEffect(() => {
    setSending(false);
  }, [orderId]);

  if (!available) return null;

  async function sendReportEmail() {
    setSending(true);
    const { data, error } = await supabase.functions.invoke(
      "easy-erf-founder-customer-notification",
      { body: { orderId, action: "send" } },
    );
    setSending(false);

    const returnedReceipt = parseReceipt({ customerNotification: data?.receipt });
    if (returnedReceipt) setReceipt(returnedReceipt);

    if (error || !data?.ok || returnedReceipt?.status !== "sent") {
      toast.error(
        data?.error ??
          error?.message ??
          "The report is ready, but the customer email could not be sent.",
      );
      await onRecorded?.();
      return;
    }

    toast.success(data?.alreadySent ? "Customer email was already sent" : "Customer report email sent");
    await onRecorded?.();
  }

  const automaticSent = receipt?.status === "sent" && receipt.channel === "automatic_email";
  const legacySent = receipt?.status === "sent" && receipt.channel === "manual_email";
  const failed = receipt?.status === "failed";

  return (
    <section
      className={`mt-4 rounded-[1.5rem] border p-4 sm:p-5 ${
        automaticSent || legacySent
          ? "border-emerald-500/25 bg-emerald-50"
          : failed
            ? "border-rose-300 bg-rose-50"
            : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
            {automaticSent || legacySent ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            ) : failed ? (
              <AlertTriangle className="h-4 w-4 text-rose-700" />
            ) : (
              <Mail className="h-4 w-4 text-amber-700" />
            )}
            {automaticSent
              ? "Customer report email sent"
              : legacySent
                ? "Customer notification recorded"
                : failed
                  ? "Customer report email failed"
                  : "Customer report email not sent"}
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#64748B]">
            New reports email the customer automatically when the report is marked ready. The email
            links directly to the correct report in the customer dashboard.
          </p>
        </div>
        {automaticSent || legacySent ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <CheckCircle2 className="h-3.5 w-3.5" /> Emailed
          </span>
        ) : null}
      </div>

      {receipt ? (
        <div className="mt-4 rounded-2xl border border-current/10 bg-white p-4 text-xs leading-5 text-[#0D1B2A]">
          <div className="font-semibold">
            {receipt.status === "sent" ? "Sent to customer" : "Last automatic send failed"}
          </div>
          <div className="mt-1 text-[#64748B]">
            Recipient: {receipt.recipient} · {displayDate(receipt.sentAt ?? receipt.attemptedAt)}
          </div>
          {receipt.errorCode ? (
            <div className="mt-1 text-rose-700">Error reference: {receipt.errorCode}</div>
          ) : null}
          {legacySent ? (
            <p className="mt-2 text-[11px] text-[#64748B]">
              This receipt came from the retired manual-email workflow. Reopening and redelivering the
              report will use automatic email.
            </p>
          ) : null}
        </div>
      ) : null}

      {!automaticSent && !legacySent ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={sending}
            onClick={() => void sendReportEmail()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
            {sending ? "Sending report email…" : failed ? "Retry report email" : "Send report email"}
          </button>
          <span className="text-[11px] leading-5 text-[#64748B]">
            This is the recovery control. Normal delivery sends the email automatically.
          </span>
        </div>
      ) : null}
    </section>
  );
}
