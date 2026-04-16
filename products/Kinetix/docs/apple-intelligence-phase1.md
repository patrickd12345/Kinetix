# Apple Intelligence Phase-1 Roadmap (Kinetix iOS + watchOS)

## Objective
Use Apple Intelligence as a **text explanation layer** for Kinetix Phase-1 while preserving deterministic engines for readiness, fatigue scoring, recommendations, and run metrics as the source of truth.

## Architecture Rules
- Deterministic logic remains source of truth.
- Apple Intelligence generates text only (no scoring, no thresholding, no workout decision-making).
- No numeric or decision logic moves into AI prompts/results.
- Must support deterministic fallback text when Apple Intelligence is unavailable.
- Existing behavior must not break if Apple Intelligence calls fail or are unsupported.

## Phase-1 Features (In Scope)

### iOS
1. Training Readiness Explanation
2. Post-Run Summary
3. Recommendation Naturalization

### watchOS
4. Pre-Run Smart Suggestion
5. Post-Run Summary
6. Recovery Alerts

## Fallback Strategy
If Apple Intelligence is unavailable (OS/device capability or runtime failure), return deterministic templates:
- Readiness: "Your readiness is moderate. Consider an easy run."
- Post-run: "Good run. You're maintaining consistency."
- Pre-run: "You're moderately ready today."
- Recovery: "Fatigue is elevated. Consider recovery."

## Implementation Order
1. Create types
2. Create service protocol
3. Implement fallback version
4. Wire readiness explanation
5. Wire post-run summary
6. Wire watch pre-run suggestion

## Future Phase Features (Not in Phase-1)
- Real-time coaching (scaffold only)
- Natural language chat
- Weekly summary
