/**
 * Runtime Element Plus primary-color switcher.
 *
 * ELP exposes the primary color as a CSS custom property
 * (`--el-color-primary`) plus a fixed set of derived shades
 * (`--el-color-primary-light-{3,5,7,9}` and
 * `--el-color-primary-dark-2`). Components don't read the raw
 * primary directly — they reference the shade variables in their
 * stylesheets. To live-swap the theme color we therefore have to
 * (a) set the primary, and (b) recompute every shade by linear-mixing
 * the primary toward white (lighter shades) or black (darker shade).
 *
 * The mixing formula matches ELP's own SCSS implementation 1:1:
 *
 *     light-N = mix(primary, white, weight = N * 10%)
 *     dark-N  = mix(primary, black, weight = N * 10%)
 *
 * where `weight` is the *amount of the secondary color* (white/black).
 * This keeps the visual identity of the official ELP themes —
 * components designed for ELP just work without per-component overrides.
 *
 * # Vercel Style
 *
 * Default theme is minimal black/white. The color system is kept for
 * potential future customization but defaults to neutral tones.
 */

/** Default primary color — neutral black for Vercel minimal style */
export const DEFAULT_PRIMARY_COLOR = '#000000'

/**
 * Case-insensitive alias table from legacy WPF Settings-page named
 * colors to the default neutral color.
 */
const WPF_NAMED_COLOR_ALIASES: Record<string, string> = {
  white: '#000000',
  black: '#000000',
  lightblue: '#000000',
  pink: '#000000',
  gold: '#000000',
  silver: '#000000',
}

/**
 * Translate a stored ThemeColor string into a form
 * [`parseHexColor`] can consume.
 *
 * Handles:
 *
 * - hex strings (with or without `#`, 3 or 6 digits) — returned as
 *   is; downstream [`parseHexColor`] does the actual validation.
 * - WPF legacy named colors — returned as the default neutral color.
 *   Case-insensitive, leading / trailing whitespace tolerated
 *   (mirrors WPF's `ColorConverter` which trims).
 *
 * Unknown strings fall through unchanged so
 * [`parseHexColor`]'s `RangeError` surfaces the bad value to
 * callers (which already wrap it in a try/catch + log +
 * default-fallback, see `stores/ui.ts::applyAll`).
 */
export function resolvePrimaryColor(stored: string): string {
  const key = stored.trim().toLowerCase()
  return WPF_NAMED_COLOR_ALIASES[key] ?? stored
}

/**
 * ELP shade definitions: each tuple is
 * `[cssVarSuffix, mixWeight, mixTarget]` where `mixWeight` is the
 * weight of `mixTarget` (i.e. how much white or black to add).
 *
 * The list intentionally mirrors ELP's `dark-2`, `light-3`, …,
 * `light-9` naming so a future ELP minor version that introduces
 * additional shades only requires adding entries here.
 */
const ELP_SHADES = [
  ['dark-2', 0.2, '#000000'],
  ['light-3', 0.3, '#ffffff'],
  ['light-5', 0.5, '#ffffff'],
  ['light-7', 0.7, '#ffffff'],
  ['light-8', 0.8, '#ffffff'],
  ['light-9', 0.9, '#ffffff'],
] as const

/**
 * Parse a 3- or 6-digit hex color into an `[r, g, b]` triple.
 *
 * @throws {RangeError} when `hex` is not a valid 3/6-digit hex string.
 */
export function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, '').toLowerCase()
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  if (!/^[0-9a-f]{6}$/.test(expanded)) {
    throw new RangeError(`invalid hex color: ${hex}`)
  }
  const num = parseInt(expanded, 16)
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
}

const toHexComponent = (n: number): string =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0')

/**
 * Linear-mix two hex colors and return the result as a 6-digit
 * hex string with a leading `#`. `weight` is the proportion of
 * `mixWith` (0 = pure base, 1 = pure mixWith). Out-of-range
 * weights are clamped to `[0, 1]`.
 *
 * Matches ELP's `mix($base, $mixWith, $weight)` SCSS function
 * verbatim (linear RGB; no gamma correction — accepted simplification
 * because the WPF original also doesn't gamma-correct).
 */
export function mixHexColor(base: string, mixWith: string, weight: number): string {
  const w = Math.max(0, Math.min(1, weight))
  const [br, bg, bb] = parseHexColor(base)
  const [mr, mg, mb] = parseHexColor(mixWith)
  const r = br * (1 - w) + mr * w
  const g = bg * (1 - w) + mg * w
  const b = bb * (1 - w) + mb * w
  return `#${toHexComponent(r)}${toHexComponent(g)}${toHexComponent(b)}`
}

/**
 * Apply `primaryHex` as the document's primary color, recomputing
 * every ELP shade.
 *
 * @param primaryHex — 3- or 6-digit hex (with or without `#`), OR
 *   a legacy WPF Settings named color (see
 *   [`WPF_NAMED_COLOR_ALIASES`]). The legacy strings route through
 *   [`resolvePrimaryColor`] before hex parsing so a `Config.xml`
 *   written by the old WPF client (e.g. `<ThemeColor>LightBlue`)
 *   boots cleanly into the matching P11 preset instead of crashing
 *   on the first frame.
 * @param target — optional override for the element receiving the
 *   custom properties; defaults to `document.documentElement`. The
 *   override exists so vitest can pass a fresh `HTMLElement` per
 *   test (jsdom shares `document.documentElement` across all `it`
 *   blocks in the same file).
 *
 * @throws {RangeError} when `primaryHex` is neither a valid
 *   3/6-digit hex nor a known WPF named-color alias.
 */
export function setPrimaryColor(primaryHex: string, target?: HTMLElement): void {
  const root = target ?? document.documentElement
  const resolved = resolvePrimaryColor(primaryHex)
  const normalized = `#${parseHexColor(resolved).map(toHexComponent).join('')}`

  root.style.setProperty('--el-color-primary', normalized)
  for (const [suffix, weight, mixWith] of ELP_SHADES) {
    root.style.setProperty(`--el-color-primary-${suffix}`, mixHexColor(normalized, mixWith, weight))
  }
}

/**
 * Composable handle for components that want the setter
 * without re-importing the module-level helpers.
 *
 * No reactivity is created — the current color is read from the
 * computed CSS custom property whenever `getCurrentPrimary` is
 * called, which keeps this composable safe to call outside a
 * component lifecycle (e.g. during boot before `setup()` runs).
 */
export function useThemeColor() {
  return {
    defaultPrimary: DEFAULT_PRIMARY_COLOR,
    setPrimaryColor,
    /**
     * Returns the currently-applied primary as the document sees it,
     * trimmed of any whitespace.
     */
    getCurrentPrimary(target?: HTMLElement): string {
      const root = target ?? document.documentElement
      return getComputedStyle(root).getPropertyValue('--el-color-primary').trim()
    },
  }
}
