"use client";

import { Download, Plus, Search, SlidersHorizontal, Upload } from "lucide-react";
import { Menu, MenuItem } from "@/components/admin/ui/menu";
import { PhoneAddButton } from "@/components/admin/guests/phone-add-button";
import type { GuestStatus, StatusFilter } from "@/components/admin/guests/guest-model";

export type ExportKind = "all" | "view" | "selected" | "confirmed" | "dataset";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_invited", label: "Not invited" },
  { id: "invited", label: "Awaiting reply" },
  { id: "attending", label: "Attending" },
  { id: "declined", label: "Declined" },
];

export function GuestListToolbar({
  summary,
  q,
  onQuery,
  status,
  onStatus,
  statusCounts,
  total,
  advancedCount,
  onOpenFilters,
  hasGuests,
  canAdd,
  onImport,
  onAdd,
  onExport,
  selecting = false,
}: {
  /** True while households are selected, so the bulk bar owns the bottom of the screen. */
  selecting?: boolean;
  summary: React.ReactNode;
  q: string;
  onQuery: (q: string) => void;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  statusCounts: Record<GuestStatus, number>;
  total: number;
  advancedCount: number;
  onOpenFilters: () => void;
  hasGuests: boolean;
  canAdd: boolean;
  onImport: () => void;
  onAdd: () => void;
  onExport: (kind: ExportKind) => void;
}) {
  const countOf = (id: StatusFilter) => (id === "all" ? total : statusCounts[id as GuestStatus]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 text-sm text-[var(--muted-text)] tabular-nums" aria-live="polite">
          {summary}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {hasGuests ? (
            <Menu
              label="Export guests"
              summaryClassName="btn-secondary px-3"
              panelClassName="w-60"
              trigger={
                <>
                  <Download className="h-4 w-4" aria-hidden />
                  <span className="hidden lg:inline">Export</span>
                </>
              }
            >
              <MenuItem onClick={() => onExport("all")}>All guests (CSV)</MenuItem>
              <MenuItem onClick={() => onExport("view")}>Current view (CSV)</MenuItem>
              <MenuItem onClick={() => onExport("confirmed")}>Confirmed attendees</MenuItem>
              <MenuItem onClick={() => onExport("dataset")}>Full RSVP data with links</MenuItem>
            </Menu>
          ) : null}
          {canAdd ? (
            <>
              <button type="button" className="btn-secondary px-3" onClick={onImport}>
                <Upload className="h-4 w-4" aria-hidden />
                <span className="hidden lg:inline">Import</span>
                <span className="sr-only lg:hidden">Import from CSV</span>
              </button>
              <button id="guest-list-add" type="button" className="btn-primary flex-1 sm:flex-none" onClick={onAdd}>
                <Plus className="h-4 w-4" aria-hidden />
                Add household
              </button>
              <PhoneAddButton onClick={onAdd} hidden={selecting} watchId="guest-list-add" />
            </>
          ) : null}
        </div>
      </div>

      {hasGuests ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-full sm:max-w-60 sm:basis-auto">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]" aria-hidden />
            <label htmlFor="guest-list-search" className="sr-only">
              Search guests
            </label>
            <input
              id="guest-list-search"
              type="search"
              value={q}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search guests"
              className="input-luxe mt-0 pl-9"
            />
          </div>
          <label className="min-w-0 flex-1 lg:hidden">
            <span className="sr-only">Reply</span>
            <select className="input-luxe mt-0" value={status} onChange={(e) => onStatus(e.target.value as StatusFilter)}>
              {STATUS_TABS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({countOf(t.id)})
                </option>
              ))}
            </select>
          </label>
          <div className="segmented hidden lg:inline-flex" role="group" aria-label="Filter by reply">
            {STATUS_TABS.map((t) => (
              <button key={t.id} type="button" aria-pressed={status === t.id} onClick={() => onStatus(t.id)}>
                {t.label}
                <span className="ml-1.5 tabular-nums text-[var(--muted-text)]">{countOf(t.id)}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`btn-secondary px-3 ${advancedCount ? "border-[var(--accent)]" : ""}`}
            onClick={onOpenFilters}
            aria-label={advancedCount ? `More filters, ${advancedCount} active` : "More filters"}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="hidden xl:inline">Filters</span>
            {advancedCount ? <span className="rounded bg-[var(--accent)] px-1.5 text-xs font-semibold text-white tabular-nums">{advancedCount}</span> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
