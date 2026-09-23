import type { Activity, Hotspot, Layer } from "../types";
export const MATCH_KM = 1;
export const MATCH_MINUTES = 60;
export function distanceKm(
  a: Pick<Hotspot, "latitude" | "longitude">,
  b: Pick<Hotspot, "latitude" | "longitude">,
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
// Greedy, deterministic, one-to-one cross-sensor matching. Same-sensor records stay distinct.
// Anchor coordinates/time are preserved, avoiding transitive merging across a long fire front.
export function harmonize(records: Hotspot[]): Activity[] {
  const result: Activity[] = [];
  const buckets = new Map<string, Activity[]>();
  const sorted = [...records].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  for (const record of sorted) {
    const time = Date.parse(record.date);
    const hour = Math.floor(time / 3600000);
    // Search neighbouring spatial cells, including both sides of province
    // borders. Administrative assignment must not determine a physical match.
    const latCell = Math.floor(record.latitude / 0.02);
    const lonCell = Math.floor(record.longitude / 0.02);
    let match: Activity | undefined;
    let closest = Infinity;
    for (let offset = -1; offset <= 1; offset++) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const candidate of buckets.get(
        `${hour + offset}:${latCell + dy}:${lonCell + dx}`,
      ) ?? []) {
        if (
          candidate.sources.includes(record.source) ||
          Math.abs(Date.parse(candidate.date) - time) > MATCH_MINUTES * 60000
        )
          continue;
        const distance = distanceKm(candidate, record);
        if (distance <= MATCH_KM && distance < closest) {
          match = candidate;
          closest = distance;
        }
      }
      }
    }
    if (match) {
      match.memberIds.push(record.id);
      match.sources.push(record.source);
      match.members.push(record);
      match.matchDistanceKm = closest;
      match.matchMinutes = Math.abs(Date.parse(match.date) - time) / 60000;
      const rank = { low: 0, nominal: 1, high: 2 };
      if (rank[record.confidence] > rank[match.confidence])
        match.confidence = record.confidence;
    } else {
      const activity: Activity = {
        ...record,
        memberIds: [record.id],
        sources: [record.source],
        members: [record],
      };
      result.push(activity);
      const key = `${hour}:${latCell}:${lonCell}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(activity);
      buckets.set(key, bucket);
    }
  }
  return result;
}
export function layerRecords(records: Hotspot[], layer: Layer): Hotspot[] {
  return layer === "Harmonized"
    ? harmonize(records)
    : records.filter((r) => r.source === layer);
}
// Spatial occupancy, not an incident count: a fixed ~5.5 km latitude/longitude grid.
export function largestCell(records: Hotspot[]) {
  const cells = new Map<string, number>();
  for (const r of records) {
    const key = `${Math.floor(r.latitude / 0.05)}:${Math.floor(r.longitude / 0.05)}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...cells.values());
}
