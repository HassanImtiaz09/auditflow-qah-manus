/**
 * logger.ts
 *
 * Centralised pino logger for the AuditFlow server.
 *
 * Security: the `redact` list ensures that sensitive fields are NEVER
 * written to the log output, regardless of which code path emits them:
 *   - password / passwordHash — credential material
 *   - token / passwordResetToken — short-lived secrets
 *   - req.headers.cookie — contains the nhs_audit_session JWT
 *
 * Transport:
 *   - development: pino-pretty (human-readable, coloured)
 *   - production:  JSON (machine-parseable, suitable for log aggregators)
 */

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino(
  {
    level: isDev ? "debug" : "info",

    // ── Redact sensitive fields wherever they appear in logged objects ──
    redact: {
      paths: [
        // Nested anywhere in the logged object
        "*.password",
        "*.passwordHash",
        "*.token",
        "*.passwordResetToken",
        // HTTP request headers (pinoHttp logs req.headers)
        "req.headers.cookie",
        "req.headers.authorization",
      ],
      censor: "[REDACTED]",
    },
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      })
    : undefined // default: JSON to stdout
);
