/**
 * User-facing KPS is PB-relative; lifetime best is 100 and must not display above that.
 * (Capped raw scores that exceed PB e.g. due to profile drift; PB run itself stays 100.)
 */
export const MAX_DISPLAY_RELATIVE_KPS = 100

export function capDisplayRelativeKps(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0
  }
  return Math.min(raw, MAX_DISPLAY_RELATIVE_KPS)
}
