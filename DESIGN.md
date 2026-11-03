---
name: VowPal
description: White workspaces, light neutrals and warm vermilion for shared wedding planning.
colors:
  background: "#fafafa"
  rail: "#ffffff"
  surface: "#ffffff"
  surface-muted: "#f4f4f5"
  border-soft: "#e4e4e7"
  border-strong: "#c9c9ce"
  foreground: "#27262b"
  muted-text: "#626169"
  faint: "#737078"
  accent: "#bc412d"
  accent-hover: "#a73827"
  accent-soft: "#fff0eb"
  accent-ink: "#9f3424"
  success: "#2b6a46"
  success-soft: "#e9f1eb"
  warning: "#855400"
  warning-soft: "#f7eedb"
  danger: "#a3301f"
  danger-soft: "#f8e8e4"
  selection: "#f8d8cf"
  register-awaiting: "#a3a1a7"
  register-not-invited: "#e7e5e8"
  invite-ground: "#f2ede4"
  invite-sheet: "#fffdf8"
  invite-rule: "#e3d9c8"
  invite-ink: "#221b17"
  invite-muted: "#6b6157"
  invite-accent: "#7a2e63"
  invite-accent-soft: "#f4e8ef"
typography:
  finance-headline:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 2.2vw, 2.25rem)"
    fontWeight: 650
    letterSpacing: "-0.03em"
  finance-figure:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 34px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.42857
  meta:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.06em"
  landing-display:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.035em"
rounded:
  control: "6px"
  nav: "8px"
  panel: "12px"
  badge: "4px"
  register: "3px"
  invite: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  nav-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.nav}"
    padding: "0 12px"
    height: "44px"
  badge-soft:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.badge}"
    padding: "2px 6px"
  invite-button:
    backgroundColor: "{colors.invite-accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
---

# Design System: VowPal

## Overview

**Creative North Star: "The Shared Workspace"**

VowPal is a clear shared workspace for households, event replies and practical wedding plans. White navigation and rounded white panels sit on a light neutral ground. Warm vermilion gives actions, location and selection a consistent identity; Public Sans keeps dense working information readable.

The public home uses the same palette with larger type and an explicitly illustrative household example. Guest invitations deliberately retain their separately scoped cream, plum and expressive serif/script treatment: the invitation belongs to the couple.

Evidence: source extraction from `app/globals.css`, `app/page.tsx`, `components/admin/admin-shell.tsx`, `components/admin/finance/records.tsx`, `components/admin/finance/finance-dialog.tsx`, `components/admin/ui/dialog.tsx`, `components/admin/vendor-contracts.tsx` and font loading in `app/layout.tsx`, reconciled with `PRODUCT.md` and `.impeccable/surfaces/app-admin-finance.md`. This records the approved coral/neutral replacement world. User-authorized local Playwright/Chrome captures on canonical port 3000 were rendered and inspected at 1440×1000 and 390×844: all sixteen vendor, budget, payment, upload, edit-vendor, expense, expense-detail and contracts images are in `.impeccable/review/finance/final/`. The reconstructed baseline in `.impeccable/review/finance/before-reconstructed/` renders preserved pre-redesign source with current auth/Prisma and the current isolated fixture; it is not original historical imagery.

Browser interaction evidence in `.impeccable/review/finance/interaction/report.json` and `connected-report.json` covers Tab/Escape focus behavior, failed-save retry with retained values, payment recording/removal/recalculation, explicit overpayment confirmation, invalid-upload retention, byte-identical contract download and fresh other-wedding expense/file/payment denials. Connected vendor/budget checks cover cost edits (5800→5900→5800), payments (1000→1200→1000), one persisted long-filename upload after two rapid clicks followed by soft removal, existing-PDF duplicate feedback and an empty budget fixture. `desktop-pdf-preview.png` visibly renders the synthetic one-page PDF. Rendered inspection is complete. The final reviewer disposition is ship, scoped to the two scored material fixes: mobile optional-disclosure targets now meet the 44px minimum with 12px vertical padding, and design documentation is reconciled with the rendered implementation. No regressions were observed in the affected captures. This is not a comprehensive accessibility audit.

