"use client";

export function EventReportPrintButton() {
  return (
    <button
      type="button"
      className="btn-primary print:hidden"
      onClick={() => window.print()}
    >
      Print report
    </button>
  );
}
