// ------------------------------------------------------------
// getFaviconUrl.ts — Shared favicon helpers for WWConsole
// ------------------------------------------------------------

/**
 * Extracts the favicon URL using FaviconKit as primary source.
 * @param link Full article/source link (e.g. "https://www.bbc.com/news/...")
 * @returns FaviconKit URL or null
 */
export function getFaviconUrl(link: string | undefined | null): string | null {
  if (!link) return null;

  try {
    const domain = new URL(link).hostname;
    if (!domain) return null;

    // Primary: FaviconKit (highest success rate)
    return `https://api.faviconkit.com/${domain}/64`;
  } catch {
    return null;
  }
}

/**
 * Fallback favicon derived from domain origin
 * (e.g. "https://www.bbc.com/favicon.ico")
 */
export function getFallbackFavicon(link: string | undefined | null): string | null {
  if (!link) return null;

  try {
    const origin = new URL(link).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/**
 * Converts a source name into up to 3 uppercase initials
 * e.g. "New York Times" → "NYT"
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return "?";

  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 3) || "?"
  );
}
