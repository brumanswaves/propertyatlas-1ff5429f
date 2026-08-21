import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(path) {
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = readEnv(".env");

if (env.VITE_FOUNDER_SUPABASE_AUTH !== "true") {
  console.log("Founder auth is disabled in this runtime config; live OAuth probe skipped.");
  process.exit(0);
}

const projectRef = env.VITE_SUPABASE_PROJECT_ID;
const supabaseUrl = env.VITE_SUPABASE_URL;
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!projectRef || !supabaseUrl || !publishableKey) {
  throw new Error("Founder auth is enabled but required Supabase browser config is missing.");
}

const expectedOrigin = `https://${projectRef}.supabase.co`;
if (new URL(supabaseUrl).origin !== expectedOrigin) {
  throw new Error("Supabase URL does not match the configured project ref.");
}

const client = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const { data, error } = await client.auth.signInWithOAuth({
  provider: "google",
  options: { skipBrowserRedirect: true },
});

if (error) {
  throw new Error(`Founder Google OAuth initiation failed: ${error.message}`);
}

if (!data?.url) {
  throw new Error("Founder Google OAuth initiation returned no authorization URL.");
}

const authorizeUrl = new URL(data.url);
if (authorizeUrl.origin !== expectedOrigin) {
  throw new Error("OAuth authorization URL does not target the founder Supabase project.");
}
if (authorizeUrl.searchParams.get("provider") !== "google") {
  throw new Error("OAuth authorization URL is not configured for Google.");
}

const response = await fetch(authorizeUrl, { redirect: "manual" });
const location = response.headers.get("location");

if (!location) {
  throw new Error(`Founder OAuth endpoint returned HTTP ${response.status} without a redirect.`);
}

const googleUrl = new URL(location);
if (googleUrl.hostname !== "accounts.google.com") {
  throw new Error("Founder OAuth endpoint did not redirect to Google Accounts.");
}

console.log(
  `Founder OAuth transport verified: project ${projectRef}, Supabase authorize endpoint -> Google Accounts.`,
);