**Key Characteristics:**
- White navigation and work panels on a light neutral ground.
- Warm vermilion actions and selected states.
- Public Sans, strong hierarchy and tabular working figures.
- A separate cream/plum guest invitation variant.

## Colors

Cool neutral surfaces and warm vermilion define planning; semantic colors describe outcomes. Frontmatter is the normative palette.

### Primary
- **Warm Vermilion** (accent): primary buttons, links, selected tabs, checkboxes and focus. Hover uses accent-hover; pressed and selected text use accent-ink. Accent-soft supports selected navigation and badges.

### Neutral
- **Light Ground** (background): workspace canvas.
- **White** (rail, surface): navigation, controls and work panels.
- **Muted Surface** (surface-muted): hover, disabled fields and grouped controls.
- **Soft / Strong Border**: panel edges and row divisions / control boundaries.
- **Dark / Muted / Faint Text**: primary content / supporting information / placeholders.
- **Register tones**: awaiting and not-yet-invited places remain distinct in the allowance visualization.

Semantic success, warning and danger have soft companions. The guest variant has its own invite-ground, invite-sheet, invite-rule, invite-ink, invite-muted, invite-accent and invite-accent-soft; these retain cream/plum deliberately.

### Named Rules
**The Coral State Rule.** Use warm vermilion for actions, links, current location, selection and focus in planning screens. The public home also uses vermilion for brand and headline emphasis.

**The Meaningful State Rule.** Use green, amber and red for actual status, with a written label alongside color.

**The Scoped Invitation Rule.** Keep the guest cream/plum palette inside the invitation scope; do not carry it into planning surfaces.

## Typography

**Display and Body Font:** Public Sans, with ui-sans-serif, system-ui and sans-serif fallbacks. Geist Mono is loaded for code-like fields. The guest variant retains Cormorant Garamond and the couple’s selected serif/script style, including loaded Great Vibes and Dancing Script.

### Hierarchy
- **Finance headline:** fluid 1.8–2.25rem, weight 650 and -0.03em tracking.
- **Finance figures:** fluid 24–34px summary and 21–34px cost-strip amounts, weight 600, 1.2 leading and tabular numerals; mobile planned/expected figures are 22px and remaining budget is 28px.
- **Headline:** bold planning page title with tight leading and balanced wrapping.
- **Title:** semibold section or dialog heading.
- **Body:** regular working text; table values and page facts use tabular figures.
- **Meta:** compact supporting information.
- **Label:** tracked uppercase column or field names; not a decorative heading prefix.
- **Landing display:** bold 3rem rising to 3.75rem from the small breakpoint, with compact leading.

Inputs use 1rem on phones and 0.875rem from 640px. Navigation and ordinary buttons use body size; mobile bottom navigation uses 11px labels.

## Layout

The planning container caps at 72rem, with 16px phone gutters, 24px from 640px and 32px from 1024px. It leaves 112px below content on phones and 64px on desktop. At 1024px the fixed white navigation rail is 224px wide. Below that, a sticky 56px top bar and five-item bottom bar provide navigation, including More and safe-area padding.

Page headers wrap title, facts and actions with 20px below. White bordered panels contain working tables and lists; table cells have 12px padding, headers 12px horizontal and 8px vertical. Vendor contracts use divided rows with wrapping actions and an inline confirmation. The public home uses a two-column hero at 1024px and a three-column explanation at 768px.

Finance widens the container to 76rem. Vendor details use a single column until 1280px, then a main column and 240px secondary column separated by 48px. Expense records use a table from 768px and stacked linked rows below it, preserving expected/paid/remaining figures. The connected cost strip uses three columns from 640px. Below 640px it stacks label/amount pairs with a 14px row gap, 20px vertical padding and fluid 20–24px amounts. The mobile budget summary also stacks label/amount pairs; remaining budget has a top divider and a larger figure.

