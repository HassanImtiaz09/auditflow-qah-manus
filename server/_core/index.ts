import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// ─── CSRF defence-in-depth ────────────────────────────────────────────────────

/**
 * Custom-header CSRF check for tRPC mutation requests.
 *
 * Strategy: require the presence of `x-auditflow-client: 1` on every
 * non-GET request to /api/trpc. The tRPC client (main.tsx) always sends
 * this header. A cross-site attacker using a plain HTML form or `fetch`
 * from a foreign origin cannot set arbitrary custom headers on a
 * credentialed cross-origin request (blocked by CORS preflight), so the
 * absence of this header is a reliable signal of a forged request.
 *
 * This is defence-in-depth: SameSite=Lax cookies already block most
 * CSRF vectors. The header check adds a second layer for edge cases
 * (e.g. older browsers with incomplete SameSite support).
 *
 * GET requests are excluded because tRPC queries use GET and carry no
 * state-changing side effects.
 *
 * Note: embedding this app in an iframe on a third-party domain is no
 * longer supported. The SameSite=Lax cookie policy will prevent the
 * session cookie from being sent in that context.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Only check state-mutating methods (POST, PUT, PATCH, DELETE).
  // tRPC batched mutations always use POST.
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const clientHeader = req.headers["x-auditflow-client"];
  if (clientHeader !== "1") {
    res.status(403).json({ error: "CSRF check failed: missing x-auditflow-client header" });
    return;
  }

  return next();
}

// ─── Port utilities ───────────────────────────────────────────────────────────

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── Server startup ───────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // tRPC API — CSRF check applied before the tRPC handler
  app.use("/api/trpc", csrfProtection);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
