// "Night Gym Instrument" tokens — mirrors client/src/index.css so the two
// apps stay visually identical. Color = domain: volt is workout/brand,
// food is amber, water is sky, body is violet.
export const colors = {
  bg: "#0B0C0E",
  surface: "#141518",
  raised: "#1C1E22",
  border: "#26282E",
  borderStrong: "#3A3D45",

  fg: "#F4F4F2",
  muted: "#9BA0AA",
  faint: "#5C6069",

  volt: "#C8F04B",
  onVolt: "#0B0C0E",
  food: "#F5A623",
  water: "#4CC3F7",
  body: "#C792EA",
  carbs: "#E8C170",
  fat: "#B07D3C",
  danger: "#F26D6D",
} as const;

export const fonts = {
  regular: "Archivo_400Regular",
  medium: "Archivo_500Medium",
  semibold: "Archivo_600SemiBold",
  bold: "Archivo_700Bold",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Locked radii: 16 cards, 10 controls, full pills.
export const radius = { card: 16, control: 10, pill: 999 } as const;

// Minimum touch target.
export const hit = 44;
