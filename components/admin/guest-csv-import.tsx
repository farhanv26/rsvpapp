"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commitGuestCsvImportAction, previewGuestCsvAction } from "@/app/admin/events/csv-import-actions";
import type { CsvPreviewResult } from "@/lib/csv-guests";

type Props = {
  eventId: string;
};

export function GuestCsvImport({ eventId }: Props) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  function runPreview() {
    setError(null);
    setSuccess(null);
    setPreview(null);
    startTransition(async () => {
      const res = await previewGuestCsvAction(eventId, csvText);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (!res.preview) {
        setError("Could not load preview.");
        return;
      }
      setPreview(res.preview);
    });
  }

  function runImport() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await commitGuestCsvImportAction(eventId, csvText);
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
      setPreview(null);
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
            <code className="text-xs">phone</code>, <code className="text-xs">email</code>.
          </p>
        </div>
        <a
          href="/samples/guests-import.csv"
          download
          className="btn-secondary w-fit"
        >
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
            setPreview(null);
            setSuccess(null);
          }}
        >
          <textarea
            id="csv"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setPreview(null);
              setSuccess(null);
            }}
            rows={6}
            placeholder={`guestName,men,women,kids,greeting,group,tableName,notes\nThe Valli Family,2,2,1,Assalamu Alaikum,Family,Table 1,,`}
            className="w-full rounded-xl border border-[#dccfbb] bg-white px-4 py-3 font-mono text-sm text-zinc-900 placeholder:text-zinc-400"
          />
          <p className="mt-2 text-xs text-zinc-500">Tip: drag and drop your CSV file into this area.</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-zinc-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#3f2f1f] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) {
                return;
              }
              const text = await file.text();
              setCsvText(text);
              setPreview(null);
              setSuccess(null);
            }}
          />
          <button
            type="button"
            disabled={isPending || !csvText.trim()}
            onClick={runPreview}
            className="btn-secondary disabled:opacity-50"
          >
            {isPending ? "Working..." : "Preview"}
          </button>
          <button
            type="button"
            disabled={isPending || !preview || preview.importableCount === 0}
            onClick={runImport}
            className="btn-primary disabled:opacity-50"
          >
            Import {preview?.importableCount ? `(${preview.importableCount})` : ""}
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

      {preview ? (
        <div className="mt-6 space-y-3">
          {preview.requiredHeadersMissing.length > 0 ? (
            <p className="text-sm font-medium text-amber-800">
              Missing required column(s): {preview.requiredHeadersMissing.join(", ")}
            </p>
          ) : null}
          {preview.parseErrors.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-red-700">
              {preview.parseErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-zinc-600">
            {preview.rowCount} row(s) · {preview.importableCount} will be imported ·{" "}
            {preview.ready ? "All rows valid" : "Some rows need attention"}
          </p>
          <div className="max-h-72 overflow-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead className="sticky top-0 bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Men</th>
                  <th className="px-3 py-2 font-medium">Women</th>
                  <th className="px-3 py-2 font-medium">Kids</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Greeting</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Group</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {preview.rows.map((row) => (
                  <tr key={row.lineNumber} className={row.data ? "" : "bg-red-50/50"}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{row.lineNumber}</td>
                    <td className="px-3 py-2 font-medium text-zinc-900">{row.data?.guestName ?? "—"}</td>
                    <td className="px-3 py-2">{row.data?.menCount ?? "—"}</td>
                    <td className="px-3 py-2">{row.data?.womenCount ?? "—"}</td>
                    <td className="px-3 py-2">{row.data?.kidsCount ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.data ? row.data.menCount + row.data.womenCount + row.data.kidsCount : "—"}
                    </td>
                    <td className="hidden px-3 py-2 text-zinc-600 md:table-cell">{row.data?.greeting ?? "Assalamu Alaikum"}</td>
                    <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell">{row.data?.group ?? "—"}</td>
                    <td className="px-3 py-2">
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
