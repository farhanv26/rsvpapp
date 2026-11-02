"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis } from "lucide-react";
import {
  logGuestWhatsappPreparedAction,
  markGuestEventReminderSentAction,
  markGuestsInvitedAction,
  markGuestsUninvitedAction,
  sendGuestInviteEmailAction,
  setGuestCountOwnershipAction,
  triggerGuestSendAction,
} from "@/app/admin/events/actions";
import { Menu, MenuItem, MenuSeparator } from "@/components/admin/ui/menu";
import { buildGuestMessages, guestEffectiveExcludedTotal, type GuestPanelGuest, type MessageContext } from "@/components/admin/guests/guest-model";

export function WhatsAppGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.02 5.33c-5.88 0-10.67 4.78-10.67 10.67 0 1.89.5 3.74 1.45 5.37L5.33 26.7l5.46-1.43c1.57.85 3.33 1.3 5.22 1.3 5.88 0 10.67-4.78 10.67-10.67S21.9 5.33 16.02 5.33Zm0 19.35c-1.68 0-3.33-.45-4.77-1.3l-.34-.2-3.24.85.86-3.16-.22-.33c-.92-1.43-1.41-3.08-1.41-4.78 0-4.95 4.03-8.98 8.98-8.98S25 10.81 25 15.76s-4.03 8.92-8.98 8.92Zm3.09-7.24c-.26-.13-1.51-.75-1.75-.83-.23-.09-.4-.13-.57.13-.17.26-.66.83-.81 1-.15.17-.3.2-.56.07-.26-.13-1.1-.4-2.09-1.28-.77-.69-1.29-1.54-1.44-1.8-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.57-1.36-.78-1.86-.21-.5-.42-.43-.57-.43l-.48-.01c-.17 0-.45.06-.68.32-.23.26-.9.88-.9 2.14 0 1.26.92 2.48 1.05 2.65.13.17 1.8 2.75 4.37 3.86 1.6.69 2.23.75 3.06.63.49-.07 1.51-.62 1.72-1.22.21-.6.21-1.11.15-1.22-.06-.11-.23-.17-.49-.3Z"
      />
    </svg>
  );
}

