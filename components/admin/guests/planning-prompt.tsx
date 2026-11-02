"use client";

import { useState } from "react";
import { Dialog } from "@/components/admin/ui/dialog";

/** Asks for the group or table to set on the selected households. */
export function PlanningPrompt({
  kind,
  count,
  suggestions,
  onClose,
  onSave,
}: {
  kind: "assignGroup" | "assignTable";
  count: number;
  suggestions: string[];
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const label = kind === "assignGroup" ? "Group" : "Table";
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title={`Set ${label.toLowerCase()} for ${count} ${count === 1 ? "household" : "households"}`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={!value.trim()} onClick={() => onSave(value.trim())}>
            Save
          </button>
        </>
      }
    >
      <label className="form-label">
        {label}
        <input autoFocus list="planning-suggestions" value={value} onChange={(e) => setValue(e.target.value)} className="input-luxe" maxLength={120} />
        <datalist id="planning-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
    </Dialog>
  );
}
