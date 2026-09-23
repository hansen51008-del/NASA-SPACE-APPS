import type { Hotspot, Provinces, Sensor } from "../types";
import { containsPoint, normalizeFirmsRow } from "./nasaDataService";

export interface ImportReport {
  records: Hotspot[];
  files: string[];
  read: number;
  duplicates: number;
  outside: number;
  rejected: number;
  issues: { file: string; row: number; reason: string }[];
}
// RFC-style quoted fields, escaped quotes, CRLF and a UTF-8 BOM. Never evaluate
// cells or trust province labels supplied by the file.
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i+1] === '"') { value += '"'; i++; }
      else if (quoted || value === "") quoted = !quoted;
      else throw new Error("Unexpected quote in CSV");
    } else if (c === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i+1] === "\n") i++;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += c;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field");
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function importFirms(files: { name: string; text: string }[], boundaries: Provinces): ImportReport {
  const report: ImportReport = { records: [], files: files.map(f => f.name), read: 0, duplicates: 0, outside: 0, rejected: 0, issues: [] };
  const seen = new Set<string>();
  const areas = boundaries.features.map(feature => {
    const points = feature.geometry.type === "Polygon" ? feature.geometry.coordinates.flat() : feature.geometry.coordinates.flat(2);
    return { feature, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
  });
  for (const file of files) {
    const rows = csvRows(file.text), header = rows.shift()?.map(h => h.toLowerCase()) ?? [];
    for (const required of ["latitude", "longitude", "acq_date", "acq_time", "confidence"]) {
      if (!header.includes(required)) throw new Error(`${file.name}: missing ${required}`);
    }
    if (new Set(header).size !== header.length) throw new Error(`${file.name}: duplicate CSV columns`);
    rows.forEach((cells, index) => {
      report.read++;
      try {
        if (cells.length !== header.length) throw new Error("Wrong number of CSV fields");
        const row = Object.fromEntries(header.map((key, i) => [key, cells[i]]));
        const instrument = row.instrument?.toUpperCase();
        const source: Sensor = instrument === "MODIS" || instrument === "VIIRS" ? instrument : header.includes("bright_ti4") ? "VIIRS" : header.includes("brightness") ? "MODIS" : (() => { throw new Error("Cannot identify MODIS or VIIRS"); })();
        if (instrument && !["MODIS", "VIIRS"].includes(instrument)) throw new Error("Unsupported instrument");
        const optionalNumber = (key: string) => {
          if (!row[key]) return undefined;
          const value = Number(row[key]);
          if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${key}`);
          return value;
        };
        const record = normalizeFirmsRow({ latitude: row.latitude, longitude: row.longitude, acq_date: row.acq_date, acq_time: row.acq_time, confidence: row.confidence, brightness: optionalNumber("brightness"), bright_ti4: optionalNumber("bright_ti4") }, source, "", "");
        const area = areas.find(a => record.longitude >= a.minX && record.longitude <= a.maxX && record.latitude >= a.minY && record.latitude <= a.maxY && containsPoint(a.feature, [record.longitude, record.latitude]));
        if (!area) { report.outside++; return; }
        record.province = area.feature.properties.PROVINSI;
        record.satellite = row.satellite || undefined;
        record.version = row.version || undefined;
        record.frp = optionalNumber("frp");
        const key = [source, record.satellite ?? "", record.version ?? "", record.date, record.latitude, record.longitude, record.nativeConfidence, record.brightness ?? "", record.frp ?? ""].join("|");
        if (seen.has(key)) { report.duplicates++; return; }
        seen.add(key);
        record.id = `firms-${report.records.length + 1}`;
        record.provenance = { file: file.name, row: index + 2 };
        report.records.push(record);
      } catch (error) {
        report.rejected++;
        if (report.issues.length < 100) report.issues.push({ file: file.name, row: index + 2, reason: error instanceof Error ? error.message : "Invalid row" });
      }
    });
  }
  return report;
}
