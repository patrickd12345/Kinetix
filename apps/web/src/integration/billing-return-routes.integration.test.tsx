import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('Billing return routes', () => {
  it('renders /billing/success without entitlement gate redirects', async () => {
    window.history.pushState({}, '', '/billing/success')
    render(<App />)

    expect(await screen.findByText('Payment completed')).toBeInTheDocument()
  })

  it('renders /billing/cancel without entitlement gate redirects', async () => {
    window.history.pushState({}, '', '/billing/cancel')
    render(<App />)

    expect(await screen.findByText('Checkout canceled')).toBeInTheDocument()
  })
})

