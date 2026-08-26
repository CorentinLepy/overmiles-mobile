const foundation = {
  radius: {
    card: 24,
    control: 16,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 36,
    xxl: 56,
  },
} as const;

export const theme = {
  ...foundation,
  color: {
    canvas: "#F4EBDD",
    surface: "#FFFDF8",
    surfaceMuted: "#EDE4D8",
    ink: "#16211E",
    muted: "#68736F",
    accent: "#C86B3C",
    accentSoft: "#F3D8C8",
    success: "#2F745E",
    warning: "#A15B23",
    border: "#DDD2C2",
  },
} as const;

export const darkTheme = {
  ...foundation,
  color: {
    canvas: "#111A18",
    surface: "#182320",
    surfaceMuted: "#22302C",
    ink: "#F8F1E7",
    muted: "#AAB6B1",
    accent: "#E58B5B",
    accentSoft: "#493126",
    success: "#76B79F",
    warning: "#E0A36D",
    border: "#31423D",
  },
} as const;

export type OverMilesTheme = typeof theme | typeof darkTheme;
