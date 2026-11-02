import type { Prisma } from "@prisma/client";
import { NoWeddingSelected, PageHeader } from "@/components/admin/planning-ui";
import { GuestDirectory, type DirectoryAllowance, type DirectoryEvent, type DirectoryHousehold } from "@/components/admin/guests/guest-directory";
import { effectiveExclusionFields } from "@/lib/attendance";
import { allocationUsage, getGuestListPermission } from "@/lib/guest-allocation";
import { canEditGuest, canSeeAllGuests, guestScopeWhere, invitationPlaces, type GuestListPermission } from "@/lib/guest-permissions";
import { formatGuestPhoneLabel } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { loadPlanningPage } from "@/lib/workspace-page";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ q?: string; event?: string; status?: string; member?: string; page?: string }> };

const STATUS_VALUES = ["waiting", "attending", "declined", "not_invited"] as const;
const PAGE_SIZE = 100;

type CellStatus = "attending" | "declined" | "waiting" | "not_invited";

function statusOf(g: { attending: boolean | null; respondedAt: Date | null; invitedAt: Date | null }): CellStatus {
  if (g.attending === true) return "attending";
  if (g.attending === false) return "declined";
  if (g.invitedAt && !g.respondedAt) return "waiting";
  return "not_invited";
}

export default async function GuestsPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const { admin, workspace, wedding } = await loadPlanningPage();
  if (!wedding) {
    return (
      <main className="app-shell">
        <PageHeader title="Guests" />
        <NoWeddingSelected hasWeddings={workspace.weddings.length > 0} />
      </main>
    );
  }

  const events = await prisma.event.findMany({
    where: { weddingId: wedding.id, deletedAt: null },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true },
  });
  const members = await prisma.weddingMembership.findMany({
    where: { weddingId: wedding.id },
    orderBy: { createdAt: "asc" },
    select: { userId: true, user: { select: { name: true } } },
  });
  const memberName = new Map(members.map((m) => [m.userId, m.user.name]));

  const perms = new Map<string, GuestListPermission>();
  const scopes: Prisma.GuestWhereInput[] = [];
  for (const e of events) {
    const perm = await getGuestListPermission(admin, e.id);
    perms.set(e.id, perm);
    scopes.push({ eventId: e.id, ...guestScopeWhere(perm) });
  }

  const allowances: DirectoryAllowance[] = [];
  const directoryEvents: DirectoryEvent[] = [];
  for (const e of events) {
    const perm = perms.get(e.id)!;
    const usage = await allocationUsage(e.id);
    const mine = perm.allocation ? usage.allocations.find((a) => a.id === perm.allocation!.id) : null;
    const visible = canSeeAllGuests(perm) ? usage.allocations : usage.allocations.filter((a) => a.userId === admin.id);
    for (const a of visible) {
      allowances.push({ eventId: e.id, eventTitle: e.title, memberName: a.userId === admin.id ? "You" : a.userName, places: a.places, used: a.used });
    }
    directoryEvents.push({
      id: e.id,
      title: e.title,
      canAdd: perm.level === "organizer" || Boolean(perm.allocation),
      allowance: perm.level === "contributor" && mine ? { places: mine.places, used: mine.used } : null,
    });
  }

  const q = sp.q?.trim().slice(0, 80) ?? "";
  const eventFilter = events.some((e) => e.id === sp.event) ? sp.event! : "";
  const statusFilter = (STATUS_VALUES as readonly string[]).includes(sp.status ?? "") ? (sp.status as CellStatus) : "";
  const memberFilter = memberName.has(sp.member ?? "") ? sp.member! : "";

  const guests =
    scopes.length === 0
      ? []
      : await prisma.guest.findMany({
          where: {
            deletedAt: null,
            AND: [
              { OR: scopes },
              ...(q
                ? [
                    {
                      OR: [
                        { guestName: { contains: q, mode: "insensitive" as const } },
                        { email: { contains: q, mode: "insensitive" as const } },
                        { phone: { contains: q } },
                        { group: { contains: q, mode: "insensitive" as const } },
                      ],
                    },
                  ]
                : []),
            ],
          },
          orderBy: { guestName: "asc" },
        });

  const households = new Map<string, DirectoryHousehold>();
  for (const g of guests) {
    const key = g.sharedGuestKey ?? `g:${g.id}`;
    const contact = [formatGuestPhoneLabel(g), g.email].filter(Boolean).join(" · ");
    const h =
      households.get(key) ??
      ({ key, name: g.guestName, group: g.group, contact, managers: [], cells: {} } satisfies DirectoryHousehold);
    if (!h.contact && contact) h.contact = contact;
    if (!h.group && g.group) h.group = g.group;
    const manager = g.managedByUserId ? (memberName.get(g.managedByUserId) ?? "Former member") : null;
    if (manager && !h.managers.includes(manager)) h.managers.push(manager);
    const exclusion = effectiveExclusionFields(g);
    h.cells[g.eventId] = {
      guestId: g.id,
      status: statusOf(g),
      attendingCount: g.attendingCount,
      places: invitationPlaces(g),
      canEdit: canEditGuest(perms.get(g.eventId)!, g),
      form: {
        id: g.id,
        guestName: g.guestName,
        greeting: g.greeting ?? "Assalamu Alaikum",
        menCount: g.menCount ?? 0,
        womenCount: g.womenCount ?? 0,
        kidsCount: g.kidsCount ?? 0,
        group: g.group,
        tableName: g.tableName,
        notes: g.notes,
        phone: g.phone,
        phoneCountryCode: g.phoneCountryCode,
        email: g.email,
        isFamilyInvite: g.isFamilyInvite,
        excludedMenCount: exclusion.excludedMenCount,
        excludedWomenCount: exclusion.excludedWomenCount,
        excludedKidsCount: exclusion.excludedKidsCount,
        excludeReason: exclusion.exclusionKind === "legacy_automatic" ? null : g.excludeReason,
        countOwnerEventId: exclusion.exclusionKind === "legacy_automatic" ? null : g.countOwnerEventId,
        isSharedGuest: false,
      },
    };
    households.set(key, h);
  }
  for (const h of households.values()) {
    const cells = Object.values(h.cells);
    if (cells.length > 1) for (const c of cells) c!.form.isSharedGuest = true;
  }

  let rows = [...households.values()];
  if (eventFilter) rows = rows.filter((h) => h.cells[eventFilter]);
  if (memberFilter) {
    const name = memberName.get(memberFilter)!;
    rows = rows.filter((h) => h.managers.includes(name));
  }
  if (statusFilter) {
    rows = rows.filter((h) => {
      const cells = eventFilter ? [h.cells[eventFilter]].filter(Boolean) : Object.values(h.cells);
      return cells.some((c) => c!.status === statusFilter);
    });
  }

  const totalHouseholds = households.size;
  const totalPlaces = guests.reduce((s, g) => s + invitationPlaces(g), 0);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = Boolean(q || eventFilter || statusFilter || memberFilter);

  return (
    <main className="app-shell">
      <GuestDirectory
        events={directoryEvents}
        members={members.map((m) => ({ id: m.userId, name: m.user.name }))}
        rows={pageRows}
        matchCount={rows.length}
        totalHouseholds={totalHouseholds}
        totalPlaces={filtered ? null : totalPlaces}
        allowances={allowances}
        filters={{ q, event: eventFilter, status: statusFilter, member: memberFilter }}
        page={page}
        pages={pages}
        defaultGreeting={wedding.defaultGreeting || "Assalamu Alaikum"}
      />
    </main>
  );
}
