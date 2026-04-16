import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const indexCssPath = path.resolve(here, '../index.css')
const auditedFiles = [
  path.resolve(here, '../components/Layout.tsx'),
  path.resolve(here, '../components/ThemeSelector.tsx'),
  path.resolve(here, '../components/WithingsSyncPrompt.tsx'),
  path.resolve(here, '../pages/HelpCenter.tsx'),
]

function extractCssBlock(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
  if (!match) throw new Error(`Could not find CSS block for ${selector}`)
  return match[1]
}

function extractVariables(block: string) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  )
}

function parseHex(channel: string) {
  return Number.parseInt(channel, 16) / 255
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function parseColor(value: string) {
  const color = value.trim().toLowerCase()
  if (/^#[\da-f]{6}$/.test(color)) {
    return {
      r: parseHex(color.slice(1, 3)),
      g: parseHex(color.slice(3, 5)),
      b: parseHex(color.slice(5, 7)),
    }
  }
  throw new Error(`Unsupported color format: ${value}`)
}

function relativeLuminance(color: { r: number; g: number; b: number }) {
  const r = srgbToLinear(color.r)
  const g = srgbToLinear(color.g)
  const b = srgbToLinear(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground: string, background: string) {
  const fg = relativeLuminance(parseColor(foreground))
  const bg = relativeLuminance(parseColor(background))
  const lighter = Math.max(fg, bg)
  const darker = Math.min(fg, bg)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('shell accessibility audit', () => {
  it('keeps shell semantic token contrast above accessibility thresholds', () => {
    const css = fs.readFileSync(indexCssPath, 'utf8')
    const light = extractVariables(extractCssBlock(css, ':root'))
    const dark = extractVariables(extractCssBlock(css, 'html.dark'))

    expect(contrastRatio(light['shell-text-primary'], '#f8fafc')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light['shell-text-secondary'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light['shell-text-tertiary'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light['shell-text-placeholder'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light['shell-text-disabled'], light['shell-surface-disabled'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light['shell-active-text'], light['shell-active-surface'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light['shell-focus-ring'], light['shell-focus-offset'])).toBeGreaterThanOrEqual(3)

    expect(contrastRatio(dark['shell-text-primary'], '#020617')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark['shell-text-secondary'], '#020617')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark['shell-text-tertiary'], '#020617')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark['shell-text-placeholder'], '#020617')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark['shell-text-disabled'], dark['shell-surface-disabled'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark['shell-active-text'], dark['shell-active-surface'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(dark['shell-focus-ring'], dark['shell-focus-offset'])).toBeGreaterThanOrEqual(3)
  })

  it('does not use outline-none on audited shell and help controls', () => {
    for (const filePath of auditedFiles) {
      const source = fs.readFileSync(filePath, 'utf8')
      expect(source).not.toContain('outline-none')
      expect(source).toContain('shell-focus-ring')
    }
  })
})
