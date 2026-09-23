// Decorative province colours, never a fire severity or land-cover classification.
// All provinces use the same extrusion depth; no terrain elevation is implied.
const PALETTES = {
  sumatra: ["#769776", "#5e9489", "#819d68", "#639b8e", "#96a783"],
  borneo: ["#588c70", "#769765", "#478775", "#8aab7d", "#68a28f"],
  java: ["#a3b78e", "#789b81", "#b0bc94", "#6d9d95", "#92aa77"],
  sulawesi: ["#69a29e", "#829d89", "#50938b", "#a0b49d", "#6c969f"],
  east: ["#74906b", "#96ab7e", "#57988b", "#7da49e", "#718f9c"],
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
