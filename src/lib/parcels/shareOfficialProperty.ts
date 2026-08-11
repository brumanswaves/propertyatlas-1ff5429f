export interface PropertyShareNavigator {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  clipboard?: { writeText: (value: string) => Promise<void> };
}

export interface OfficialPropertySharePayload {
  title: string;
  text: string;
  url: string;
  sender: string | null;
  subject: string;
  propertyLines: string[];
}

export interface PropertySharePopup {
  opener?: unknown;
}

export interface PropertyShareWindow {
  open?: (url: string, target?: string) => PropertySharePopup | null;
}

function cleanShareText(value: string | number | null | undefined): string | null {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

function comparableShareText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueShareValues(values: Array<string | null | undefined>): string[] {
  return values.reduce<string[]>((lines, value) => {
    const cleaned = cleanShareText(value);
    if (!cleaned) return lines;
    const comparable = comparableShareText(cleaned);
    return lines.some((line) => comparableShareText(line) === comparable) ? lines : [...lines, cleaned];
  }, []);
}

function addressIncludes(address: string | null, value: string | null): boolean {
  if (!address || !value) return false;
  return comparableShareText(address).includes(comparableShareText(value));
}

function buildPropertyLines(input: {
  title: string;
  erfNumber?: string | number | null;
  address?: string | null;
  area?: string | null;
  locality?: string | null;
}): string[] {
  const erf = cleanShareText(input.erfNumber);
  const address = cleanShareText(input.address);
  const area = cleanShareText(input.area);
  const locality = cleanShareText(input.locality);
  const location = uniqueShareValues([
    area && !addressIncludes(address, area) ? area : null,
    locality && !addressIncludes(address, locality) ? locality : null,
  ]).join(", ");
  const structuredLines = uniqueShareValues([erf ? `Erf ${erf}` : null, address, location]);

  return structuredLines.length ? structuredLines : uniqueShareValues([input.title]);
}

function shareSubject(input: {
  sender: string | null;
  erfNumber?: string | number | null;
  address?: string | null;
  area?: string | null;
}): string {
  if (!input.sender) return "A property was shared with you on Easy Erf";

  const erf = cleanShareText(input.erfNumber);
  const address = cleanShareText(input.address);
  const area = cleanShareText(input.area);
  const property = erf ? `Erf ${erf}${area ? `, ${area}` : ""}` : address ?? "a property";
  return `${input.sender} shared ${property} with you`;
}

export function buildOfficialPropertySharePayload(input: {
  title: string;
  url: string;
  senderName?: string | null;
  erfNumber?: string | number | null;
  address?: string | null;
  area?: string | null;
  locality?: string | null;
}): OfficialPropertySharePayload {
  const senderName = input.senderName?.trim();
  const sender = senderName?.split(/\s+/)[0] || null;
  const propertyLines = buildPropertyLines(input);
  const subject = shareSubject({
    sender,
    erfNumber: input.erfNumber,
    address: input.address,
    area: input.area,
  });
  return {
    title: input.title,
    text: `${propertyLines[0] ?? "Property"} was shared with you on Easy Erf.`,
    url: input.url,
    sender,
    subject,
    propertyLines,
  };
}

export function buildOfficialPropertyGmailUrl(payload: OfficialPropertySharePayload) {
  const signature = payload.sender
    ? [payload.sender, "", "Easy Erf", "Property intelligence made simple."]
    : ["Easy Erf", "Property intelligence made simple."];
  const body = [
    "Hi,",
    "",
    "I thought you might want to take a look at this property:",
    "",
    ...payload.propertyLines,
    "",
    "VIEW PROPERTY ON EASY ERF ->",
    payload.url,
    "",
    "Easy Erf brings the important property information together in one place, including:",
    "",
    "- Property and erf details",
    "- Maps and location information",
    "- Planning and development potential",
    "- Supporting evidence and documents",
    "- Property and investment numbers",
    "",
    "You can open the property above and explore the information that was shared with you.",
    "",
    ...signature,
  ].join("\n");

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    su: payload.subject,
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
    const opened = windowRef.open(buildOfficialPropertyGmailUrl(payload), "_blank");
    if (opened !== null) {
      try {
        opened.opener = null;
      } catch {
        // The popup is already open. Failing to clear opener must not trigger a
        // second share action or lose the prepared Gmail draft.
      }
      return "shared";
    }
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
