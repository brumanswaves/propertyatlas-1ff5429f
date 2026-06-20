import type { User } from "@supabase/supabase-js";

type Metadata = Record<string, unknown>;

function metadataText(metadata: Metadata, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function firstWord(value: string): string {
  return value.trim().split(/\s+/)[0] ?? "";
}

export function getUserEmailUsername(user: Pick<User, "email"> | null | undefined): string {
  return user?.email?.split("@")[0]?.trim() || "there";
}

export function getUserGreetingName(
  user: Pick<User, "email" | "user_metadata"> | null | undefined,
): string {
  if (!user) return "there";
  const metadata = user.user_metadata ?? {};
  const firstName = metadataText(metadata, "first_name");
  if (firstName) return firstName;

  const displayName = metadataText(metadata, "display_name");
  if (displayName) return firstWord(displayName);

  const fullName = metadataText(metadata, "full_name") || metadataText(metadata, "name");
  if (fullName) return firstWord(fullName);

  return getUserEmailUsername(user);
}

export function getUserDisplayName(
  user: Pick<User, "email" | "user_metadata"> | null | undefined,
): string {
  if (!user) return "";
  const metadata = user.user_metadata ?? {};
  return (
    metadataText(metadata, "display_name") ||
    metadataText(metadata, "full_name") ||
    metadataText(metadata, "name") ||
    getUserEmailUsername(user)
  );
}
