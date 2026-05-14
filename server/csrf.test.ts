/**
 * CSRF protection tests.
 *
 * Strategy: mount a minimal Express app with the csrfProtection middleware
 * and a simple POST echo handler, then drive HTTP requests with supertest.
 *
 * Invariants under test:
 *  1. POST without x-auditflow-client header → 403
 *  2. POST with x-auditflow-client: 1 → 200 (passes through)
 *  3. GET without the header → 200 (GET is excluded from CSRF checks)
 *  4. PUT without the header → 403
 *  5. PATCH without the header → 403
 *  6. DELETE without the header → 403
 *  7. OPTIONS without the header → 200 (preflight is excluded)
 *  8. POST with wrong header value → 403
 */

import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { csrfProtection } from "./_core/index";

function buildApp() {
  const app = express();
  app.use(express.json());
  // Apply CSRF middleware to all routes (mirrors the /api/trpc mount)
  app.use(csrfProtection);
  // Simple echo handler for all methods
  app.all("/test", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("csrfProtection middleware", () => {
  const app = buildApp();

  it("blocks POST without x-auditflow-client header (403)", async () => {
    const res = await request(app).post("/test").send({});
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.stringContaining("CSRF") });
  });

  it("allows POST with x-auditflow-client: 1 (200)", async () => {
    const res = await request(app)
      .post("/test")
      .set("x-auditflow-client", "1")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("allows GET without the header (200 — GET is excluded)", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("allows HEAD without the header (200 — HEAD is excluded)", async () => {
    const res = await request(app).head("/test");
    expect(res.status).toBe(200);
  });

  it("allows OPTIONS without the header (200 — preflight is excluded)", async () => {
    const res = await request(app).options("/test");
    expect(res.status).toBe(200);
  });

  it("blocks PUT without the header (403)", async () => {
    const res = await request(app).put("/test").send({});
    expect(res.status).toBe(403);
  });

  it("blocks PATCH without the header (403)", async () => {
    const res = await request(app).patch("/test").send({});
    expect(res.status).toBe(403);
  });

  it("blocks DELETE without the header (403)", async () => {
    const res = await request(app).delete("/test");
    expect(res.status).toBe(403);
  });

  it("blocks POST with wrong header value (403)", async () => {
    const res = await request(app)
      .post("/test")
      .set("x-auditflow-client", "true")
      .send({});
    expect(res.status).toBe(403);
  });

  it("blocks POST with empty header value (403)", async () => {
    const res = await request(app)
      .post("/test")
      .set("x-auditflow-client", "")
      .send({});
    expect(res.status).toBe(403);
  });
});
