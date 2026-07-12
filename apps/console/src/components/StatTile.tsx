import type { ReactNode } from "react";
import { Tile } from "@carbon/react";

// The one stat-card pattern used everywhere (landing proof, queue, outcomes):
// a soft-tinted icon badge, a large value, an uppercase label, an optional note.

interface StatTileProps {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  note?: ReactNode;
  alert?: boolean;
}

export default function StatTile({ icon, value, label, note, alert }: StatTileProps) {
  return (
    <Tile className={`adp-stat${alert ? " adp-stat--alert" : ""}`}>
      <span className="adp-stat__badge" aria-hidden="true">{icon}</span>
      <div className="adp-stat__value">{value}</div>
      <div className="adp-stat__label">{label}</div>
      {note !== undefined && <div className="adp-stat__note">{note}</div>}
    </Tile>
  );
}
