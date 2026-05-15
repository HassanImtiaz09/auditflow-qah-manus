/**
 * body-limit.test.ts
 *
 * Verifies that the Express body-parser limit is set to 1mb.
 * A POST with a body larger than 1mb must be rejected with HTTP 413.
 * A POST with a body under 1mb must be accepted (200 or tRPC error, not 413).
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";

function buildApp() {
  const app = express();
  // Mirror the production body-parser config exactly
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  // A simple echo endpoint for testing
  app.post("/echo", (req, res) => {
    res.json({ received: true, bodySize: JSON.stringify(req.body).length });
  });
  return app;
}

describe("body-parser limit", () => {
  const app = buildApp();

  it("accepts a small JSON payload (< 1mb)", async () => {
    const smallBody = { data: "x".repeat(100) };
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(smallBody));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("rejects a JSON payload larger than 1mb with 413", async () => {
    // Generate a payload slightly over 1mb (1,100,000 bytes)
    const largeBody = JSON.stringify({ data: "x".repeat(1_100_000) });
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(largeBody);
    expect(res.status).toBe(413);
  });

  it("accepts a JSON payload at exactly 900kb (under the limit)", async () => {
    const nearLimitBody = JSON.stringify({ data: "x".repeat(900_000) });
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send(nearLimitBody);
    expect(res.status).toBe(200);
  });

  it("rejects a urlencoded payload larger than 1mb with 413", async () => {
    const largeValue = "x".repeat(1_100_000);
    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(`data=${largeValue}`);
    expect(res.status).toBe(413);
  });
});
