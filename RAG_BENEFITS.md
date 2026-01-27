# RAG Benefits for Kinetix (KPS-first)

## What is RAG?

**RAG (Retrieval Augmented Generation)** = retrieve relevant past data + use it as context for AI generation.

In Kinetix, that means the coach can reference **your past runs** to explain *why* today’s **KPS (Kinetix Performance Score)** is higher/lower and what patterns led to it.

## Why it matters (with KPS)

- **Personalized progress context**: “KPS 97.4 — 2.1 points better than your last similar 5K”
- **Pattern recognition**: “Your best KPS runs tend to have steadier pacing and higher cadence”
- **Goal coaching**: “To hit target KPS 95, you typically need to start ~10s/km slower and negative split”

## Implementation shape (high level)

- **Embed runs** as text including distance, pace, KPS, HR (if available), cadence, form score, date, tags.
- **Vector search** to find similar runs (e.g., distance ±10%, similar pace, recent).
- **Augmented prompt** includes: current run + top similar runs + a short “pattern summary”.
- **Output**: JSON with a concise title + 2–3 sentence insight.

## Guardrails

- KPS is **0–100** and **never above 100**.
- PB reference is **pb_eq5k_sec** (fastest-ever equivalent 5K), enforced in one place per platform.

**Last Updated**: 2026-01-27

