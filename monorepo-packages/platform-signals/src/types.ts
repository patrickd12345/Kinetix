export type ProductKey =
  | "bookiji"
  | "kinetix"
  | "myassist"
  | "mychesscoach"

export type SignalSeverity =
  | "low"
  | "medium"
  | "high"

export interface PlatformSignal {
  id: string
  sourceProduct: ProductKey
  type: string
  severity?: SignalSeverity
  payload?: Record<string, unknown>
  timestamp: number
}

export interface ActionIntent {
  id: string
  signalId: string
  targetProduct: ProductKey
  actionType: string
  metadata?: Record<string, unknown>
}
