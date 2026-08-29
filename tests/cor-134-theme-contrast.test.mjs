import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tokens = await readFile(new URL("../src/theme/tokens.ts", import.meta.url), "utf8");

function extractColors(exportName) {
  const exportStart = tokens.indexOf(`export const ${exportName} = {`);
  assert.notEqual(exportStart, -1, `missing ${exportName} theme export`);

  const exportEnd = tokens.indexOf("\n} as const;", exportStart);
  assert.notEqual(exportEnd, -1, `missing ${exportName} theme terminator`);

  const block = tokens.slice(exportStart, exportEnd);
  const colorStart = block.indexOf("color: {");
  assert.notEqual(colorStart, -1, `missing ${exportName}.color block`);

  const colorEnd = block.indexOf("\n  },", colorStart);
  assert.notEqual(colorEnd, -1, `missing ${exportName}.color terminator`);

  const colors = Object.fromEntries(
    [...block.slice(colorStart, colorEnd).matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)].map(
      ([, name, value]) => [name, value],
    ),
  );

  return colors;
}

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.slice(1);
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    channelToLinear(Number.parseInt(value.slice(offset, offset + 2), 16)),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

for (const exportName of ["theme", "darkTheme"]) {
  test(`${exportName} semantic text colors meet WCAG AA contrast on app surfaces`, () => {
    const colors = extractColors(exportName);
    const foregrounds = ["ink", "muted", "accent", "success", "warning"];
    const backgrounds = ["canvas", "surface", "surfaceMuted", "accentSoft"];

    for (const foreground of foregrounds) {
      for (const background of backgrounds) {
        const ratio = contrastRatio(colors[foreground], colors[background]);
        assert.ok(
          ratio >= 4.5,
          `${exportName}: ${foreground} on ${background} has contrast ${ratio.toFixed(2)} (< 4.5)`,
        );
      }
    }
  });
}
