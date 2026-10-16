// Decorative province colours, never a fire severity or land-cover classification.
// All provinces use the same extrusion depth; no terrain elevation is implied.
const PALETTES = {
  sumatra: ["#8e8e8e", "#888888", "#939393", "#8e8e8e", "#a1a1a1"],
  borneo: ["#7f7f7f", "#8c8c8c", "#787878", "#a1a1a1", "#949494"],
  java: ["#b0b0b0", "#929292", "#b7b7b7", "#929292", "#a1a1a1"],
  sulawesi: ["#969696", "#969696", "#848484", "#aeaeae", "#8e8e8e"],
  east: ["#878787", "#a3a3a3", "#898989", "#9b9b9b", "#8a8a8a"],
};
export function provinceColour(name: string, code: string) {
  const palette = /Kalimantan/i.test(name)
    ? PALETTES.borneo
    : /Sulawesi|Gorontalo/i.test(name)
      ? PALETTES.sulawesi
      : /Jawa|Jakarta|Yogyakarta|Banten|Bali|Nusa Tenggara/i.test(name)
        ? PALETTES.java
        : /Papua|Maluku/i.test(name)
          ? PALETTES.east
          : PALETTES.sumatra;
  const index =
    [...code].reduce((sum, digit) => sum + Number(digit), 0) % palette.length;
  return palette[index];
}
