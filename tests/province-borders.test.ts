import { expect, it } from "vitest";
import { provinceBorders } from "../src/components/provinceBorders";
import type { Provinces } from "../src/types";

it("draws a shared boundary once, excluding coastlines and detached islands", () => {
  const boundaries: Provinces = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { PROVINSI: "West", KODE_PROV: "1" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { PROVINSI: "East", KODE_PROV: "2" },
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [1, 1],
                [1, 0],
                [2, 0],
                [2, 1],
                [1, 1],
              ],
            ],
            [
              [
                [4, 0],
                [5, 0],
                [5, 1],
                [4, 1],
                [4, 0],
              ],
            ],
          ],
        },
      },
    ],
  };
  const original = structuredClone(boundaries);
  const borders = provinceBorders(boundaries);
  expect(borders.features).toHaveLength(1);
  expect(borders.features[0].properties).toEqual({
    provinceA: "East",
    provinceB: "West",
  });
  expect(borders.features[0].geometry.coordinates).toEqual([
    [1, 0],
    [1, 1],
  ]);
  expect(boundaries).toEqual(original);
});
