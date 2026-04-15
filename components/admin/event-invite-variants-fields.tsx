import { EventImageUploadField } from "@/components/admin/event-image-upload-field";

export type EventInviteVariantInitials = {
  genericCardImage?: string | null;
  cardImage1?: string | null;
  cardImage2?: string | null;
  cardImage3?: string | null;
  cardImage4?: string | null;
  familyCardImage?: string | null;
};

type Props = {
  initials?: EventInviteVariantInitials | null;
};

export function EventInviteVariantsFields({ initials }: Props) {
  const i = initials ?? {};
  return (
    <details className="group rounded-2xl border border-[#e3d8c7] bg-[#fbf8f2] p-4 sm:p-5">
      <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block text-zinc-500 transition-transform duration-200 group-open:rotate-90">▸</span>
          Advanced invite card variants
        </span>
      </summary>
      <p className="mt-3 text-sm text-zinc-600">
        Optional: upload different invite card versions based on guest count or family invitations.
      </p>
      <div className="mt-6 space-y-8">
        <EventImageUploadField
          inputName="genericCardImage"
          initialImagePath={i.genericCardImage ?? null}
          label="Generic card (fallback)"
          description="Used when no size-specific card matches and this guest is not a flagged family invite (or family card is empty)."
          previewHeightClassName="h-40"
        />
        <div className="grid gap-8 sm:grid-cols-2">
          <EventImageUploadField
            inputName="cardImage1"
            initialImagePath={i.cardImage1 ?? null}
            label="1 guest card"
            description="Shown when max guests = 1."
            previewHeightClassName="h-36"
          />
          <EventImageUploadField
            inputName="cardImage2"
            initialImagePath={i.cardImage2 ?? null}
            label="2 guest card"
            description="Shown when max guests = 2."
            previewHeightClassName="h-36"
          />
          <EventImageUploadField
            inputName="cardImage3"
            initialImagePath={i.cardImage3 ?? null}
            label="3 guest card"
            description="Shown when max guests = 3."
            previewHeightClassName="h-36"
          />
          <EventImageUploadField
            inputName="cardImage4"
            initialImagePath={i.cardImage4 ?? null}
            label="4 guest card"
            description="Shown when max guests = 4."
            previewHeightClassName="h-36"
          />
        </div>
        <EventImageUploadField
          inputName="familyCardImage"
          initialImagePath={i.familyCardImage ?? null}
          label="Family invite card"
          description="Used for guests marked as family invite, after size slots are checked."
          previewHeightClassName="h-40"
        />
      </div>
    </details>
  );
}
