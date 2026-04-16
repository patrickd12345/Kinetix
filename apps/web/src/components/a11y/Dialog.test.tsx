import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from './Dialog'

function ensureRoot() {
  let root = document.getElementById('root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'root'
    document.body.prepend(root)
  }
  return root
}

describe('Dialog', () => {
  beforeEach(() => {
    ensureRoot()
  })

  it('isolates #root with aria-hidden and inert while open and restores on close', () => {
    const root = ensureRoot()
    const onClose = () => {}

    const { rerender } = render(
      <Dialog open ariaLabel="Test dialog" onClose={onClose}>
        <p>Dialog body</p>
      </Dialog>,
    )

    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.hasAttribute('inert')).toBe(true)

    rerender(
      <Dialog open={false} ariaLabel="Test dialog" onClose={onClose}>
        <p>Dialog body</p>
      </Dialog>,
    )

    expect(root.hasAttribute('aria-hidden')).toBe(false)
    expect(root.hasAttribute('inert')).toBe(false)
  })

  it('renders dialog semantics in a portal with accessible name', () => {
    const onClose = () => {}
    render(
      <Dialog open ariaLabel="Test dialog" onClose={onClose}>
        <button type="button">Inside</button>
      </Dialog>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Test dialog' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(screen.getByRole('button', { name: 'Inside' }))).toBe(true)
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog open ariaLabel="Closable" onClose={onClose}>
        <p>x</p>
      </Dialog>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
