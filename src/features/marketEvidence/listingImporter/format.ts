export function formatZar(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not provided";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatArea(value: number | null | undefined, unit = "m²"): string {
  if (value == null || !Number.isFinite(value)) return "Not provided";
  return `${new Intl.NumberFormat("en-ZA").format(value)} ${unit}`;
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not provided";
  return String(value);
}

export function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatText(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Not provided";
}
