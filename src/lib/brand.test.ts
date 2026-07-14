import { describe, expect, it } from "vitest";

import { brandAssets, getBrandAsset } from "./brand";

describe("catálogo de marca", () => {
  it("mantém todas as variações como arquivos SVG públicos", () => {
    expect(Object.keys(brandAssets)).toEqual([
      "principal",
      "vertical",
      "simbolo",
      "monocromatica",
    ]);

    for (const variant of Object.keys(brandAssets) as Array<keyof typeof brandAssets>) {
      expect(getBrandAsset(variant)).toMatch(/^\/brand\/[a-z-]+\.svg$/);
    }
  });
});
