import 'fake-indexeddb/auto'

if (typeof process !== 'undefined' && process.env) {
  process.env.SUPABASE_URL ||= 'https://vitest-placeholder.supabase.co'
  process.env.SUPABASE_ANON_KEY ||= 'vitest-anon-key-placeholder'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'vitest-service-role-key-placeholder'
}

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

if (typeof window !== 'undefined' && window.HTMLElement?.prototype && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {}
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup()
  })
}
