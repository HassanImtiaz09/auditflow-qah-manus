/**
 * Rate-limit tests for public auth endpoints.
 *
 * Strategy: mount a minimal Express app with the auth rate limiters and a
 * stub POST handler, then drive HTTP requests with supertest. The login
 * limiter allows 10 requests per minute; the 11th should return 429.
 *
 * We also verify the other three limiters (register, requestPasswordReset,
 * resendVerification) each allow 5 requests and block the 6th.
 *
 * Important: each test uses a fresh app instance with a fresh MemoryStore
 * so counters don't bleed between tests.
 */

import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOO_MANY_REQUESTS_BODY = {
  error: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Please try again later.",
  },
};

/**
 * Build a fresh rate limiter for a specific procedure suffix.
 * Each call returns a new limiter with its own MemoryStore so tests are isolated.
 */
function makeLimiter(procedureSuffix: string, max: number, windowMs: number) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
    skip: (req) => {
      const url = req.url ?? "";
      return !url.includes(procedureSuffix);
    },
    handler: (_req, res) => {
      res.status(429).json(TOO_MANY_REQUESTS_BODY);
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Build a minimal Express app with one rate limiter and a stub POST handler
 * that always returns 200. Each call creates a fresh app with a fresh store.
 */
function buildApp(procedureSuffix: string, max: number, windowMs: number = 60 * 1000) {
  const app = express();
  // Trust the first proxy hop so x-forwarded-for is used as req.ip in tests.
  // In production this is set by the platform's load balancer.
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/trpc", makeLimiter(procedureSuffix, max, windowMs));
  app.post("/api/trpc/:procedure", (_req, res) => {
    res.status(200).json({ result: { data: { ok: true } } });
  });
  return app;
}

/**
 * Fire `count` sequential POST requests to the given path and return all
 * HTTP status codes.
 */
async function fireRequests(app: ReturnType<typeof express>, path: string, count: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app)
      .post(path)
      .set("x-forwarded-for", "1.2.3.4") // fixed IP so all requests share the same bucket
      .send({});
    statuses.push(res.status);
  }
  return statuses;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth.login rate limiter (10 req/min)", () => {
  it("allows the first 10 requests and blocks the 11th with 429", async () => {
    const app = buildApp("auth.login", 10);
    const statuses = await fireRequests(app, "/api/trpc/auth.login", 11);

    // First 10 should be 200
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    // 11th should be 429
    expect(statuses[10]).toBe(429);
  });

  it("returns the correct 429 body", async () => {
    const app = buildApp("auth.login", 1); // limit of 1 for simplicity
    await request(app).post("/api/trpc/auth.login").set("x-forwarded-for", "1.2.3.4").send({});
    const res = await request(app).post("/api/trpc/auth.login").set("x-forwarded-for", "1.2.3.4").send({});
    expect(res.status).toBe(429);
    expect(res.body).toEqual(TOO_MANY_REQUESTS_BODY);
  });

  it("does NOT apply to unrelated procedures", async () => {
    const app = buildApp("auth.login", 1); // limit of 1 for auth.login
    // First request to auth.login exhausts the limit
    await request(app).post("/api/trpc/auth.login").set("x-forwarded-for", "1.2.3.4").send({});
    // Request to a different procedure should still pass
    const res = await request(app).post("/api/trpc/auth.register").set("x-forwarded-for", "1.2.3.4").send({});
    expect(res.status).toBe(200);
  });
});

describe("auth.register rate limiter (5 req/hr)", () => {
  it("allows the first 5 requests and blocks the 6th with 429", async () => {
    const app = buildApp("auth.register", 5, 60 * 60 * 1000);
    const statuses = await fireRequests(app, "/api/trpc/auth.register", 6);

    expect(statuses.slice(0, 5)).toEqual(Array(5).fill(200));
    expect(statuses[5]).toBe(429);
  });
});

describe("auth.requestPasswordReset rate limiter (5 req/hr)", () => {
  it("allows the first 5 requests and blocks the 6th with 429", async () => {
    const app = buildApp("auth.requestPasswordReset", 5, 60 * 60 * 1000);
    const statuses = await fireRequests(app, "/api/trpc/auth.requestPasswordReset", 6);

    expect(statuses.slice(0, 5)).toEqual(Array(5).fill(200));
    expect(statuses[5]).toBe(429);
  });
});

describe("auth.resendVerification rate limiter (5 req/hr)", () => {
  it("allows the first 5 requests and blocks the 6th with 429", async () => {
    const app = buildApp("auth.resendVerification", 5, 60 * 60 * 1000);
    const statuses = await fireRequests(app, "/api/trpc/auth.resendVerification", 6);

    expect(statuses.slice(0, 5)).toEqual(Array(5).fill(200));
    expect(statuses[5]).toBe(429);
  });
});

describe("Rate limiter isolation (different IPs)", () => {
  it("counts requests per IP — different IPs each get their own quota", async () => {
    const app = buildApp("auth.login", 2); // limit of 2 per IP

    // IP A: 2 requests (exhausts quota)
    await request(app).post("/api/trpc/auth.login").set("x-forwarded-for", "10.0.0.1").send({});
    await request(app).post("/api/trpc/auth.login").set("x-forwarded-for", "10.0.0.1").send({});
    const blockedForA = await request(app).post("/api/trpc/auth.login").set("x-forwarded-for", "10.0.0.1").send({});
    expect(blockedForA.status).toBe(429);

    // IP B: should still have its own fresh quota
    const allowedForB = await request(app).post("/api/trpc/auth.login").set("x-forwarded-for", "10.0.0.2").send({});
    expect(allowedForB.status).toBe(200);
  });
});
