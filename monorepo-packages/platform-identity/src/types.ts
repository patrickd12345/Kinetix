export type ProductKey =
  | "kinetix"
  | "myassist"
  | "mychesscoach"
  | "bookiji"

export interface IdentityContext {
  entitlements?: string[]
  externalOwnership?: Partial<Record<ProductKey, boolean>>
}

export type OwnershipResult = Record<ProductKey, boolean>
