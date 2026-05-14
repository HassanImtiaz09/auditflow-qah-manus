import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { deadlineRemindersHandler } from "../deadlineReminders";

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

// ─── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Standard 429 response body that the client can display to the user.
 * Matches the shape expected by the Login.tsx / Register.tsx error handlers.
 */
const TOO_MANY_REQUESTS_BODY = {
  error: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Please try again later.",
  },
};

/**
 * Build a rate limiter for a specific tRPC procedure path suffix.
 *
 * tRPC encodes the procedure name in the URL path:
 *   POST /api/trpc/auth.login
 *   POST /api/trpc/auth.register
 *   POST /api/trpc/auth.requestPasswordReset
 *   POST /api/trpc/auth.resendVerification
 *
 * The limiter is keyed by IP address. An in-memory store is used here;
 * TODO: switch to a Redis store (e.g. rate-limit-redis) when the app is
 * horizontally scaled across multiple instances so the counter is shared.
 *
 * @param procedureSuffix  The procedure name as it appears at the end of the URL
 * @param max              Maximum number of requests allowed in the window
 * @param windowMs         Window duration in milliseconds
 */
function makeProcedureRateLimiter(procedureSuffix: string, max: number, windowMs: number) {
  const limiter = rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
    // Only apply this limiter to the specific procedure path
    skip: (req) => {
      // tRPC path format: /api/trpc/auth.login  or  /api/trpc/auth.login,auth.other (batch)
      // We match if the URL path contains the procedure name as a segment
      const url = req.url ?? "";
      return !url.includes(procedureSuffix);
    },
    handler: (_req, res) => {
      res.status(429).json(TOO_MANY_REQUESTS_BODY);
    },
    standardHeaders: true,   // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  });
  return limiter;
}

/**
 * Auth-endpoint rate limiters.
 *
 * Limits are intentionally conservative to deter credential stuffing and
 * reset-spam while still allowing legitimate use:
 *   - login:                10 attempts / 1 minute  (fast feedback for typos)
 *   - register:              5 attempts / 1 hour    (account creation is rare)
 *   - requestPasswordReset:  5 attempts / 1 hour    (reset requests are rare)
 *   - resendVerification:    5 attempts / 1 hour    (resend is rare)
 */
export const authRateLimiters = {
  login: makeProcedureRateLimiter("auth.login", 10, 60 * 1000),
  register: makeProcedureRateLimiter("auth.register", 5, 60 * 60 * 1000),
  requestPasswordReset: makeProcedureRateLimiter("auth.requestPasswordReset", 5, 60 * 60 * 1000),
  resendVerification: makeProcedureRateLimiter("auth.resendVerification", 5, 60 * 60 * 1000),
};

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

  // ── Security headers ───────────────────────────────────────────────────────
  // Helmet is applied in both dev and production. CSP uses 'unsafe-inline' for
  // style-src because Tailwind CSS and shadcn/ui inject inline styles at runtime.
  // Vite HMR in dev mode uses WebSocket on the same origin, which is covered by
  // connect-src 'self'. If HMR breaks, gate this block with:
  //   if (process.env.NODE_ENV !== 'development') { ... }
  app.disable("x-powered-by");
  app.use(
    helmet({
      // HSTS: tell browsers to always use HTTPS for 1 year
      hsts: {
        maxAge: 31_536_000,         // 1 year in seconds
        includeSubDomains: true,
        preload: false,
      },
      // Prevent the page from being embedded in iframes on other origins
      frameguard: { action: "deny" },
      // Only send the origin (no path/query) in the Referer header
      referrerPolicy: { policy: "same-origin" },
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Allow scripts only from same origin (no inline scripts, no eval)
          scriptSrc: ["'self'"],
          // Tailwind / shadcn/ui require inline styles at runtime
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Allow images from same origin, data URIs, and known CDN hosts
          imgSrc: [
            "'self'",
            "data:",
            "https://d2xsxph8kpxj0f.cloudfront.net",
            "https://media.base44.com",
          ],
          // API calls and WebSocket (Vite HMR) must stay on same origin
          connectSrc: ["'self'"],
          // Disallow all plugins (Flash, Java, etc.)
          objectSrc: ["'none'"],
          // Prevent base-tag hijacking
          baseUri: ["'self'"],
          // Disallow framing from any origin (belt-and-suspenders with frameguard)
          frameAncestors: ["'none'"],
        },
      },
    })
  );

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Auth rate limiters — applied before the tRPC handler so requests are
  // rejected cheaply without spinning up tRPC context or DB queries.
  app.use("/api/trpc", authRateLimiters.login);
  app.use("/api/trpc", authRateLimiters.register);
  app.use("/api/trpc", authRateLimiters.requestPasswordReset);
  app.use("/api/trpc", authRateLimiters.resendVerification);

  // CSRF check — defence-in-depth on top of SameSite=Lax cookies
  app.use("/api/trpc", csrfProtection);

  // ── Scheduled cron handlers ─────────────────────────────────────────────
  // Mounted before tRPC so they are not subject to the CSRF header check.
  // Auth is handled inside each handler via x-cron-secret.
  //
  // To register the cron job after deployment, run once from the sandbox CLI:
  //   manus-heartbeat create \
  //     --name deadline-reminders \
  //     --cron "0 0 7 * * *" \
  //     --path /api/scheduled/deadline-reminders \
  //     --description "Daily 07:00 UTC deadline reminder emails"
  app.get("/api/scheduled/deadline-reminders", deadlineRemindersHandler);

  // tRPC API
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
