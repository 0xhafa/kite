export type HexColor = `#${string}`;

type FontScale = Readonly<{
  size: `${number}rem`;
  lineHeight: `${number}`;
}>;

export type DesignTokens = Readonly<{
  colors: Readonly<Record<string, HexColor>>;
  typography: Readonly<{
    fontFamily: readonly string[];
    fontSize: Readonly<Record<string, FontScale>>;
    fontWeight: Readonly<Record<string, number>>;
  }>;
  spacing: Readonly<Record<string, `${number}rem`>>;
  radii: Readonly<Record<string, `${number}rem` | "9999px">>;
}>;

export const designTokens = {
  colors: {
    canvas: "#fffdf8",
    surface: "#ffffff",
    ink: "#28334a",
    inkStrong: "#202a3f",
    muted: "#5e6a80",
    border: "#dfe5ef",
    neutralSoft: "#edf3fb",
    track: "#e8edf4",
    brand: "#187b68",
    brandStrong: "#105b4d",
    brandSoft: "#dff7ef",
    brandSoftStrong: "#c8ecdf",
    accent: "#c94d49",
    accentSoft: "#ffe4df",
    focus: "#176fa6",
    success: "#187b68",
    successSoft: "#dff7ef",
    warning: "#805c08",
    warningSoft: "#fff3c8",
    danger: "#b43c42",
    dangerStrong: "#963239",
    dangerDeep: "#7f2930",
    dangerSoft: "#ffe4e6",
    info: "#246b9e",
    infoSoft: "#e2f1fb",
  },
  typography: {
    fontFamily: [
      "Arial Rounded MT Bold",
      "ui-rounded",
      "Trebuchet MS",
      "system-ui",
      "sans-serif",
    ],
    fontSize: {
      caption: { size: "0.75rem", lineHeight: "1.5" },
      body: { size: "1rem", lineHeight: "1.6" },
      lead: { size: "1.125rem", lineHeight: "1.55" },
      title: { size: "2rem", lineHeight: "1.15" },
      display: { size: "3rem", lineHeight: "1.05" },
    },
    fontWeight: {
      medium: 500,
      bold: 700,
      extraBold: 800,
      black: 900,
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    xxl: "3rem",
    touch: "2.75rem",
  },
  radii: {
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    pill: "9999px",
  },
} as const satisfies DesignTokens;

export type ColorToken = keyof typeof designTokens.colors;
export type SpacingToken = keyof typeof designTokens.spacing;
export type RadiusToken = keyof typeof designTokens.radii;
