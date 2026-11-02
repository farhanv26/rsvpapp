---
version: 1
slug: "app-admin-main"
primary_target: "app/admin/(main)"
related_targets: ["components/admin","app/admin/login"]
---

# Planning workspace (authenticated app)

Scope: every signed-in screen under `/admin` (shell, Overview, Guests, Events and the event dashboard, Budget, Vendors, Settings, Weddings, platform-admin Users and Activity, login). Visitor mode: Operate.

Audience and job: couples (organizers) and family contributors with place allowances, on laptop and phone. Tasks: add and edit households, keep inside allowances, send invitations and reminders from their own phone, see who replied, track money owed and vendors, keep the running order.

Constraints: every server-side permission and allowance check stays; customer-authored invitation text is never rewritten; no new features, payments or signup.

## Direction contract

THESIS: VowPal gives couples and contributors a clear shared workspace for household invitations across events. Familiar navigation and readable rows keep each next action obvious.

OWN-WORLD: White navigation and work panels on a cool neutral ground, deep teal for actions and selected states, Public Sans with strong hierarchy and tabular figures. Spacious page headers and precise table alignment replace the paper register aesthetic.

STORY: Choose a wedding, see the households and their event replies together, and act without losing context. Allowances remain visible beside the work they constrain.

FIRST VIEWPORT: Desktop white navigation rail with VowPal, wedding switcher and icon/text destinations; mobile top switcher and five-item bottom navigation. Guests opens with a title, household facts and Add household, then allowances and filters immediately above the white table.

FORM: User-pinned white/neutral/deep-teal direction supersedes the old paper/plum world. Familiar app navigation, rounded white workspace panels and teal selection. Existing allowance visualization remains meaningful data, with no decorative register metaphor. seed:53452abf80453a99

FINISH: Local desktop/mobile verification, permissions and allowance tests, finish review, and documented tokens.
