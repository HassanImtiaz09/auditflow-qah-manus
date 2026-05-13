# AuditFlow QAH — Design Brainstorm

## Context
A clinical audit management system for an ENT department at Portsmouth Hospitals NHS Trust. Users are NHS clinicians (consultants, registrars, nurses). The interface must be trustworthy, efficient, and professional — not consumer-grade flashy.

---

<response>
<idea>
**Design Movement:** NHS Clinical Precision — Scandinavian Minimalism meets Medical Informatics

**Core Principles:**
1. Data legibility above all — every number, status, and reference must be instantly readable
2. Structural hierarchy via whitespace and weight, never decoration
3. Calm authority — the UI should feel like a well-run hospital, not a startup
4. Role-based clarity — visual affordances change subtly based on user role

**Color Philosophy:**
Deep navy sidebar (#0f2744) anchors the interface with institutional gravitas. The main canvas is a cool off-white (#f8fafc). Accent is a restrained NHS blue (#1d70b8). Status colours are semantic: emerald for approved, amber for pending, red for rejected, slate for draft. No gradients on interactive elements.

**Layout Paradigm:**
Fixed 240px dark sidebar on the left; main content area with a subtle top header bar showing page title + user avatar. Content uses a max-width of 1100px with generous padding. Cards use a 1px border + very soft shadow (no heavy drop shadows).

**Signature Elements:**
- Monospaced reference numbers (font-mono) for audit refs and serials
- Pill-shaped status badges with semantic colour fills
- Subtle left-border accent on active sidebar items

**Interaction Philosophy:**
Keyboard-first. Every action has a clear confirmation. Destructive actions require a second click. Toasts confirm every mutation. No animations on data tables — only on modals/drawers (200–280ms ease-out).

**Animation:**
- Sidebar items: 150ms opacity + translateX on hover
- Modals: scale(0.97)→scale(1) + opacity 0→1, 220ms cubic-bezier(0.23,1,0.32,1)
- Toasts: slide in from bottom-right, 180ms
- Page transitions: none (instant, clinical)

**Typography System:**
- Display/headings: Inter 700 (tight tracking)
- Body/labels: Inter 400/500
- Data/refs: JetBrains Mono 400 for reference numbers and serials
- Scale: 11px labels, 13px body, 15px subheadings, 20px page titles
</idea>
<probability>0.08</probability>
</response>

<response>
<idea>
**Design Movement:** Corporate Brutalism — Bold grid, raw utility, zero ornamentation

**Core Principles:**
1. Every pixel earns its place — no decorative elements
2. High-contrast, high-density information display
3. Monochrome base with single accent colour
4. Grid-locked layouts with visible structure

**Color Philosophy:**
Near-black sidebar (#111827). White content area. Single accent: electric blue (#2563eb). Status colours are pure: green/yellow/red with no tints.

**Layout Paradigm:**
Sidebar + content. Tables dominate. Dense rows, minimal padding. Headers are uppercase small-caps.

**Signature Elements:**
- 1px full-bleed dividers between every row
- ALL-CAPS section headers
- No card borders — sections separated purely by spacing

**Interaction Philosophy:**
Zero animation. Instant feedback. Utility over delight.

**Animation:** None intentionally.

**Typography System:**
- Everything: IBM Plex Mono
- Hierarchy through weight and size only
</idea>
<probability>0.04</probability>
</response>

<response>
<idea>
**Design Movement:** Soft Clinical — Warm neutrals, gentle depth, approachable professionalism

**Core Principles:**
1. Approachable without being casual
2. Warm off-whites and slate tones reduce eye strain for long sessions
3. Generous spacing — forms breathe, tables don't crowd
4. Subtle depth through layered backgrounds

**Color Philosophy:**
Sidebar: deep slate-blue (#1e3a5f). Background: warm white (#fafaf9). Cards: pure white with 1px slate-200 border. Accent: teal (#0d9488). Status: standard semantic palette.

**Layout Paradigm:**
Sidebar + scrollable main. Page headers have a subtle gradient band. Cards use 8px radius with soft box-shadow.

**Signature Elements:**
- Gradient page header strip (slate-800 → slate-700, 48px tall)
- Avatar initials in sidebar footer
- Breadcrumb-style page subtitle

**Interaction Philosophy:**
Smooth but not showy. Hover states are gentle. Focus rings are visible for accessibility.

**Animation:**
- Card entrance: fade-in + translateY(8px)→0, staggered 40ms, 200ms ease-out
- Modal: scale(0.96)→1 + opacity, 240ms

**Typography System:**
- Headings: Plus Jakarta Sans 700
- Body: Plus Jakarta Sans 400/500
- Data: JetBrains Mono for refs
</idea>
<probability>0.07</probability>
</response>

---

## Selected Design: NHS Clinical Precision (Response 1)

**Rationale:** The app serves NHS clinicians who need to trust the system. The deep navy sidebar provides institutional authority. Monospaced reference numbers reinforce the clinical/administrative nature. Clean, data-dense layout respects the users' time. Calm colour palette reduces cognitive load during busy clinical sessions.
