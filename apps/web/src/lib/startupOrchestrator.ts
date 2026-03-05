export type StartupAttemptTask = (attempt: number) => Promise<boolean> | boolean

/**
 * Schedules startup attempts at specific delays.
 * Return true from task to stop future attempts early.
 */
export function scheduleStartupAttempts(delaysMs: number[], task: StartupAttemptTask): () => void {
  let cancelled = false
  let completed = false
  const timers: number[] = []

  for (const [attempt, delay] of delaysMs.entries()) {
    const timer = window.setTimeout(async () => {
      if (cancelled || completed) return
      try {
        const done = await task(attempt)
        if (done) completed = true
      } catch {
        // Keep retry behavior deterministic for callers; failures simply allow later attempts.
      }
    }, delay)
    timers.push(timer)
  }

  return () => {
    cancelled = true
    timers.forEach((timer) => window.clearTimeout(timer))
  }
}

