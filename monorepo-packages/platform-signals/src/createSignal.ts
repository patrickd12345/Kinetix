import * as crypto from 'crypto';
import type { PlatformSignal, ProductKey, SignalSeverity } from './types.js';

export interface CreateSignalInput {
  sourceProduct: ProductKey;
  type: string;
  severity?: SignalSeverity;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

export function createSignal(input: CreateSignalInput): PlatformSignal {
  return {
    id: crypto.randomUUID(),
    timestamp: input.timestamp ?? Date.now(),
    sourceProduct: input.sourceProduct,
    type: input.type,
    ...(input.severity ? { severity: input.severity } : {}),
    ...(input.payload ? { payload: input.payload } : {}),
  };
}
