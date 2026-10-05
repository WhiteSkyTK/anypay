import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEME_COLORS, THEME_STORAGE_KEY } from '../lib/theme'

type Tokens = Record<string, string>

// Read from disk: Vitest stubs every .css import (even ?raw) to an empty string.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const tokensCss = read('./tokens.css')
const indexHtml = read('../../index.html')

/** Colour tokens in one block, e.g. `--primary: #1f4d3a;` → { primary: '#1f4d3a' }. */
function readTokens(selector: ':root' | '.dark'): Tokens {
  const start = tokensCss.indexOf(`${selector} {`)
  const block = tokensCss.slice(start, tokensCss.indexOf('}', start))
  // One declaration per line (Prettier keeps it that way), so comments can't confuse parsing.
  const entries = block
    .split('\n')
    .map((line) => line.trim().replace(/;$/, '').split(':'))
    .filter(([name, value]) => name?.startsWith('--') && value?.trim().startsWith('#'))
    .map(([name = '', value = '']) => [name.slice(2), value.trim()])
  return Object.fromEntries(entries)
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

// [foreground, background]: every text colour on every surface it is used on.
const TEXT_PAIRS = [
  ['foreground', 'background'],
  ['foreground', 'muted'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['primary-foreground', 'primary'],
  ['background', 'foreground'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['destructive-foreground', 'destructive'],
  ['warn', 'background'],
  ['warn', 'card'],
  ['warn-foreground', 'warn'],
] as const

// WCAG 1.4.11: form field outlines and focus rings need 3:1 against what they sit on.
const UI_PAIRS = [
  ['input', 'background'],
  ['input', 'card'],
  ['input', 'muted'],
  ['ring', 'background'],
  ['ring', 'card'],
] as const

const themes = { light: readTokens(':root'), dark: readTokens('.dark') }

describe.each(Object.entries(themes))('%s theme', (_name, tokens) => {
  it('defines every colour token', () => {
    expect(Object.keys(tokens).length).toBeGreaterThanOrEqual(21)
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(themes.light).sort())
  })

  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(tokens[fg] ?? '', tokens[bg] ?? '')).toBeGreaterThanOrEqual(4.5)
  })

  it.each(UI_PAIRS)('%s on %s is at least 3:1', (fg, bg) => {
    expect(contrast(tokens[fg] ?? '', tokens[bg] ?? '')).toBeGreaterThanOrEqual(3)
  })
})

describe('first-paint theme script', () => {
  it('uses the same colours as the tokens', () => {
    expect(THEME_COLORS.light).toBe(themes.light.background)
    expect(THEME_COLORS.dark).toBe(themes.dark.background)
  })

  it('reads the same storage key and colours as src/lib/theme.ts', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`)
    expect(indexHtml).toContain(`'${THEME_COLORS.light}'`)
    expect(indexHtml).toContain(`'${THEME_COLORS.dark}'`)
  })
})
