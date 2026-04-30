# KX-FEAT-009 — Apple Intelligence / Foundation Models feasibility (local SDK)

**Date:** 2026-04-29  
**Environment:** Cursor agent / local macOS build host

## Local toolchain

| Item | Value |
|------|--------|
| **Xcode** | 26.4 (Build 17E192) |
| **iPhone Simulator SDK** | 26.4 (`iPhoneSimulator26.4.sdk`) |

## Module / API inspected (verified from SDK, not guessed)

| Item | Detail |
|------|--------|
| **Framework** | `FoundationModels` (`FoundationModels.framework` under the iOS Simulator SDK) |
| **Primary types** | `SystemLanguageModel`, `LanguageModelSession`, `GenerationOptions` |
| **Import** | `import FoundationModels` |
| **Availability (SDK)** | `LanguageModelSession` / `SystemLanguageModel` are marked `@available(iOS 26.0, macOS 26.0, visionOS 26.0, *)`; **`@available(watchOS, unavailable)`** |
| **Runtime availability** | `SystemLanguageModel.default.availability` is either `.available` or `.unavailable(UnavailableReason)` with reasons: `deviceNotEligible`, `appleIntelligenceNotEnabled`, `modelNotReady` |
| **Convenience** | `SystemLanguageModel.default.isAvailable` (Bool) |
| **Text generation** | `LanguageModelSession.respond(to: String, options: GenerationOptions) async throws -> LanguageModelSession.Response<String>`; response exposes `.content: String` |

## Simulator vs device

- The **API compiles and links** on the **iOS Simulator** (arm64 / x86_64 simulator swiftinterfaces present).
- **Real generation** requires the **system language model** to report available (`isAvailable == true`). On many Simulator configurations this is **false** until Apple Intelligence / on-device stack is enabled and ready — then `generateChatResponse` correctly returns the **controlled fallback** (`usedFallback: true`), not fabricated text.

## Entitlements / capabilities

- No separate **custom entitlement plist key** was found in the SDK sample for merely **importing** `FoundationModels` (standard app linking).
- Runtime gating is driven by **`SystemLanguageModel`** availability (e.g. Apple Intelligence not enabled, model not ready).

## Feasibility verdict

**`AVAILABLE_NOW`** (SDK)

- **Meaning:** iOS 26 SDK ships `FoundationModels` with on-device `LanguageModelSession` suitable for short coach replies. KinetixPhone wires **real** `respond` output when `SystemLanguageModel.default.isAvailable` is true; otherwise **no fake** model output — callers fall back to the existing user-facing unavailable string via `SharedAIExecutionService.ask`.

### If generation never activates on a given machine

Treat as **`UNKNOWN_BLOCKED`** at **runtime** (check `SystemLanguageModel.default.availability` in Console / breakpoints), not an SDK gap.

## References in repo

- Provider: `ios/KinetixPhone/Services/KinetixAppleIntelligenceService.swift` (`DefaultKinetixAppleIntelligenceService.generateChatResponse`)
- Orchestration: `watchos/KinetixWatch/AICoach.swift` (`SharedAIExecutionService.ask`)