## Elevation & Depth

Planning panels are flat at rest: white fill, neutral border and rounded corners distinguish them from the cool ground. Overlay depth remains restrained. Segmented selection uses `0 1px 2px rgba(39,38,43,0.08)`; modal panels use `0 12px 32px rgba(39,38,43,0.18)` and sheets use `0 16px 40px rgba(39,38,43,0.2)`. The backdrop is dark planning ink at 40%. Guest sheets retain their separate warm diffuse shadow.

## Shapes

Controls use 6px corners, navigation and dialogs 8px, working panels 12px, badges 4px and allowance strips 3px. Mobile dialogs use 12px top corners. Guest sheets retain 10px corners. The public hero illustration has 16px outer corners and 12px inner corners. Status dots remain round.

## Components

### Buttons
Firm sentence-case actions. Primary uses warm vermilion and white semibold text; secondary uses white, a strong neutral border and medium dark text; ghost has no default fill. Mobile minimum height is 44px, reducing to 36px from 640px. Primary hover deepens and active uses accent-ink. Disabled controls reduce opacity. Global keyboard focus is a 2px vermilion outline offset 2px. Destructive actions use the quiet red treatment, with filled red for confirmation.

### Inputs / Fields
White fill, strong neutral border, 6px corners and 8px by 12px padding. Focus changes the border to vermilion and adds a vermilion 15% ring; invalid fields use danger and its 10% ring. Disabled fields use the muted surface. File uploads retain a visible label and standard file input.

### Cards / Containers
White, softly bordered, rounded panels; muted containers use surface-muted. Table rows use soft bottom dividers and a restrained muted hover. The allowance strip remains data, including hatching and over-allocation state.

### Status and chips
Reply status uses a small dot plus a written label. Soft rectangular badges use semantic or coral washes with readable text. Do not substitute a colored dot for the written state.

### Navigation
Desktop destinations pair 18px line icons with text. Active destinations use a coral wash, dark vermilion semibold text and 8px corners. Mobile destinations use 20px icons above compact labels; the active icon and text use vermilion. In-page tabs use a vermilion underline; segmented filters place the selected option on white.

### Finance records and task dialogs
The canonical expense appears through the same record link in vendor and budget views. Expected cost states whether it is an estimate or agreed cost; paid and remaining use the same tabular hierarchy. Overpaid amounts have a written label and danger color. Similar expenses carry a review message. Quotes remain separate from confirmed costs.

Compact finance tasks use the small native dialog (desktop maximum 28rem), bottom-aligned full width on phones, with a 92dvh height cap; from 640px the dialog is centered and capped at min(88dvh, 52rem). The header and footer stay outside the scrollable body. Footer actions wrap, respect the safe area and remain reachable. Body padding is 20px horizontal and 16px vertical; forms use 16px vertical spacing and 13px labels. Finance inputs retain a 44px minimum height at all widths. Optional fields use disclosure; below 640px the disclosure summary has a 44px minimum height and 12px vertical padding. Pending saves disable fields and dismissal; errors retain entries and use visible alerts. Removal and overpayment require explicit confirmation within the task.

### Guest invitation
Keep cream paper, plum double rule, expressive names and serif details scoped to the guest surface. The full-width plum action is at least 48px tall. Existing entrance animations and stagger remain; reduced-motion rules disable entrance animation. Planning vermilion is not the guest palette.

## Do's and Don'ts

### Do:
- **Do** use white bordered panels and neutral dividers for working content.
- **Do** align counts and amounts with tabular figures.
- **Do** link vendor and budget amounts to the canonical expense and label recorded payments clearly.
- **Do** preserve the couple’s authored invitation text and chosen name styling.
- **Do** retain visible keyboard focus and reduced-motion handling.

### Don't:
- **Don’t** use teal, green or purple as planning brand accents; semantic green remains a status treatment.
- **Don’t** restore the rejected paper/plum identity to planning screens.
- **Don’t** represent status through color alone.
- **Don’t** treat unverified source styling as rendered accessibility evidence.
