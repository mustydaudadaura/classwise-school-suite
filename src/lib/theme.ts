export interface AppTheme {
  id: string;
  name: string;
  tagline: string;
  description: string;
  inspiration: string;
  primaryColor: string; // hex or oklch for preview
  accentColor: string;
  sidebarColor: string;
  badgeText: string;
  previewBg: string;
}

export type PredefinedThemeId = "default" | "emerald" | "sapphire" | "amber" | "amethyst";

export interface ThemeOption {
  id: PredefinedThemeId;
  name: string;
  tagline: string;
  description: string;
  inspiration: string;
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
  badgeText: string;
  previewBg: string;
}

export const PREDEFINED_THEMES: ThemeOption[] = [
  {
    id: "default",
    name: "Alegacy Navy & Blue",
    tagline: "Alegacy Technologies Signature",
    description: "Deep navy and electric blue from the Alegacy Technologies logo. Trusted, modern and digital.",
    inspiration: "Build · Innovate · Transform",
    primaryColor: "oklch(0.5 0.19 258)",
    accentColor: "oklch(0.66 0.16 238)",
    sidebarColor: "oklch(0.24 0.09 263)",
    badgeText: "Default",
    previewBg: "linear-gradient(135deg, #0b2a5c 0%, #1f6fe0 55%, #18a7f0 100%)",
  },
  {
    id: "emerald",
    name: "Emerald Green & Gold",
    tagline: "Heritage & National Prestige",
    description: "Prestigious Nigerian emerald green paired with deep forest night and warm heritage accents.",
    inspiration: "Federal & State Unity Schools & Botanical Serenity",
    primaryColor: "oklch(0.47 0.18 155)",
    accentColor: "oklch(0.65 0.17 140)",
    sidebarColor: "oklch(0.16 0.05 155)",
    badgeText: "Prestige",
    previewBg: "linear-gradient(135deg, #0d3824 0%, #157948 60%, #eab308 100%)",
  },
  {
    id: "sapphire",
    name: "Sapphire & Oxford Blue",
    tagline: "Academic Collegiate",
    description: "Deep oceanic navy and vivid sapphire cobalt. Crisp, focused, authoritative and ivy-league.",
    inspiration: "Collegiate excellence, STEM & Mathematical clarity",
    primaryColor: "oklch(0.46 0.21 255)",
    accentColor: "oklch(0.58 0.19 240)",
    sidebarColor: "oklch(0.15 0.06 260)",
    badgeText: "Scholastic",
    previewBg: "linear-gradient(135deg, #0a1f44 0%, #1d4ed8 60%, #38bdf8 100%)",
  },
  {
    id: "amber",
    name: "Warm Amber & Bronze",
    tagline: "Saharan Sun & Earth Heritage",
    description: "Warm golden ochre, desert bronze, and rich espresso. Welcoming, grounded, and celebratory.",
    inspiration: "Ancient Kano City walls & Golden graduation medals",
    primaryColor: "oklch(0.55 0.18 55)",
    accentColor: "oklch(0.65 0.19 65)",
    sidebarColor: "oklch(0.17 0.04 55)",
    badgeText: "Heritage",
    previewBg: "linear-gradient(135deg, #3d2314 0%, #b45309 60%, #f59e0b 100%)",
  },
  {
    id: "amethyst",
    name: "Imperial Amethyst & Slate",
    tagline: "Distinguished Intellect",
    description: "Regal amethyst purple with obsidian slate framing. Creative, distinguished, and visionary.",
    inspiration: "High-table academia & Modern artistic distinction",
    primaryColor: "oklch(0.48 0.22 300)",
    accentColor: "oklch(0.62 0.22 305)",
    sidebarColor: "oklch(0.16 0.06 300)",
    badgeText: "Majestic",
    previewBg: "linear-gradient(135deg, #271038 0%, #7e22ce 60%, #c084fc 100%)",
  },
];

