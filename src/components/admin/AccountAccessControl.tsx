import { useEffect, useState } from "react";
import { LockKeyhole, UnlockKeyhole } from "lucide-react";
import {
  changeFounderAccountAccess,
  readFounderAccountAccess,
  type AccountAccess,
} from "@/lib/admin/founderSupportClient";

export function AccountAccessControl({
  accessToken,
  userId,
  onChanged,
}: {
  accessToken: string | null;
  userId: string;
  onChanged: () => void;
}) {
  const [account, setAccount] = useState<AccountAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    let current = true;
    setAccount(null);
    setError(null);
    setConfirming(false);
    setReason("");
    setMessage(null);
    readFounderAccountAccess(accessToken, userId)
      .then((result) => {
        if (current) setAccount(result.account);
      })
      .catch(() => {
        if (current) setError("Could not verify account access. No change is available.");
      });
    return () => {
      current = false;
    };
  }, [accessToken, userId]);

  async function change() {
    if (!account?.email || account.protectedAccount || busy || uncertain) return;
    setBusy(true);
    setError(null);
    try {
      const result = await changeFounderAccountAccess(
        accessToken,
        account.userId,
        account.email,
        account.suspended ? "restore" : "suspend",
        reason,
      );
      setAccount({ ...account, suspended: result.account.suspended });
      setConfirming(false);
      setReason("");
      setMessage(
        result.account.suspended
          ? "Access suspended. Reports and audit history are preserved."
          : "Access restored. Existing roles and assignments are unchanged.",
      );
      onChanged();
    } catch (caught) {
      setUncertain(true);
      setError(
        caught instanceof Error
          ? caught.message
          : "Result unknown. Do not retry; contact the administrator.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="my-4 border-y border-border py-4" aria-label="Account access">
      <h3 className="font-semibold">Account access</h3>
      {account ? (
        <>
          <p className="my-2 text-sm">{account.suspended ? "Suspended" : "Access enabled"}</p>
          <p className="text-sm text-muted-foreground">
            Reports, evidence and audit history are retained. Job assignments are managed separately
            in the investigation queue.
          </p>
          {account.protectedAccount ? (
            <p className="mt-2 text-sm">Founder/admin and your own account are protected.</p>
          ) : !confirming ? (
            <button
              type="button"
              disabled={uncertain}
              onClick={() => setConfirming(true)}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border px-3 disabled:opacity-50"
            >
              {account.suspended ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />}
              {account.suspended ? "Restore access" : "Suspend access"}
            </button>
          ) : (
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void change();
              }}
            >
              <p className="break-words text-sm font-medium">
                {account.suspended ? "Restore" : "Suspend"} access for {account.email}?
              </p>
              <label className="block text-sm">
                Reason
                <input
                  required
                  minLength={8}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-md border p-2"
                />
              </label>
              <button
                type="submit"
                disabled={busy || uncertain || reason.trim().length < 8}
                className="min-h-11 rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-50"
              >
                {busy
                  ? "Saving..."
                  : account.suspended
                    ? "Confirm restore access"
                    : "Confirm suspend access"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="ml-3 min-h-11 px-3"
              >
                Cancel
              </button>
            </form>
          )}
        </>
      ) : !error ? (
        <p role="status">Checking account access...</p>
      ) : null}
      {message ? (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