export function GuestRowActions({
  g,
  eventId,
  ctx,
  emailConfigured,
  onEdit,
  onRecordReply,
  onPreviewMessage,
  onCard,
  onHistory,
  onDelete,
  onNotice,
  onComposerOpened,
}: {
  g: GuestPanelGuest;
  eventId: string;
  ctx: MessageContext;
  emailConfigured: boolean;
  onEdit: (() => void) | null;
  onRecordReply: () => void;
  onPreviewMessage: () => void;
  onCard: () => void;
  onHistory: () => void;
  onDelete: (() => void) | null;
  onNotice: (message: string) => void;
  /** Called when a WhatsApp or text composer opens for a household that isn't marked invited yet. */
  onComposerOpened?: (channel: "whatsapp" | "imessage") => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setTick] = useState(0);
  const m = buildGuestMessages(g, ctx);
  const attending = m.status === "attending";
  const hasPhone = Boolean(g.phone?.trim());
  const excluded = guestEffectiveExcludedTotal(g) > 0 || g.exclusionKind === "ambiguous";

  function run(fn: () => Promise<unknown>, message?: string) {
    startTransition(async () => {
      await fn();
      if (message) onNotice(message);
      router.refresh();
    });
  }

  function onOpenedComposer(channel: "whatsapp" | "imessage") {
    if (attending) {
      void markGuestEventReminderSentAction(eventId, g.id, channel).then(() => {
        setTick((t) => t + 1);
        router.refresh();
      });
    } else {
      void triggerGuestSendAction(eventId, g.id, channel).then(() => router.refresh());
      if (!g.invitedAt) {
        if (onComposerOpened) onComposerOpened(channel);
        else onNotice(`Opened ${channel === "whatsapp" ? "WhatsApp" : "Messages"} for ${g.guestName}. Mark them invited once you've sent it.`);
      }
    }
  }

  async function copy(text: string, message: string, log = false) {
    try {
      await navigator.clipboard.writeText(text);
      onNotice(message);
      if (log) void logGuestWhatsappPreparedAction(eventId, g.id);
    } catch {
      onNotice("Couldn't copy. Your browser blocked clipboard access.");
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      {hasPhone && m.whatsappUrl && m.status !== "declined" ? (
        <a
          href={m.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="icon-btn text-[#128C7E] hover:text-[#0b6b60]"
          aria-label={attending ? `Send event reminder to ${g.guestName} on WhatsApp` : `Send invitation to ${g.guestName} on WhatsApp`}
          title={attending ? "Event reminder on WhatsApp" : "Invitation on WhatsApp"}
          onClick={() => onOpenedComposer("whatsapp")}
        >
          <WhatsAppGlyph />
        </a>
      ) : null}
      <Menu label={`Actions for ${g.guestName}`} trigger={<Ellipsis className="h-4 w-4" aria-hidden />} panelClassName="w-64">
        {onEdit ? <MenuItem onClick={onEdit}>Edit household</MenuItem> : null}
        <MenuItem onClick={onRecordReply}>Record reply</MenuItem>
        <MenuSeparator />
        {m.whatsappUrl ? (
          <MenuItem href={m.whatsappUrl} external onClick={() => onOpenedComposer("whatsapp")}>
            {attending ? "Event reminder on WhatsApp" : "Send on WhatsApp"}
          </MenuItem>
        ) : null}
        {m.smsUrl && hasPhone ? (
          <MenuItem href={m.smsUrl} onClick={() => onOpenedComposer("imessage")}>
            {attending ? "Event reminder by text" : "Send by text message"}
          </MenuItem>
        ) : null}
        {g.email?.trim() && emailConfigured ? (
          <MenuItem
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await sendGuestInviteEmailAction(eventId, g.id);
                onNotice(r.ok && !r.skipped ? `Email accepted by the email service for ${g.guestName}.` : `Email to ${g.guestName} wasn't sent.`);
              })
            }
          >
            Send invitation email
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => copy(m.inviteMessage, "Invitation message copied.", true)}>Copy invitation message</MenuItem>
        <MenuItem onClick={() => copy(m.link, "Invitation link copied.")}>Copy invitation link</MenuItem>
        <MenuItem onClick={onPreviewMessage}>Preview message</MenuItem>
        <MenuItem href={`${m.link}?preview=1`} external>
          View their invitation
        </MenuItem>
        <MenuItem onClick={onCard}>Invitation card</MenuItem>
        <MenuItem onClick={onHistory}>Message history</MenuItem>
        <MenuSeparator />
        {!g.invitedAt ? (
          <MenuItem disabled={pending} onClick={() => run(() => markGuestsInvitedAction(eventId, [g.id], "manual"), `Marked ${g.guestName} as invited.`)}>
            Mark invited
          </MenuItem>
        ) : (
          <MenuItem
            disabled={pending}
            onClick={() => {
              if (confirm(`Mark ${g.guestName} as not invited? Their reply stays on file.`)) {
                run(() => markGuestsUninvitedAction(eventId, [g.id]), `Marked ${g.guestName} as not invited.`);
              }
            }}
          >
            Mark not invited
          </MenuItem>
        )}
        {excluded ? (
          <MenuItem disabled={pending} onClick={() => run(() => setGuestCountOwnershipAction({ eventId, guestId: g.id, mode: "count_here" }), `${g.guestName} now counts here.`)}>
            Count here
          </MenuItem>
        ) : null}
        {g.exclusionKind === "ambiguous" ? (
          <MenuItem
            disabled={pending}
            onClick={() =>
              run(() => setGuestCountOwnershipAction({ eventId, guestId: g.id, mode: "exclude_here", reason: "Manual exclusion" }), `${g.guestName} is left out of this event's totals.`)
            }
          >
            Leave out of totals
          </MenuItem>
        ) : null}
        {onDelete ? (
          <>
            <MenuSeparator />
            <MenuItem tone="danger" onClick={onDelete}>
              Remove from event
            </MenuItem>
          </>
        ) : null}
      </Menu>
    </span>
  );
}
