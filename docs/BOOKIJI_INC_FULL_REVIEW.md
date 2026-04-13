# Bookiji Inc — Full Review

## Executive Summary
Bookiji Inc. is transitioning from a single-product company into a multi-vertical platform organization ("Bookiji One"). This review assesses the current state, technical architecture, and strategic roadmap of the entire ecosystem.

The strategy hinges on shared "spine" infrastructure—auth, billing, cross-app memory, and AI runtimes—allowing rapid deployment of specialized applications (Kinetix, MyChessCoach, Nutrition, Finance) while maintaining a unified identity and context layer. Currently, the foundation is laid (Platform Spine V1/V2), and core capabilities are partially implemented. To realize the long-term vision, consistent adoption of platform standards across all products is required.

## Current Products

### Bookiji
- **Status:** Implemented (Core Product)
- **Description:** The flagship scheduling and service marketplace.
- **Current State:** Fully implemented but actively migrating to an isolated database schema (`bookiji.*` vs `public.*`) to support the multi-product platform strategy. PostgREST and RLS layers are wired via write-through views to maintain backward compatibility during the transition.
- **Role in Platform:** Acts as the canonical source for Stripe webhook processing (`POST /api/payments/webhook`) and the primary driver for platform identity definitions.

### Bookiji One
- **Status:** Partially Implemented (Orchestration Layer)
- **Description:** The umbrella concept and shared platform infrastructure that unites the product portfolio.
- **Current State:** Represented technically by the "Platform Spine" (Supabase `platform` schema) and monorepo packages (`@bookiji-inc/*`). Manages cross-product identity, feature flags, entitlements, and persistent memory.
- **Role in Platform:** The connective tissue. It is not a standalone app but the centralized governance and shared library layer.

### Kinetix
- **Status:** Implemented
- **Description:** Mixed-platform running performance and AI coaching product (Watch, iPhone, Web).
- **Current State:** Active development and integration with the Bookiji One spine. Web app uses Vite+React and PWA capabilities. Integrates Ollama (local) and Gemini (native) for AI coaching.
- **Role in Platform:** Proves the viability of the external product integration model, specifically utilizing the Stripe entitlement contract and AI runtimes.

### MyChessCoach
- **Status:** Partially Implemented
- **Description:** AI-driven chess coaching application.
- **Current State:** Spine tables are established (`chess.user_settings`, `chess.games`, `chess.analysis_runs`). Integrated into the persistent memory runtime (`ProductId = 'chess'`).
- **Role in Platform:** Demonstrates domain-specific state isolation under the unified platform identity.

### Finance (Planned)
- **Status:** Missing / Planned
- **Description:** Future vertical.
- **Current State:** No dedicated schemas or specific logic currently exist in the main repository.

### Nutrition (Planned)
- **Status:** Missing / Planned
- **Description:** Future vertical.
- **Current State:** Initial hints in taxonomy data (`'Nutrition Counseling'` mapped to `'Health & Wellness'`), but no dedicated application logic or schemas exist yet.

## Shared Platform (Current)

### Authentication Strategy
- **Mechanism:** Unified via Supabase Auth (`auth.users`).
- **Implementation:** Centralized profile management in `platform.profiles`. Uses Magic Links primarily, with optional OAuth.
- **State:** Implemented and functional. RLS policies ensure cross-schema isolation based on `auth.uid()`.

### Billing & Entitlements
- **Mechanism:** Stripe Subscriptions gated via `platform.entitlements`.
- **Implementation:** Single canonical Stripe webhook handler lives in the Bookiji app. It routes events and upserts `platform.entitlements` based on `product_key` (e.g., `'kinetix'`, `'chess'`). Sub-products initiate checkout sessions (`@bookiji-inc/stripe-runtime`).
- **State:** Implemented, but creates a tight coupling where Bookiji downtime affects entitlement updates for all products.

### AI Layer
- **Mechanism:** Centralized AI runtime interfaces with domain-specific implementations.
- **Implementation:** Monorepo package `@bookiji-inc/ai-runtime`. Kinetix uses this for coaching (Gemini on iOS, Ollama/Rule-based on Web).
- **State:** Partially implemented across the stack. Gateway paths and math guardrails exist, but uniform adoption and reliability in production are ongoing efforts.

### Persistent Memory
- **Mechanism:** Cross-session and cross-product context retention.
- **Implementation:** `@bookiji-inc/persistent-memory-runtime` and `buildKinetixBoundaryFromChat`. Memory boundaries define how AI session summaries are committed and retrieved.
- **State:** Partially implemented. Foundation is there (`runtime.ts`), but full cross-app synthesis (e.g., Bookiji scheduling context informing Kinetix coaching) is not fully realized.

### Cross-App Integration
- **Mechanism:** Monorepo packages (`monorepo-packages/*`) and shared database schemas.
- **Implementation:**
  - `@bookiji-inc/error-contract`
  - `@bookiji-inc/observability`
  - `@bookiji-inc/platform-auth`
- **State:** Partial adoption. Core contracts are defined, but legacy product code (especially in Bookiji and Kinetix API handlers) lacks uniform adoption.

