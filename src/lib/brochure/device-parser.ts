export function parseClientDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const isMobile = /iphone|ipad|android|mobile/.test(ua);
  const isTablet = /ipad|tablet/.test(ua);

  let os = "unknown";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("mac os")) os = "iOS/macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "unknown";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";
  else if (ua.includes("firefox/")) browser = "Firefox";

  return {
    device: isTablet ? "tablet" : isMobile ? "mobile" : "desktop",
    os,
    browser,
  };
}

export function hashIp(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = (hash << 5) - hash + ip.charCodeAt(i);
    hash |= 0;
  }
  return `ip_${Math.abs(hash)}`;
}
