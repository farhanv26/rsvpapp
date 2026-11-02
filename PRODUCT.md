# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Couples (organizers).** The bride and groom run the planning. They own the wedding, create events, set guest allowances for family contributors, send invitations and reminders, and track budget and vendors. They work on a laptop in planning sessions and on a phone in between, often mid-conversation with family.
- **Family contributors.** Parents and close relatives who are given a place allowance per event (for example "75 places at the Reception"). They add and edit only their own households, send their own invitations, and need to see at a glance how many places they have left. Mostly on a phone; not necessarily comfortable with software.
- **Guests.** Receive a private RSVP link per household per event, usually by WhatsApp or text. They open it on a phone, read the invitation and reply once.
- **Platform administrator.** Operates the service: user accounts, activity, unassigned legacy events.

## Product Purpose

A paid wedding planning product for couples running several events (for example Mehndi, Nikkah and Walima) with shared and separate guest lists. It keeps one household list across events, splits places between family contributors with enforced allowances, collects RSVPs through personal invitation links, and tracks budget, payments, vendors and each event's schedule. Success is a couple who always knows who is invited, who has replied, how many people are coming and what is still owed, without chasing family members for spreadsheets.

## Positioning

Built around how multi-event South Asian Muslim weddings are actually planned: households rather than individuals, several events with different guest lists, places allocated to each side of the family with server-enforced limits, and invitations delivered through WhatsApp from the organizer's own phone. Wording stays neutral enough for other weddings.

## Operating Context

- Invitations and reminders go out through WhatsApp or SMS composed in the app and sent from the organizer's own phone. The app opens the composer; it cannot confirm delivery, so a household counts as invited only once someone marks it. Email sending is not configured.
- Households carry men / women / children counts, a greeting (default "Assalamu Alaikum"), a group (Bride's family, Groom's family), and an optional table.
- One household can be invited to several events; each event invitation has its own RSVP link and reply.
- Each RSVP link locks after the guest replies once.
- Event schedules (running order) can include private items that guests must never see.
- Guest lists are imported from CSV and exported for venues and caterers.

## Capabilities and Constraints

- Roles: platform super admin; wedding owner / member (owners manage membership); per-event organizer / contributor. An event with no role rows treats every wedding member as an organizer.
- Contributors see and edit only households they manage unless granted "can edit all households". Allowance checks run server-side inside a locking transaction; the UI must never be the only enforcement.
- Places a household consumes = max(invited places, men + women + children).
- A wedding expense is the canonical financial record, optionally linked to a vendor and event. Quotes remain separate; agreed costs replace estimates for expected totals. Payments record money already paid against expenses and never process transfers. Money is stored in integer minor units.
- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma + PostgreSQL (Supabase in production), server actions.
- No signup, payments, or self-serve onboarding exist; accounts are created by the platform administrator. Do not add them.

## Brand Commitments

- Product label in the interface: "VowPal". Planning surfaces use clean white, light neutral and restrained warm coral/vermilion. Teal/green and purple are rejected as brand accents. Marketing/welcome tagline: "Your wedding planning pal."
- Customer-authored invitation text (couple names, welcome message, invitation wording, host messages) is never rewritten by the product.
- Voice: plain, specific, calm. Labels like "Guests", "Add household", "Awaiting reply", "62 of 75 places allocated". No marketing filler on working screens.

## Evidence on Hand

- A fictional demo wedding (`npm run db:local:seed`): "[Demo] Aisha & Omar", three events, 30 households, vendors and budget lines.
- No testimonials, customer counts, pricing or press exist. Do not fabricate them.

## Product Principles

1. Households and places are the unit of truth. Every count on screen must match the server's arithmetic.
2. Show the consequence, not the mechanism: what will happen to guests, places or money, never how the system works.
3. Each person sees only what they may act on; restricted views feel complete, not broken.
4. The guest's invitation belongs to the couple; the product frames it and gets out of the way.
5. The phone is a first-class planning device, not a reduced one.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast and keyboard access across planning screens and dialogs.
- Older relatives use the contributor and guest views: generous tap targets, readable type sizes, no reliance on hover.
- Respect reduced-motion preferences.
