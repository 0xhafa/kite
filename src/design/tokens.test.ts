import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { designTokens } from "./tokens";

const hexPattern = /^#[\da-f]{6}$/i;
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function toKebabCase(token: string): string {
  return token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function relativeLuminance(color: string): number {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );

  if (!channels || channels.length !== 3) {
    throw new Error(`Cor hexadecimal inválida: ${color}`);
  }

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

describe("designTokens", () => {
  it("define todos os grupos da fundação visual", () => {
    expect(Object.keys(designTokens.colors)).toEqual(
      expect.arrayContaining(["canvas", "surface", "ink", "brand", "focus", "danger"]),
    );
    expect(Object.keys(designTokens.typography.fontSize)).toEqual([
      "caption",
      "body",
      "lead",
      "title",
      "display",
    ]);
    expect(Object.keys(designTokens.spacing)).toEqual([
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "xxl",
      "touch",
    ]);
    expect(Object.keys(designTokens.radii)).toEqual(["sm", "md", "lg", "xl", "pill"]);
  });

  it("mantém cores em formato hexadecimal completo", () => {
    for (const color of Object.values(designTokens.colors)) {
      expect(color).toMatch(hexPattern);
    }
  });

  it("espelha cores, espaçamentos e raios no tema CSS", () => {
    for (const [token, value] of Object.entries(designTokens.colors)) {
      expect(globalStyles).toContain(`--color-${toKebabCase(token)}: ${value};`);
    }

    for (const [token, value] of Object.entries(designTokens.spacing)) {
      expect(globalStyles).toContain(`--spacing-${toKebabCase(token)}: ${value};`);
    }

    for (const [token, value] of Object.entries(designTokens.radii)) {
      expect(globalStyles).toContain(`--radius-${toKebabCase(token)}: ${value};`);
    }
  });

  it("mantém contraste de leitura para texto e ações principais", () => {
    expect(contrastRatio(designTokens.colors.ink, designTokens.colors.canvas)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrastRatio(designTokens.colors.muted, designTokens.colors.surface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(designTokens.colors.surface, designTokens.colors.ink),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(designTokens.colors.surface, designTokens.colors.brand),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("preserva um alvo de toque mínimo de 44 pixels", () => {
    expect(Number.parseFloat(designTokens.spacing.touch) * 16).toBeGreaterThanOrEqual(44);
  });
});