## Shared Platform (Potential)

- **Unified Memory Graph:** Expanding `persistent-memory-runtime` to allow secure, user-consented context sharing between apps (e.g., Kinetix run exhaustion influencing MyChessCoach lesson difficulty, or Bookiji scheduling avoiding heavy workouts before major meetings).
- **Global Billing Gateway:** Decoupling the Stripe webhook from the Bookiji app into a standalone Bookiji One microservice to prevent cascading entitlement failures.
- **Unified Feature Flagging:** Moving from `platform.feature_flags` to a dynamic, low-latency edge-evaluating system for cross-product experiments.

## Architecture Review
The shift from a monolithic structure to a "Platform Spine" model is structurally sound. The database schema isolation (e.g., `SPINE_V2.0` moving Bookiji tables to `bookiji.*` while keeping `public.*` views) is a pragmatic approach to zero-downtime migration.

However, the architecture currently suffers from "Monorepo vs. Multirepo" friction. Products like Kinetix are meant to be standalone clones in production but rely heavily on `scripts/vercel-install.sh` to clone the Bookiji-inc packages at build time. This creates a fragile CI/CD pipeline and risks parity issues between local umbrella development and standalone production deployment.

## Integration Review
- **Identity:** Excellent integration. `platform.profiles` tied to `auth.users` provides a seamless single-sign-on experience across the portfolio.
- **Payments:** Brittle. The hub-and-spoke model where Bookiji handles all Stripe webhooks is efficient but risky.
- **Packages:** `@bookiji-inc/*` standardizes the stack, but adoption is noted as "Partial" in `PRODUCT_SCOPE.md`. Error contracts and observability require concerted enforcement.

## AI Strategy
Bookiji Inc is taking a pragmatic, multi-tiered approach to AI:
1.  **Local/Edge (Kinetix Web):** Prioritizing local Ollama for privacy and cost control, with deterministic rule-based fallbacks.
2.  **Native Cloud (Kinetix iOS):** Utilizing Gemini API for robust voice coaching.
3.  **Governance:** The introduction of LLM Math Guardrails ensures AI output (e.g., Kinetix Performance Scores) remains mathematically accurate and doesn't hallucinate metrics.
**Future Potential:** Transitioning the AI layer into an active "Agentic Orchestrator" that can proactively interact across verticals (e.g., booking a physical therapy appointment via Bookiji based on Kinetix injury detection).

## Standards Review
Based on `PRODUCT_SCOPE.md` and Phase 3 goals:
- **AI Runtime:** Applicable and progressing.
- **Stripe Runtime:** Applicable but centralized hazard.
- **CI Baseline:** Partial. Web tests are solid, but native/RAG surfaces lack unified CI coverage.
- **Env Contract:** Partial. Runtime resolution remains mixed across surfaces.
- **Observability:** Partial. Inconsistent adoption across API/App paths.
- **Feature Flags:** Partial. Schema exists, governance is lacking.
- **Error Contract:** Partial. Adoption in new surfaces is good, but legacy API handlers need refactoring.

## Risks
1.  **Stripe Webhook Coupling:** Bookiji app downtime means new Kinetix or Chess users do not receive their paid entitlements.
2.  **Standalone Build Fragility:** The Vercel parity build process for sub-products relying on cloning the parent repository is a major point of failure.
3.  **Schema Sprawl:** Without strict migration governance, `platform.*` and product-specific schemas could drift, complicating RLS and cross-database joins.
4.  **Incomplete Standard Adoption:** Leaving Phase 3 (Platform Hardening) incomplete creates technical debt that will scale non-linearly as Finance and Nutrition are added.

## Opportunities
1.  **Cross-Pollination of Data:** Monetizing (or adding immense user value to) the intersection of data. Nutrition + Kinetix + Finance creates a holistic "Life Operating System".
2.  **B2B White-labeling:** The Bookiji One spine is robust enough that it could eventually be offered as a Headless Platform for other creators/coaches.
3.  **Help Center Consolidation:** Scaling the current RAG-based Help Center to handle support tickets across all products using the unified AI Runtime.

## Recommended Next Moves
1.  **Extract Billing:** Move the Stripe Webhook handler out of `products/bookiji` and into a serverless Bookiji One gateway.
2.  **Enforce Observability & Error Contracts:** Mandate the use of `@bookiji-inc/error-contract` and `@bookiji-inc/observability` across all `api/*` handlers before launching Finance or Nutrition.
3.  **Stabilize CI/CD:** Replace the runtime repository cloning (`vercel-install.sh`) with a proper private NPM registry or Git submodules to ensure reproducible, atomic builds.

## 90-Day Direction
- **Month 1:** Complete Phase 3 Platform Hardening for Kinetix. Achieve "Full" status for Error Contracts and Observability. Address the Stripe Webhook single point of failure.
- **Month 2:** Launch MyChessCoach MVP using the fully hardened spine. Validate the multi-tenant capability of `platform.entitlements` and Persistent Memory.
- **Month 3:** Begin architecture discovery for the Finance vertical. Finalize the Persistent Memory cross-app permissions model to prepare for multi-domain AI coaching.
