/**
 * Tests for HTML injection prevention in email templates.
 *
 * Verifies that user-controlled fields (topic, note, actorName, recipientName,
 * newSupervisorName, refNumber, grade) are HTML-escaped before being
 * interpolated into outbound email bodies, and that subject lines are
 * protected against header injection.
 */
import { describe, expect, it } from "vitest";
import {
  buildAuditStatusEmail,
  escapeHtml,
  safeSubject,
} from "./_core/email";

// ─── Unit tests for escapeHtml helper ─────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes & < > \" and ' characters", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("returns empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml("")).toBe("");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("Hearing Aid Follow-up")).toBe("Hearing Aid Follow-up");
    expect(escapeHtml("REF-20260513-0001")).toBe("REF-20260513-0001");
  });
});

// ─── Unit tests for safeSubject helper ───────────────────────────────────────

describe("safeSubject", () => {
  it("strips CR and LF from subject strings", () => {
    expect(safeSubject("Normal subject")).toBe("Normal subject");
    expect(safeSubject("Injected\r\nBcc: attacker@evil.com")).toBe(
      "Injected Bcc: attacker@evil.com"
    );
    expect(safeSubject("Line1\nLine2")).toBe("Line1 Line2");
    expect(safeSubject("Line1\rLine2")).toBe("Line1 Line2");
  });

  it("trims surrounding whitespace", () => {
    expect(safeSubject("  hello  ")).toBe("hello");
  });
});

// ─── buildAuditStatusEmail — HTML injection prevention ───────────────────────

describe("buildAuditStatusEmail — HTML injection prevention", () => {
  const MALICIOUS_TOPIC = '<script>alert(1)</script>';
  const MALICIOUS_LINK = '</td><a href="https://evil.example.com">click me</a>';
  const MALICIOUS_NAME = '<img src=x onerror=alert(1)>';
  const MALICIOUS_NOTE = '<a href="https://phishing.example.com">Reset your password</a>';
  const MALICIOUS_SUPERVISOR = '<b onmouseover=alert(2)>Dr Evil</b>';

  it("escapes malicious topic — script tag", () => {
    const { html } = buildAuditStatusEmail(
      {
        refNumber: "REF-001",
        topic: MALICIOUS_TOPIC,
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "approved",
      },
      "Recipient"
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;/script&gt;");
  });

  it("escapes malicious topic — phishing link", () => {
    const { html } = buildAuditStatusEmail(
      {
        refNumber: "REF-001",
        topic: MALICIOUS_LINK,
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "rejected",
      },
      "Recipient"
    );
    expect(html).not.toContain('<a href="https://evil.example.com">');
    expect(html).toContain("&lt;/td&gt;");
    expect(html).toContain("&lt;a href=");
  });

  it("escapes malicious actorName", () => {
    const { html } = buildAuditStatusEmail(
      {
        refNumber: "REF-001",
        topic: "Safe Topic",
        submitterName: "Dr Safe",
        actorName: MALICIOUS_NAME,
        decision: "approved",
      },
      "Recipient"
    );
    // The raw <img tag must not appear — it must be escaped to &lt;img
    // Note: the literal text "onerror=" will still appear in the escaped form, which is safe
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes malicious recipientName", () => {
    const { html } = buildAuditStatusEmail(
      {
        refNumber: "REF-001",
        topic: "Safe Topic",
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "approved",
      },
      MALICIOUS_NAME
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes malicious note", () => {
    const { html } = buildAuditStatusEmail(
      {
        refNumber: "REF-001",
        topic: "Safe Topic",
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "rejected",
        note: MALICIOUS_NOTE,
      },
      "Recipient"
    );
    expect(html).not.toContain('<a href="https://phishing.example.com">');
    expect(html).toContain("&lt;a href=");
  });

  it("escapes malicious newSupervisorName on reassign", () => {
    const { html } = buildAuditStatusEmail(
      {
        refNumber: "REF-001",
        topic: "Safe Topic",
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "reassigned",
        newSupervisorName: MALICIOUS_SUPERVISOR,
      },
      "Recipient"
    );
    expect(html).not.toContain("<b onmouseover=");
    expect(html).toContain("&lt;b onmouseover=");
  });

  it("escapes malicious refNumber", () => {
    const { html } = buildAuditStatusEmail(
      {
        refNumber: '<img src=x onerror=fetch("https://evil.example.com")>',
        topic: "Safe Topic",
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "archived",
      },
      "Recipient"
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("subject line does not contain raw HTML tags from topic", () => {
    const { subject } = buildAuditStatusEmail(
      {
        refNumber: "REF-001",
        topic: MALICIOUS_TOPIC,
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "approved",
      },
      "Recipient"
    );
    // Subject uses raw refNumber (safe) — topic is NOT in the subject for approved/rejected
    expect(subject).not.toContain("<script>");
  });

  it("subject line is protected against header injection", () => {
    const { subject } = buildAuditStatusEmail(
      {
        refNumber: "REF-001\r\nBcc: attacker@evil.com",
        topic: "Safe Topic",
        submitterName: "Dr Safe",
        actorName: "Admin",
        decision: "approved",
      },
      "Recipient"
    );
    expect(subject).not.toContain("\r");
    expect(subject).not.toContain("\n");
  });

  it("all five decision branches escape topic correctly", () => {
    const decisions = ["approved", "rejected", "reassigned", "archived", "unarchived"] as const;
    for (const decision of decisions) {
      const { html } = buildAuditStatusEmail(
        {
          refNumber: "REF-001",
          topic: MALICIOUS_TOPIC,
          submitterName: "Dr Safe",
          actorName: "Admin",
          decision,
        },
        "Recipient"
      );
      expect(html, `decision=${decision}`).not.toContain("<script>");
      expect(html, `decision=${decision}`).toContain("&lt;script&gt;");
    }
  });
});
