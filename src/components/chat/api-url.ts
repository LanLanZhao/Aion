/** Resolve an Android-accessible endpoint without embedding server credentials. */
export function resolveChatApiUrl(configured: string | undefined, host: string | undefined, development: boolean, platform: string | undefined): string | undefined {
  if (!configured && platform === "web") return "/api/chat";
  const candidate = configured || (development && host ? `http://${host}/api/chat` : undefined);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (url.username || url.password || (url.protocol !== "https:" && !(development && url.protocol === "http:"))) return undefined;
    if (url.pathname === "/") url.pathname = "/api/chat";
    return url.toString();
  } catch { return undefined; }
}
