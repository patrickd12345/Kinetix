import { describe, it, expect } from 'vitest';
import { createSignal } from '../createSignal.js';

describe('createSignal', () => {
  it('creates a signal with required fields', () => {
    const signal = createSignal({
      sourceProduct: 'bookiji',
      type: 'test_event',
    });

    expect(signal.id).toBeDefined();
    expect(typeof signal.id).toBe('string');
    expect(signal.id.length).toBeGreaterThan(0);

    expect(signal.timestamp).toBeDefined();
    expect(typeof signal.timestamp).toBe('number');
    expect(signal.timestamp).toBeLessThanOrEqual(Date.now());

    expect(signal.sourceProduct).toBe('bookiji');
    expect(signal.type).toBe('test_event');
    expect(signal.severity).toBeUndefined();
    expect(signal.payload).toBeUndefined();
  });

  it('preserves optional fields when provided', () => {
    const payload = { foo: 'bar' };
    const signal = createSignal({
      sourceProduct: 'kinetix',
      type: 'user_action',
      severity: 'high',
      payload,
    });

    expect(signal.sourceProduct).toBe('kinetix');
    expect(signal.type).toBe('user_action');
    expect(signal.severity).toBe('high');
    expect(signal.payload).toBe(payload);
  });

  it('allows overriding timestamp', () => {
    const customTimestamp = 1234567890;
    const signal = createSignal({
      sourceProduct: 'myassist',
      type: 'scheduled_event',
      timestamp: customTimestamp,
    });

    expect(signal.timestamp).toBe(customTimestamp);
  });
});
