@AGENTS.md
# Project rules

- This is an RSVP/event management app built with Next.js, Prisma, and Supabase.
- Preserve all existing production behavior unless explicitly asked to change it.
- Be careful with Prisma schema changes; always call out when `prisma generate`, `db push`, or migrations are required.
- Do not remove existing features to implement new ones.
- Mobile fixes must not degrade desktop.
- Stats, invite tracking, RSVP state, and guest counts are high-risk; verify logic before editing.
- Prefer small, targeted changes over broad rewrites.
- Keep UI premium, minimal, and operational.