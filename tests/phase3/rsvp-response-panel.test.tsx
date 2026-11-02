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
        hostMessage={null}
        canEdit
      />,
    );
    expect(screen.getByRole("button", { name: "Change my reply" })).toBeInTheDocument();
  });

  it("opens edit flow when edit button is clicked", () => {
    render(
      <RsvpResponsePanel
        token="tok"
        maxGuests={3}
        respondedAtLabel="Apr 14"
        attending={false}
        attendingCount={null}
        hostMessage={null}
        canEdit
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Change my reply" })[0]);
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
        hostMessage={null}
        canEdit={false}
      />,
    );
    expect(screen.queryAllByRole("button", { name: "Change my reply" })).toHaveLength(0);
    expect(screen.getByText("Replies have closed. To change your plans, please contact your hosts.")).toBeInTheDocument();
  });
});
