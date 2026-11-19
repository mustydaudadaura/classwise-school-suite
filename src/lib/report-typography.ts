import { REPORT_COLOURS, type ReportColour } from './report-template';

/** Fonts an administrator may pick for report cards. Web fonts are loaded in the root head. */
export const REPORT_FONTS = [
  { id: 'candara', name: 'Candara', css: "Candara, 'Optima', 'Segoe UI', Calibri, sans-serif" },
  { id: 'times', name: 'Times New Roman', css: "'Times New Roman', Times, 'Tinos', serif" },
  { id: 'arial', name: 'Arial', css: "Arial, Helvetica, 'Arimo', sans-serif" },
  { id: 'georgia', name: 'Georgia', css: "Georgia, 'Gelasio', serif" },
  { id: 'calibri', name: 'Calibri', css: "Calibri, 'Carlito', 'Segoe UI', sans-serif" },
  { id: 'cambria', name: 'Cambria', css: "Cambria, 'Caladea', Georgia, serif" },
  { id: 'montserrat', name: 'Montserrat', css: "'Montserrat', Arial, sans-serif" },
  { id: 'open_sans', name: 'Open Sans', css: "'Open Sans', Arial, sans-serif" },
  { id: 'lora', name: 'Lora', css: "'Lora', Georgia, serif" },
  { id: 'merriweather', name: 'Merriweather', css: "'Merriweather', Georgia, serif" },
  { id: 'playfair', name: 'Playfair Display', css: "'Playfair Display', Georgia, serif" },
  { id: 'roboto_slab', name: 'Roboto Slab', css: "'Roboto Slab', Georgia, serif" },
  { id: 'cinzel', name: 'Cinzel (classic capitals)', css: "'Cinzel', 'Times New Roman', serif" },
  { id: 'oswald', name: 'Oswald (tall bold)', css: "'Oswald', Arial, sans-serif" },
  { id: 'amiri', name: 'Amiri (Arabic)', css: "'Amiri', 'Noto Naskh Arabic', serif" },
] as const;
export type ReportFontId = typeof REPORT_FONTS[number]['id'];

/** Parts of the report card whose text style can be changed. */
export const TEXT_PARTS = {
  school_name: 'School name',
  school_details: 'Motto & address',
  report_title: 'Report title (e.g. First Term Report)',
  headings: 'Box & table headings',
  body: 'Body text (names, scores, remarks)',
} as const;
export type TextPart = keyof typeof TEXT_PARTS;

/** 'auto' follows the report colour palette; 'black' is plain ink. */
export type TextColour = 'auto' | 'black' | ReportColour;
export interface TextStyle { font: ReportFontId; size: number; colour: TextColour; bold: boolean; italic: boolean }
export type ReportTypography = Partial<Record<TextPart, Partial<TextStyle>>>;

export const SIZE_LIMITS = { min: 6, max: 36 } as const;

export const TEXT_DEFAULTS: Record<TextPart, TextStyle> = {
  school_name: { font: 'candara', size: 17, colour: 'auto', bold: true, italic: false },
  school_details: { font: 'candara', size: 11, colour: 'black', bold: false, italic: false },
  report_title: { font: 'candara', size: 13, colour: 'auto', bold: true, italic: false },
  headings: { font: 'candara', size: 11, colour: 'black', bold: true, italic: false },
  body: { font: 'candara', size: 11, colour: 'black', bold: false, italic: false },
};

/** Saved settings merged over defaults; anything invalid falls back to the default. */
export function resolveTypography(value: unknown): Record<TextPart, TextStyle> {
  const src = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  const out = {} as Record<TextPart, TextStyle>;
  (Object.keys(TEXT_DEFAULTS) as TextPart[]).forEach((part) => {
    const d = TEXT_DEFAULTS[part];
    const s = src[part] && typeof src[part] === 'object' ? src[part] : {};
    const size = Number(s.size);
    out[part] = {
      font: REPORT_FONTS.some((f) => f.id === s.font) ? s.font : d.font,
      size: Number.isFinite(size) && size >= SIZE_LIMITS.min && size <= SIZE_LIMITS.max ? size : d.size,
      colour: s.colour === 'auto' || s.colour === 'black' || REPORT_COLOURS.includes(s.colour) ? s.colour : d.colour,
      bold: typeof s.bold === 'boolean' ? s.bold : d.bold,
      italic: typeof s.italic === 'boolean' ? s.italic : d.italic,
    };
  });
  return out;
}

export function fontCss(id: ReportFontId): string {
  return REPORT_FONTS.find((f) => f.id === id)?.css ?? REPORT_FONTS[0].css;
}

/** CSS colour for a text style; `auto` uses the given palette colour. */
export function textColourCss(colour: TextColour, autoColour: string): string {
  return colour === 'auto' ? autoColour : colour === 'black' ? 'var(--report-ink)' : `var(--report-colour-${colour})`;
}

/** Web fonts for report cards, loaded only where a report card is shown. Includes free look-alikes for Times, Arial, Calibri, Cambria and Georgia on phones. */
export const REPORT_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Arimo:ital,wght@0,400;0,700;1,400&family=Caladea:ital,wght@0,400;0,700;1,400&family=Carlito:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700;900&family=Gelasio:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:ital,wght@0,400;0,700;0,900;1,400&family=Open+Sans:ital,wght@0,400;0,700;1,400&family=Oswald:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Roboto+Slab:wght@400;700;900&family=Tinos:ital,wght@0,400;0,700;1,400&display=swap';
