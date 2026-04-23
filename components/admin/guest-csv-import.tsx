"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importGuestCsvRowsAction } from "@/app/admin/events/csv-import-actions";
import {
  previewGuestCsv,
  recomputeCsvPreviewRows,
  selectRowsForImport,
  type CsvPreviewRow,
  type GuestImportRow,
} from "@/lib/csv-guests";
import { PHONE_COUNTRY_OPTIONS } from "@/lib/phone";

type Props = {
  eventId: string;
  existingGuestNameKeys: string[];
};

function csvMetaFromResult(result: ReturnType<typeof previewGuestCsv>) {
  return {
    ready: result.ready,
    importableCount: result.importableCount,
    parseErrors: result.parseErrors,
    requiredHeadersMissing: result.requiredHeadersMissing,
    rowCount: result.rowCount,
    headerMode: result.headerMode,
  };
}

export function GuestCsvImport({ eventId, existingGuestNameKeys }: Props) {
  const router = useRouter();
  const existingSet = useMemo(() => new Set(existingGuestNameKeys), [existingGuestNameKeys]);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<CsvPreviewRow[] | null>(null);
  const [meta, setMeta] = useState<ReturnType<typeof csvMetaFromResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  const parseAndSet = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) {
        setRows(null);
        setMeta(null);
        return;
      }
      const result = previewGuestCsv(t, existingSet);
      setRows(result.rows);
      setMeta(csvMetaFromResult(result));
    },
    [existingSet],
  );

  const importableCount = rows ? selectRowsForImport(rows).length : 0;
  const ready =
    meta &&
    meta.requiredHeadersMissing.length === 0 &&
    meta.parseErrors.length === 0 &&
    rows &&
    rows.length > 0 &&
    !rows.some((r) => r.data === null);

  function updateRowField(index: number, patch: Partial<GuestImportRow>) {
    setRows((prev) => {
      if (!prev || !prev[index]?.data) return prev;
      const merged: GuestImportRow = { ...prev[index].data!, ...patch };
      const next = [...prev];
      next[index] = { ...next[index], data: merged };
      return recomputeCsvPreviewRows(next, existingSet);
    });
  }

  function runImport() {
    if (!rows) return;
    const toSend = selectRowsForImport(rows);
    if (toSend.length === 0) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await importGuestCsvRowsAction(eventId, toSend);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.created === 0) {
        setError(res.message ?? "Nothing was imported.");
        return;
      }
      setSuccess(
        `Imported ${res.created} guest${res.created === 1 ? "" : "s"}. Skipped: ${res.skippedDuplicateInDb} already on list, ${res.skippedDuplicateInFile} duplicate in file, ${res.skippedInvalid} invalid rows.`,
      );
      setRows(null);
      setMeta(null);
      setCsvText("");
      router.refresh();
    });
  }

  return (
    <div className="app-card p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Import guests from CSV</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Required columns: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">guestName</code>,{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">men</code>,{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">women</code>,{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">kids</code>. Optional:{" "}
            <code className="text-xs">greeting</code>, <code className="text-xs">group</code>,{" "}
            <code className="text-xs">tableName</code>, <code className="text-xs">notes</code>,{" "}
            <code className="text-xs">phone</code>, <code className="text-xs">phoneCountryCode</code>,{" "}
            <code className="text-xs">email</code>, <code className="text-xs">excludeFromTotals</code>,{" "}
            <code className="text-xs">excludeReason</code>.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Choose a file or paste CSV, then tab out of the box — rows load automatically. Edit cells before
            importing. International numbers with + (e.g. +44…) are detected from the phone column.
          </p>
        </div>
        <a href="/samples/guests-import.csv" download className="btn-secondary w-fit">
          Download template
        </a>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="csv">
          Paste CSV or upload a .csv file
        </label>
        <div
          className={`mt-2 rounded-2xl border-2 border-dashed p-3 transition ${
            isDragging ? "border-[#b28944] bg-[#f8f1e5]" : "border-[#dbcdb8] bg-[#fdfaf3]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            const text = await file.text();
            setCsvText(text);
            setSuccess(null);
            parseAndSet(text);
          }}
        >
          <textarea
            id="csv"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setSuccess(null);
            }}
            onBlur={() => parseAndSet(csvText)}
            rows={6}
            placeholder={`guestName,men,women,kids,greeting,group,tableName,notes,phone,phoneCountryCode\nThe Valli Family,2,2,1,Assalamu Alaikum,Family,Table 1,,+44 7415 980802,`}
            className="w-full rounded-xl border border-[#dccfbb] bg-white px-4 py-3 font-mono text-sm text-zinc-900 placeholder:text-zinc-400"
          />
          <p className="mt-2 text-xs text-zinc-500">Tip: drag and drop a .csv file here, or paste and click outside to load rows.</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-zinc-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#3f2f1f] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setCsvText(text);
              setSuccess(null);
              parseAndSet(text);
            }}
          />
          <button
            type="button"
            disabled={isPending || importableCount === 0}
            onClick={runImport}
            className="btn-primary disabled:opacity-50"
          >
            {isPending ? "Working…" : `Import${importableCount ? ` (${importableCount})` : ""}`}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      {rows && meta ? (
        <div className="mt-6 space-y-3">
          {meta.requiredHeadersMissing.length > 0 ? (
            <p className="text-sm font-medium text-amber-800">
              Missing required column(s): {meta.requiredHeadersMissing.join(", ")}
            </p>
          ) : null}
          {meta.parseErrors.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-red-700">
              {meta.parseErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-zinc-600">
            {meta.rowCount} row(s) · {importableCount} ready to import ·{" "}
            {ready ? "All rows valid" : "Some rows need attention"}
          </p>
          <p className="text-xs text-zinc-500">
            {meta.headerMode === "header" ? "Header mapping" : "No-header positional mapping"}
          </p>
          <div className="max-h-[min(70vh,28rem)] overflow-auto rounded-2xl border border-zinc-200">
            <table className="min-w-[56rem] text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="min-w-[8rem] px-2 py-2 font-medium">Name</th>
                  <th className="w-12 px-1 py-2 font-medium">M</th>
                  <th className="w-12 px-1 py-2 font-medium">W</th>
                  <th className="w-12 px-1 py-2 font-medium">K</th>
                  <th className="hidden px-2 py-2 font-medium md:table-cell">Greeting</th>
                  <th className="hidden px-2 py-2 font-medium sm:table-cell">Group</th>
                  <th className="min-w-[7rem] px-1 py-2 font-medium">Country</th>
                  <th className="min-w-[9rem] px-1 py-2 font-medium">Phone</th>
                  <th className="hidden min-w-[10rem] px-1 py-2 font-medium lg:table-cell">Email</th>
                  <th className="px-2 py-2 font-medium">WA</th>
                  <th className="min-w-[6rem] px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {rows.map((row, i) => (
                  <tr key={row.lineNumber} className={row.data ? "" : "bg-red-50/50"}>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500">{row.lineNumber}</td>
                    <td className="px-1 py-1">
                      {row.data ? (
                        <input
                          value={row.data.guestName}
                          onChange={(e) => updateRowField(i, { guestName: e.target.value })}
                          className="w-full min-w-[7rem] rounded-lg border border-[#e7dfd0] bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-[#c4a574] sm:text-sm"
                        />
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-0.5 py-1">
                      {row.data ? (
                        <input
                          type="number"
                          min={0}
                          value={row.data.menCount}
                          onChange={(e) => updateRowField(i, { menCount: Number(e.target.value) || 0 })}
                          className="w-full rounded-lg border border-[#e7dfd0] bg-white px-1 py-1 text-xs tabular-nums outline-none focus:border-[#c4a574]"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-0.5 py-1">
                      {row.data ? (
                        <input
                          type="number"
                          min={0}
                          value={row.data.womenCount}
                          onChange={(e) => updateRowField(i, { womenCount: Number(e.target.value) || 0 })}
                          className="w-full rounded-lg border border-[#e7dfd0] bg-white px-1 py-1 text-xs tabular-nums outline-none focus:border-[#c4a574]"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-0.5 py-1">
                      {row.data ? (
                        <input
                          type="number"
                          min={0}
                          value={row.data.kidsCount}
                          onChange={(e) => updateRowField(i, { kidsCount: Number(e.target.value) || 0 })}
                          className="w-full rounded-lg border border-[#e7dfd0] bg-white px-1 py-1 text-xs tabular-nums outline-none focus:border-[#c4a574]"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden px-1 py-1 md:table-cell">
                      {row.data ? (
                        <input
                          value={row.data.greeting ?? ""}
                          onChange={(e) => updateRowField(i, { greeting: e.target.value || undefined })}
                          className="w-full min-w-[6rem] rounded-lg border border-[#e7dfd0] bg-white px-2 py-1 text-xs outline-none focus:border-[#c4a574]"
                          placeholder="Greeting"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden px-1 py-1 sm:table-cell">
                      {row.data ? (
                        <input
                          value={row.data.group ?? ""}
                          onChange={(e) => updateRowField(i, { group: e.target.value || undefined })}
                          className="w-full min-w-[5rem] rounded-lg border border-[#e7dfd0] bg-white px-2 py-1 text-xs outline-none focus:border-[#c4a574]"
                          placeholder="Group"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-1 py-1">
                      {row.data ? (
                        <select
                          value={row.data.phoneCountryCode ?? ""}
                          onChange={(e) =>
                            updateRowField(i, { phoneCountryCode: e.target.value || undefined })
                          }
                          className="w-full max-w-[9rem] rounded-lg border border-[#e7dfd0] bg-white px-1 py-1 text-[11px] outline-none focus:border-[#c4a574] sm:text-xs"
                          title="Country code (optional if phone starts with +)"
                        >
                          <option value="">Auto / from phone</option>
                          {PHONE_COUNTRY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-1 py-1">
                      {row.data ? (
                        <input
                          value={row.data.phone ?? ""}
                          onChange={(e) => updateRowField(i, { phone: e.target.value || undefined })}
                          className="w-full min-w-[8rem] rounded-lg border border-[#e7dfd0] bg-white px-2 py-1 font-mono text-[11px] text-zinc-900 outline-none focus:border-[#c4a574] sm:text-xs"
                          placeholder="+44… or digits"
                          spellCheck={false}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden px-1 py-1 lg:table-cell">
                      {row.data ? (
                        <input
                          type="email"
                          value={row.data.email ?? ""}
                          onChange={(e) => updateRowField(i, { email: e.target.value || undefined })}
                          className="w-full min-w-[8rem] rounded-lg border border-[#e7dfd0] bg-white px-2 py-1 text-xs outline-none focus:border-[#c4a574]"
                          placeholder="Email"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {!row.data?.phone?.trim() ? (
                        <span className="text-zinc-400">—</span>
                      ) : row.phoneImport?.validWhatsApp ? (
                        <span className="text-emerald-800">Valid</span>
                      ) : (
                        <span className="text-amber-800">Invalid</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {!row.data ? (
                        <span className="text-red-700">{row.errors.join("; ")}</span>
                      ) : row.duplicateInDatabase ? (
                        <span className="text-amber-800">Already invited</span>
                      ) : row.duplicateInFile ? (
                        <span className="text-amber-800">Duplicate in file</span>
                      ) : (
                        <span className="text-emerald-800">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
