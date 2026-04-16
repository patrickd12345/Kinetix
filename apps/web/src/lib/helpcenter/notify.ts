export async function sendEscalationNotification(payload: {
  ticketId: string
  title?: string
  escalationLevel: number
  createdAt?: string
  assignee?: string
  labels?: string[]
}) {
  const url = import.meta.env.VITE_ESCALATION_PROXY_URL

  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Escalation UI must never fail because notification delivery failed.
  }
}
