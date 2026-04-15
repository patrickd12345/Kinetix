import { type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false
    if (el.hasAttribute('disabled')) return false
    if (el.tabIndex < -1) return false
    return el.getClientRects().length > 0
  })
}

/**
 * Traps Tab within `containerRef`, moves initial focus to the first focusable control,
 * handles Escape via `onEscape`, and restores focus to the previously focused element on close.
 */
export function useDialogFocusTrap(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options?: { onEscape?: () => void },
): void {
  const onEscapeRef = useRef(options?.onEscape)
  onEscapeRef.current = options?.onEscape

  useEffect(() => {
    if (!isOpen) return
    const container = containerRef.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const tabIndexAddedRef = { current: false }

    const focusInitial = () => {
      if (!container) return
      const nodes = getFocusable(container)
      if (nodes.length > 0) {
        nodes[0].focus()
        return
      }
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1')
        tabIndexAddedRef.current = true
      }
      container.focus()
    }

    const raf = requestAnimationFrame(() => focusInitial())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscapeRef.current) {
        event.preventDefault()
        event.stopPropagation()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab' || !container) return
      const nodes = getFocusable(container)
      if (nodes.length === 0) {
        if (container.getAttribute('tabindex') === '-1' && document.activeElement === container) {
          event.preventDefault()
        }
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown, true)
      if (tabIndexAddedRef.current && container?.getAttribute('tabindex') === '-1') {
        container.removeAttribute('tabindex')
      }
      if (previous && typeof previous.focus === 'function') {
        previous.focus()
      }
    }
  }, [isOpen, containerRef])
}
