export interface PropertyShareNavigator {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  clipboard?: { writeText: (value: string) => Promise<void> };
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
