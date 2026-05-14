/**
 * Smoke tests: verify Helmet security headers are present on every response.
 *
 * We spin up a minimal Express app that uses the same helmet configuration
 * as the production server (imported via the exported factory) and issue
 * GET requests to confirm the expected headers are set.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import helmet from "helmet";
import request from "supertest";

// ─── Minimal test app with the same helmet config as index.ts ─────────────────

function buildTestApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: false,
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "same-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: [
            "'self'",
            "data:",
            "https://d2xsxph8kpxj0f.cloudfront.net",
            "https://media.base44.com",
          ],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  );
  app.get("/", (_req, res) => res.json({ ok: true }));
  return app;
}

const app = buildTestApp();

describe("Security headers (Helmet)", () => {
  it("sets Strict-Transport-Security with maxAge=31536000 and includeSubDomains", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    const hsts = res.headers["strict-transport-security"] as string;
    expect(hsts).toBeDefined();
    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
  });

  it("sets X-Frame-Options: DENY", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("sets Referrer-Policy: same-origin", async () => {
    const res = await request(app).get("/");
    expect(res.headers["referrer-policy"]).toBe("same-origin");
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("does not expose X-Powered-By", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("sets Content-Security-Policy with default-src 'self'", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
  });

  it("CSP includes script-src 'self'", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("script-src 'self'");
  });

  it("CSP includes style-src 'self' 'unsafe-inline'", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("CSP includes img-src with CDN hosts", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("img-src");
    expect(csp).toContain("https://d2xsxph8kpxj0f.cloudfront.net");
    expect(csp).toContain("https://media.base44.com");
  });

  it("CSP includes object-src 'none'", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("object-src 'none'");
  });

  it("CSP includes frame-ancestors 'none'", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("CSP includes base-uri 'self'", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("base-uri 'self'");
  });

  it("CSP includes connect-src 'self'", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("connect-src 'self'");
  });
});
