/**
 * Only same-origin, absolute paths are allowed as post-login destinations, so
 * "?next=https://evil.example" or "//evil.example" cannot turn the login page
 * into an open redirect.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, "http://localhost");
    return url.origin === "http://localhost" ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}
