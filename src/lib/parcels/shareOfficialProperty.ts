export interface PropertyShareNavigator {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  clipboard?: { writeText: (value: string) => Promise<void> };
}

export interface OfficialPropertySharePayload {
  title: string;
  text: string;
  url: string;
  sender: string;
}

export interface PropertyShareWindow {
  open?: (url: string, target?: string, features?: string) => unknown;
}

export function buildOfficialPropertySharePayload(input: {
  title: string;
  url: string;
  senderName?: string | null;
}): OfficialPropertySharePayload {
  const senderName = input.senderName?.trim();
  const sender = senderName || "Someone";
  return {
    title: input.title,
    text: `${sender} sent you this property to check out on Easy Erf.`,
    url: input.url,
    sender,
  };
}

export function buildOfficialPropertyGmailUrl(payload: OfficialPropertySharePayload) {
  const subject = `${payload.sender} sent you a property on Easy Erf`;
  const body = [
    `${payload.sender} is sending you this property to check out on Easy Erf.`,
    "",
    payload.title,
    "",
    "VIEW PROPERTY ON EASY ERF",
    payload.url,
    "",
    "Easy Erf brings the property, evidence, planning potential and deal numbers together in one place.",
  ].join("\n");

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export async function shareOfficialPropertyLink(
  navigatorRef: PropertyShareNavigator,
  payload: OfficialPropertySharePayload,
  windowRef: PropertyShareWindow | undefined =
    typeof window !== "undefined" ? window : undefined,
): Promise<"shared" | "copied"> {
  // The desktop Easy Erf share action intentionally opens a Gmail compose draft
  // with explicit subject/body copy. Native share targets can silently drop the
  // text and leave only the raw URL, which produced a poor Gmail experience.
  // Gmail renders the canonical URL as a normal clickable hyperlink.
  if (typeof windowRef?.open === "function") {
    const opened = windowRef.open(
      buildOfficialPropertyGmailUrl(payload),
      "_blank",
      "noopener,noreferrer",
    );
    if (opened !== null) return "shared";
  }

  if (typeof navigatorRef.share === "function") {
    await navigatorRef.share({ title: payload.title, text: payload.text, url: payload.url });
    return "shared";
  }

  if (!navigatorRef.clipboard || typeof navigatorRef.clipboard.writeText !== "function") {
    throw new Error("Property sharing is unavailable in this browser.");
  }

  await navigatorRef.clipboard.writeText(payload.url);
  return "copied";
}
