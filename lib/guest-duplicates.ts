/**
 * Within-event duplicate detection for guest list hygiene.
 * Uses normalized name, phone (digits), and email — no fuzzy matching.
 */

export type GuestDuplicateInput = {
  id: string;
  guestName: string;
  phone: string | null;
  email: string | null;
};

/** Trim, lowercase, collapse internal whitespace. */
export function normalizeGuestNameForDedup(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trim + lowercase; empty → null */
export function normalizeEmailForDedup(email: string | null | undefined): string | null {
  const t = email?.trim().toLowerCase();
  return t && t.length > 0 ? t : null;
}

/** Digits only; require at least 10 to treat as a match key (avoids junk matches). */
export function normalizePhoneDigitsForDedup(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return d;
}

export type DuplicateStrength = "strong" | "weak" | "none";

/** One pass O(n²) — use per event guest list size. */
export function buildDuplicateStrengthMap(allGuests: GuestDuplicateInput[]): Map<string, DuplicateStrength> {
  const n = allGuests.length;
  const strong = new Set<string>();
  const weak = new Set<string>();

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = allGuests[i];
      const b = allGuests[j];
      const ea = normalizeEmailForDedup(a.email);
      const eb = normalizeEmailForDedup(b.email);
      const pa = normalizePhoneDigitsForDedup(a.phone);
      const pb = normalizePhoneDigitsForDedup(b.phone);
      if (ea && eb && ea === eb) {
        strong.add(a.id);
        strong.add(b.id);
      }
      if (pa && pb && pa === pb) {
        strong.add(a.id);
        strong.add(b.id);
      }
      const na = normalizeGuestNameForDedup(a.guestName);
      const nb = normalizeGuestNameForDedup(b.guestName);
      if (na.length > 0 && na === nb) {
        weak.add(a.id);
        weak.add(b.id);
      }
    }
  }

  const map = new Map<string, DuplicateStrength>();
  for (const g of allGuests) {
    if (strong.has(g.id)) map.set(g.id, "strong");
    else if (weak.has(g.id)) map.set(g.id, "weak");
    else map.set(g.id, "none");
  }
  return map;
}

/** Strong = same phone or same email as another guest; weak = same name only (no strong match). */
export function getDuplicateStrength(guest: GuestDuplicateInput, allGuests: GuestDuplicateInput[]): DuplicateStrength {
  return buildDuplicateStrengthMap(allGuests).get(guest.id) ?? "none";
}

export function isInDuplicateCluster(guest: GuestDuplicateInput, allGuests: GuestDuplicateInput[]): boolean {
  return getDuplicateStrength(guest, allGuests) !== "none";
}

export type DuplicateClusterReason = "same_name" | "same_phone" | "same_email";

function clusterReasonsForPair(
  a: GuestDuplicateInput,
  b: GuestDuplicateInput,
): DuplicateClusterReason[] {
  const out: DuplicateClusterReason[] = [];
  const na = normalizeGuestNameForDedup(a.guestName);
  const nb = normalizeGuestNameForDedup(b.guestName);
  if (na.length > 0 && na === nb) out.push("same_name");

  const ea = normalizeEmailForDedup(a.email);
  const eb = normalizeEmailForDedup(b.email);
  if (ea && eb && ea === eb) out.push("same_email");

  const pa = normalizePhoneDigitsForDedup(a.phone);
  const pb = normalizePhoneDigitsForDedup(b.phone);
  if (pa && pb && pa === pb) out.push("same_phone");

  return out;
}

function unionFind(n: number): { find: (i: number) => number; union: (a: number, b: number) => void } {
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  return { find, union };
}

export type DuplicateCluster = {
  guestIds: string[];
  reasons: DuplicateClusterReason[];
};

/**
 * Connected components: edge between two guests if they share name, phone, or email (per normalization rules).
 */
export function buildDuplicateClusters(allGuests: GuestDuplicateInput[]): DuplicateCluster[] {
  const n = allGuests.length;
  if (n < 2) return [];

  const { find, union } = unionFind(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const reasons = clusterReasonsForPair(allGuests[i], allGuests[j]);
      if (reasons.length > 0) {
        union(i, j);
      }
    }
  }

  const rootToIndices = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = rootToIndices.get(r) ?? [];
    list.push(i);
    rootToIndices.set(r, list);
  }

  const clusters: DuplicateCluster[] = [];
  for (const indices of rootToIndices.values()) {
    if (indices.length < 2) continue;
    const reasonSet = new Set<DuplicateClusterReason>();
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const rs = clusterReasonsForPair(allGuests[indices[a]], allGuests[indices[b]]);
        for (const r of rs) reasonSet.add(r);
      }
    }
    clusters.push({
      guestIds: indices.map((i) => allGuests[i].id),
      reasons: Array.from(reasonSet),
    });
  }

  return clusters;
}

export function countGuestsInDuplicateClusters(allGuests: GuestDuplicateInput[]): number {
  const clusters = buildDuplicateClusters(allGuests);
  const seen = new Set<string>();
  for (const c of clusters) {
    for (const id of c.guestIds) seen.add(id);
  }
  return seen.size;
}

export function countDuplicateClusters(allGuests: GuestDuplicateInput[]): number {
  return buildDuplicateClusters(allGuests).length;
}

export function duplicateReasonLabels(reasons: DuplicateClusterReason[]): string[] {
  const order: DuplicateClusterReason[] = ["same_email", "same_phone", "same_name"];
  const labels: Record<DuplicateClusterReason, string> = {
    same_email: "Same email",
    same_phone: "Same phone",
    same_name: "Same name",
  };
  return order.filter((r) => reasons.includes(r)).map((r) => labels[r]);
}

export type DuplicateFilterId = "all" | "has_duplicates" | "clean";

export function matchesDuplicateFilter(
  guest: GuestDuplicateInput,
  allGuests: GuestDuplicateInput[],
  filter: DuplicateFilterId,
): boolean {
  if (filter === "all") return true;
  const strength = getDuplicateStrength(guest, allGuests);
  return matchesDuplicateStrengthFilter(strength, filter);
}

export function matchesDuplicateStrengthFilter(
  strength: DuplicateStrength,
  filter: DuplicateFilterId,
): boolean {
  if (filter === "all") return true;
  const inCluster = strength !== "none";
  if (filter === "has_duplicates") return inCluster;
  return !inCluster;
}
