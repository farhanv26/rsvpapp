import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RsvpForm } from "@/components/rsvp-form";

const submitRsvpActionMock = vi.fn();

vi.mock("@/app/rsvp/[token]/actions", () => ({
  submitRsvpAction: (formData: FormData) => submitRsvpActionMock(formData),
}));

describe("Phase 2 - RSVP form flow", () => {
  beforeEach(() => {
    submitRsvpActionMock.mockReset();
  });
  afterEach(() => {
    cleanup();
  });

  it("starts attendee count at 0 and disables submit for accept until valid", () => {
    render(<RsvpForm token="abc" maxGuests={3} isLocked={false} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Review RSVP" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Select how many guests will attend")).toBeInTheDocument();
    expect(screen.getByText("Your invitation allows up to 3 guests")).toBeInTheDocument();
  });

  it("enables submit for accept after attendee count becomes valid", () => {
    render(<RsvpForm token="abc" maxGuests={3} isLocked={false} />);

    fireEvent.click(screen.getAllByLabelText("Increase guest count")[0]);
    const submit = screen.getByRole("button", { name: "Review RSVP" });
    expect(submit).not.toBeDisabled();
  });

  it("shows confirmation modal and submits accept on confirm", async () => {
    submitRsvpActionMock.mockResolvedValueOnce(undefined);

    render(<RsvpForm token="tok-1" maxGuests={2} isLocked={false} />);
    fireEvent.click(screen.getAllByLabelText("Increase guest count")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Review RSVP" }));

    expect(
      screen.getByText("You are confirming your presence with 1 guest(s)."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(submitRsvpActionMock).toHaveBeenCalledTimes(1));
    const formData = submitRsvpActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("token")).toBe("tok-1");
    expect(formData.get("attending")).toBe("yes");
    expect(formData.get("attendingCount")).toBe("1");
  });

  it("decline flow opens confirmation modal and allows submission", async () => {
    submitRsvpActionMock.mockResolvedValueOnce(undefined);
    render(<RsvpForm token="tok-2" maxGuests={4} isLocked={false} />);

    fireEvent.click(screen.getAllByRole("radio", { name: /decline/i })[0]);
    const submit = screen.getByRole("button", { name: "Review RSVP" });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    expect(screen.getByText("You are declining the invitation.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(submitRsvpActionMock).toHaveBeenCalledTimes(1));
    const formData = submitRsvpActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("attending")).toBe("no");
  });

  it("cancel in modal preserves current selection and does not submit", () => {
    render(<RsvpForm token="tok-3" maxGuests={3} isLocked={false} />);
    fireEvent.click(screen.getAllByLabelText("Increase guest count")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Review RSVP" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Confirm RSVP")).not.toBeInTheDocument();
    expect(submitRsvpActionMock).not.toHaveBeenCalled();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
