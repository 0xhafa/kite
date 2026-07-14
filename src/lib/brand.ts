export const brandAssets = {
  principal: "/brand/kite-logo-horizontal.svg",
  vertical: "/brand/kite-logo-stacked.svg",
  simbolo: "/brand/kite-symbol.svg",
  monocromatica: "/brand/kite-logo-monochrome.svg",
} as const;

export type BrandVariant = keyof typeof brandAssets;

export function getBrandAsset(variant: BrandVariant): string {
  return brandAssets[variant];
}
