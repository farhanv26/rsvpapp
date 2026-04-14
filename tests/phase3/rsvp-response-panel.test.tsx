import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RsvpResponsePanel } from "@/components/rsvp-response-panel";

vi.mock("@/components/rsvp-form", () => ({
  RsvpForm: () => <div data-testid="rsvp-form-edit">RSVP edit form</div>,
}));

describe("Phase 3 - RSVP edit flow UI", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows edit button when editing is allowed", () => {
    render(
      <RsvpResponsePanel
        token="tok"
        maxGuests={3}
        respondedAtLabel="Apr 14"
        attending
        attendingCount={2}
        canEdit
      />,
    );
    expect(screen.getByRole("button", { name: "Edit RSVP" })).toBeInTheDocument();
  });

  it("opens edit flow when edit button is clicked", () => {
    render(
      <RsvpResponsePanel
        token="tok"
        maxGuests={3}
        respondedAtLabel="Apr 14"
        attending={false}
        attendingCount={null}
        canEdit
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Edit RSVP" })[0]);
    expect(screen.getByTestId("rsvp-form-edit")).toBeInTheDocument();
  });

  it("shows closed editing notice when edit is not allowed", () => {
    render(
      <RsvpResponsePanel
        token="tok"
        maxGuests={3}
        respondedAtLabel="Apr 14"
        attending
        attendingCount={1}
        canEdit={false}
      />,
    );
    expect(screen.queryAllByRole("button", { name: "Edit RSVP" })).toHaveLength(0);
    expect(screen.getByText("Editing is closed after the RSVP deadline")).toBeInTheDocument();
  });
});
