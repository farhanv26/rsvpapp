import { PlaceRegister } from "@/components/admin/planning-ui";

/** The event's places at a glance: who is coming, who has yet to reply, who hasn't been invited. */
export function EventRegister({
  placesOnList,
  coming,
  awaitingPlaces,
  notInvitedPlaces,
  repliedHouseholds,
  households,
  deadline,
}: {
  placesOnList: number;
  coming: number;
  awaitingPlaces: number;
  notInvitedPlaces: number;
  repliedHouseholds: number;
  households: number;
  deadline: { text: string; urgent: boolean } | null;
}) {
  const notComing = Math.max(placesOnList - coming - awaitingPlaces - notInvitedPlaces, 0);
  return (
    <div className="border-y border-[var(--border-strong)] py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm tabular-nums">
        <p>
          <span className="text-lg font-bold tracking-[-0.01em]">{placesOnList}</span> places on the list
          <span className="text-[var(--muted-text)]">
            {" "}
            · {repliedHouseholds} of {households} households replied
          </span>
        </p>
        {deadline ? <p className={deadline.urgent ? "font-semibold text-[var(--warning)]" : "text-[var(--muted-text)]"}>{deadline.text}</p> : null}
      </div>
      <div className="mt-2">
        <PlaceRegister
          total={placesOnList}
          segments={[
            { places: coming, tone: "ink", label: "Coming" },
            { places: awaitingPlaces, tone: "soft", label: "Awaiting reply" },
            { places: notInvitedPlaces, tone: "pale", label: "Not invited yet" },
          ]}
          label={`${coming} coming, ${awaitingPlaces} awaiting a reply, ${notInvitedPlaces} not invited yet, ${notComing} declined or not coming, of ${placesOnList} places`}
        />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] tabular-nums" aria-hidden>
        <Key swatch="bg-[var(--foreground)]" value={coming} label="coming" />
        <Key swatch="bg-[#a3a1a7]" value={awaitingPlaces} label="awaiting reply" />
        <Key swatch="bg-[#e7e5e8]" value={notInvitedPlaces} label="not invited yet" />
        {notComing > 0 ? <Key swatch="border border-[var(--border-strong)] bg-[var(--surface)]" value={notComing} label="declined or not coming" /> : null}
      </ul>
    </div>
  );
}

function Key({ swatch, value, label }: { swatch: string; value: number; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-[2px] ${swatch}`} />
      <span className="font-semibold">{value}</span>
      <span className="text-[var(--muted-text)]">{label}</span>
    </li>
  );
}
