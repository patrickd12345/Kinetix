import type { VerifiedFactContract } from './types'

const COMPOSITE_NUMERIC_RE =
  /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*\/\s*(?:km|mi|mile|miles))?\b|\b\d+(?:\.\d+)?%?\b/gi
const UNIT_RE =
  /\/\s*(?:km|mi|mile|miles)\b|\b(?:km|mi|mile|miles|bpm|spm|kg|lb|lbs|m|meter|meters|sec|secs|second|seconds|min|mins|minute|minutes)\b|%/gi

export interface TrustedValueTokens {
  numeric: string[]
  units: string[]
}

export function normalizeNumericToken(token: string): string {
  const trimmed = token.trim().toLowerCase().replace(/\s+/g, '')
  if (!trimmed) return ''

  if (trimmed.includes(':')) {
    return trimmed.replace(/miles?/g, 'mi')
  }

  const suffix = trimmed.endsWith('%') ? '%' : ''
  const raw = suffix ? trimmed.slice(0, -1) : trimmed
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return trimmed
  }
  return `${parsed}${suffix}`
}

export function normalizeUnitToken(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/miles?/g, 'mi')
    .replace(/meters?/g, 'm')
    .replace(/seconds?/g, 'sec')
    .replace(/secs/g, 'sec')
    .replace(/minutes?/g, 'min')
    .replace(/mins/g, 'min')
    .replace(/lbs/g, 'lb')
}

export function extractNumericTokensFromText(text: string): string[] {
  const found = text.match(COMPOSITE_NUMERIC_RE) ?? []
  return [...new Set(found.map(normalizeNumericToken).filter(Boolean))]
}

export function extractUnitTokensFromText(text: string): string[] {
  const found = text.match(UNIT_RE) ?? []
  return [...new Set(found.map(normalizeUnitToken).filter(Boolean))]
}

function appendTokens(target: Set<string>, values: string[]): void {
  for (const value of values) {
    if (value) target.add(value)
  }
}

export function collectTrustedValueTokens(value: unknown): TrustedValueTokens {
  const numeric = new Set<string>()
  const units = new Set<string>()

  const visit = (input: unknown): void => {
    if (input == null) return

    if (typeof input === 'number') {
      if (Number.isFinite(input)) numeric.add(normalizeNumericToken(String(input)))
      return
    }

    if (typeof input === 'string') {
      appendTokens(numeric, extractNumericTokensFromText(input))
      appendTokens(units, extractUnitTokensFromText(input))
      return
    }

    if (typeof input === 'boolean') return

    if (Array.isArray(input)) {
      for (const item of input) visit(item)
      return
    }

    if (typeof input === 'object') {
      for (const item of Object.values(input as Record<string, unknown>)) visit(item)
    }
  }

  visit(value)
  return {
    numeric: [...numeric],
    units: [...units],
  }
}

export function collectContractTrustedValueTokens(
  contract: Pick<VerifiedFactContract, 'verifiedFacts' | 'userStatedFacts'>,
): TrustedValueTokens {
  const verified = collectTrustedValueTokens(contract.verifiedFacts)
  const user = collectTrustedValueTokens(contract.userStatedFacts)
  return {
    numeric: [...new Set([...verified.numeric, ...user.numeric])],
    units: [...new Set([...verified.units, ...user.units])],
  }
}
