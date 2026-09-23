import type { Provinces } from "../types";

// Render shared administrative edges once. Province polygons are simplified;
// their coastline must not be presented as a precise satellite shoreline.
export function provinceBorders(boundaries: Provinces) {
  const edges = new Map<
    string,
    { coordinates: number[][]; provinces: Set<string> }
  >();
  for (const feature of boundaries.features) {
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const polygon of polygons)
      for (const ring of polygon) {
        for (let i = 1; i < ring.length; i++) {
          const a = ring[i - 1].slice(0, 2);
          const b = ring[i].slice(0, 2);
          const key = [
            a.map((n) => n.toFixed(6)).join(","),
            b.map((n) => n.toFixed(6)).join(","),
          ]
            .sort()
            .join("/");
          const edge = edges.get(key);
          if (edge) edge.provinces.add(feature.properties.PROVINSI);
          else
            edges.set(key, {
              coordinates: [a, b],
              provinces: new Set([feature.properties.PROVINSI]),
            });
        }
      }
  }
  return {
    type: "FeatureCollection" as const,
    features: [...edges.values()]
      .filter((edge) => edge.provinces.size > 1)
      .map((edge) => ({
        type: "Feature" as const,
        properties: {
          provinceA: [...edge.provinces].sort()[0],
          provinceB: [...edge.provinces].sort()[1],
        },
        geometry: {
          type: "LineString" as const,
          coordinates: edge.coordinates,
        },
      })),
  };
}
