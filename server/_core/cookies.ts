import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // SameSite=Lax: cookies are sent on top-level navigations (links, redirects)
  // but NOT on cross-site sub-resource requests (fetch, XHR from a foreign origin).
  // This is sufficient for this app and prevents CSRF without requiring a token.
  //
  // secure: always true in production so the cookie is never sent over cleartext.
  // In development we honour the actual request protocol to allow http://localhost.
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction || isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  };
}
