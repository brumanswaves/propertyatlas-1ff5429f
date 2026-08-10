export interface PropertyShareNavigator {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  clipboard?: { writeText: (value: string) => Promise<void> };
}

export function buildOfficialPropertySharePayload(input: {
  title: string;
  url: string;
  senderName?: string | null;
}) {
  const senderName = input.senderName?.trim();
  const sender = senderName || "Someone";
  return {
    title: input.title,
    text: `${sender} sent you this property to check out on Easy Erf.`,
    url: input.url,
  };
}

export async function shareOfficialPropertyLink(
  navigatorRef: PropertyShareNavigator,
  payload: { title: string; text: string; url: string },
): Promise<"shared" | "copied"> {
  if (typeof navigatorRef.share === "function") {
    await navigatorRef.share(payload);
    return "shared";
  }

  if (!navigatorRef.clipboard || typeof navigatorRef.clipboard.writeText !== "function") {
    throw new Error("Property sharing is unavailable in this browser.");
  }

  await navigatorRef.clipboard.writeText(payload.url);
  return "copied";
}
