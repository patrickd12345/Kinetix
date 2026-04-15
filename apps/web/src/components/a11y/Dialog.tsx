import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap'

export interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Overlay + centering; default matches run-dashboard modals */
  className?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaLabel?: string
  /** When false, Escape does not call onClose (e.g. blocking analyze state) */
  closeOnEscape?: boolean
  /** Announce busy state to assistive tech */
  ariaBusy?: boolean
}

/**
 * Modal dialog rendered in a portal with focus trap and background isolation:
 * `#root` gets `inert` + `aria-hidden` while open so assistive tech ignores page content.
 */
export function Dialog({
  open,
  onClose,
  children,
  className = 'fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4',
  ariaLabelledBy,
  ariaDescribedBy,
  ariaLabel,
  closeOnEscape = true,
  ariaBusy,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogFocusTrap(open, ref, closeOnEscape ? { onEscape: onClose } : undefined)

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const root = document.getElementById('root')
    if (!root) return
    const prevHidden = root.getAttribute('aria-hidden')
    const hadInert = root.hasAttribute('inert')
    root.setAttribute('aria-hidden', 'true')
    root.setAttribute('inert', '')
    return () => {
      if (prevHidden === null) root.removeAttribute('aria-hidden')
      else root.setAttribute('aria-hidden', prevHidden)
      if (!hadInert) root.removeAttribute('inert')
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      aria-busy={ariaBusy}
      className={className}
    >
      {children}
    </div>,
    document.body,
  )
}
