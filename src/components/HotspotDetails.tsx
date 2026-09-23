import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Activity, Hotspot } from "../types";
export default function HotspotDetails({ record, onClose }: { record: Hotspot; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); }, [record.id]);
  const activity = record as Partial<Activity>;
  const members = activity.members ?? [record];
  return <section className="observation-details" role="region" aria-label="Observation details" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
    <header><div><small>{record.isDemo ? "DEMO OBSERVATION" : "IMPORTED OBSERVATION"}</small><h3>{record.province}</h3></div><button ref={close} onClick={onClose} aria-label="Close observation details"><X size={18} /></button></header>
    <p>{members.length > 1 ? "Matched MODIS + VIIRS observations" : `${record.source} observation`} · {record.confidence} confidence</p>
    <p>{record.latitude.toFixed(5)}°, {record.longitude.toFixed(5)}°</p>
    {activity.matchMinutes !== undefined && <p className="observation-match">Pair separation: {activity.matchDistanceKm?.toFixed(3)} km / {activity.matchMinutes.toFixed(0)} min. Region and period follow the earlier observation.</p>}
    {members.map(member => <dl key={member.id}>
      <dt>Sensor / satellite</dt><dd>{member.source} / {member.satellite ?? "Not supplied"}</dd>
      <dt>Acquired (UTC)</dt><dd>{member.date.replace("T", " ").replace(".000Z", " UTC")}</dd>
      <dt>Native confidence</dt><dd>{member.nativeConfidence} ({member.confidence})</dd>
      <dt>Location</dt><dd>{member.latitude.toFixed(5)}, {member.longitude.toFixed(5)} · {member.province}</dd>
      <dt>Brightness</dt><dd>{member.brightness === undefined ? "Not supplied" : `${member.brightness} K (${member.source === "VIIRS" ? "I4" : "21/22"})`}</dd>
      <dt>FRP</dt><dd>{member.frp === undefined ? "Not supplied" : `${member.frp} MW`}</dd>
      <dt>Source</dt><dd>{member.provenance ? `${member.provenance.file}, row ${member.provenance.row}` : "Synthetic demo generator"}{member.version ? ` · ${member.version}` : ""}</dd>
    </dl>)}
    <p className="helper">A detection is not a fire incident. Flame size does not measure severity or burned area.</p>
  </section>;
}