export const APP_THEMES: AppTheme[] = [
  {
    id: "royal",
    name: "Alegacy Navy & Blue",
    tagline: "Alegacy Technologies Signature",
    description: "Deep navy and electric blue from the Alegacy Technologies logo. Trusted, modern and digital.",
    inspiration: "Build · Innovate · Transform",
    primaryColor: "oklch(0.5 0.19 258)",
    accentColor: "oklch(0.66 0.16 238)",
    sidebarColor: "oklch(0.24 0.09 263)",
    badgeText: "Default",
    previewBg: "linear-gradient(135deg, #0b2a5c 0%, #1f6fe0 55%, #18a7f0 100%)",
  },
  {
    id: "emerald",
    name: "Emerald Green & Gold",
    tagline: "Heritage & National Prestige",
    description: "Prestigious Nigerian emerald green paired with deep forest night and warm heritage accents.",
    inspiration: "Federal & State Unity Schools & Botanical Serenity",
    primaryColor: "oklch(0.47 0.18 155)",
    accentColor: "oklch(0.65 0.17 140)",
    sidebarColor: "oklch(0.16 0.05 155)",
    badgeText: "Prestige",
    previewBg: "linear-gradient(135deg, #0d3824 0%, #157948 60%, #eab308 100%)",
  },
  {
    id: "sapphire",
    name: "Sapphire & Oxford Blue",
    tagline: "Academic Collegiate",
    description: "Deep oceanic navy and vivid sapphire cobalt. Crisp, focused, authoritative and ivy-league.",
    inspiration: "Collegiate excellence, STEM & Mathematical clarity",
    primaryColor: "oklch(0.46 0.21 255)",
    accentColor: "oklch(0.58 0.19 240)",
    sidebarColor: "oklch(0.15 0.06 260)",
    badgeText: "Scholastic",
    previewBg: "linear-gradient(135deg, #0a1f44 0%, #1d4ed8 60%, #38bdf8 100%)",
  },
  {
    id: "amber",
    name: "Warm Amber & Bronze",
    tagline: "Saharan Sun & Earth Heritage",
    description: "Warm golden ochre, desert bronze, and rich espresso. Welcoming, grounded, and celebratory.",
    inspiration: "Ancient Kano City walls & Golden graduation medals",
    primaryColor: "oklch(0.55 0.18 55)",
    accentColor: "oklch(0.65 0.19 65)",
    sidebarColor: "oklch(0.17 0.04 55)",
    badgeText: "Heritage",
    previewBg: "linear-gradient(135deg, #3d2314 0%, #b45309 60%, #f59e0b 100%)",
  },
  {
    id: "amethyst",
    name: "Imperial Amethyst & Slate",
    tagline: "Distinguished Intellect",
    description: "Regal amethyst purple with obsidian slate framing. Creative, distinguished, and visionary.",
    inspiration: "High-table academia & Modern artistic distinction",
    primaryColor: "oklch(0.48 0.22 300)",
    accentColor: "oklch(0.62 0.22 305)",
    sidebarColor: "oklch(0.16 0.06 300)",
    badgeText: "Majestic",
    previewBg: "linear-gradient(135deg, #271038 0%, #7e22ce 60%, #c084fc 100%)",
  },
];

export const THEME_STORAGE_KEY = "eduerp_app_theme";

/**
 * Apply the theme to the HTML document element using data-theme attribute
 */
export function applyAppTheme(themeName: string) {
  if (typeof document === "undefined") return;
  // If 'default' is requested, set data-theme='default'; otherwise validate against APP_THEMES
  const targetTheme =
    themeName === "default"
      ? "default"
      : APP_THEMES.find((t) => t.id === themeName)?.id || "royal";

  document.documentElement.setAttribute("data-theme", targetTheme);
  window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme: targetTheme } }));
}

/**
 * Retrieve the active stored theme for the school
 */
export function getStoredTheme(schoolTheme?: string | null): string {
  if (schoolTheme && (schoolTheme === "default" || APP_THEMES.some((t) => t.id === schoolTheme))) {
    return schoolTheme;
  }
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(THEME_STORAGE_KEY);
    if (local && (local === "default" || APP_THEMES.some((t) => t.id === local))) {
      return local;
    }
  }
  return "royal";
}

/**
 * Store the active theme in localStorage and dispatch update
 */
export function setStoredTheme(themeId: string) {
  const valid = themeId === "default" || APP_THEMES.some((t) => t.id === themeId) ? themeId : "royal";
  if (typeof window !== "undefined") {
    localStorage.setItem(THEME_STORAGE_KEY, valid);
  }
  applyAppTheme(valid);
}
