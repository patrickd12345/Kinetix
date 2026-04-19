# Bookiji Inc Documentation Integrity Report

## Executive summary
This report outlines the integrity of documentation across the Bookiji Inc umbrella repository. It checks for missing docs, duplicates, drift, broken references, and canonical ownership.

**Current Status:** structurally inconsistent

## Inventory summary
- Total markdown files: 131
- By Group:
  - Root: 14
  - Shared Package: 2
  - Product (Bookiji): 2
  - Product (Kinetix): 37
  - Product (MyAssist): 0
  - Product (MyChessCoach): 0
- By Type:
  - Readme: 11
  - Architecture: 6
  - Standard: 2
  - Runbook: 2
  - Audit: 20
  - Roadmap: 7
  - Billing: 0
  - Deployment: 9
  - Testing: 1
  - Other: 73

## Missing documentation
- **Severity:** MEDIUM
  - **Scope:** Bookiji
  - **Paths:** products/Bookiji
  - **Explanation:** Product folder products/Bookiji is missing completely.
  - **Recommended Action:** Create product folder and initial README.

- **Severity:** MEDIUM
  - **Scope:** MyAssist
  - **Paths:** products/MyAssist
  - **Explanation:** Product folder products/MyAssist is missing completely.
  - **Recommended Action:** Create product folder and initial README.

- **Severity:** MEDIUM
  - **Scope:** MyChessCoach
  - **Paths:** products/MyChessCoach
  - **Explanation:** Product folder products/MyChessCoach is missing completely.
  - **Recommended Action:** Create product folder and initial README.

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/persistent-memory-runtime/README.md
  - **Explanation:** Missing README for monorepo package persistent-memory-runtime
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/platform-identity/README.md
  - **Explanation:** Missing README for monorepo package platform-identity
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/ai-runtime/README.md
  - **Explanation:** Missing README for monorepo package ai-runtime
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/observability/README.md
  - **Explanation:** Missing README for monorepo package observability
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/platform-signals/README.md
  - **Explanation:** Missing README for monorepo package platform-signals
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/ai-core/README.md
  - **Explanation:** Missing README for monorepo package ai-core
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/platform-action-contract/README.md
  - **Explanation:** Missing README for monorepo package platform-action-contract
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/error-contract/README.md
  - **Explanation:** Missing README for monorepo package error-contract
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/stripe-runtime/README.md
  - **Explanation:** Missing README for monorepo package stripe-runtime
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** shared package
  - **Paths:** monorepo-packages/platform-billing/README.md
  - **Explanation:** Missing README for monorepo package platform-billing
  - **Recommended Action:** Create README.md

- **Severity:** MEDIUM
  - **Scope:** umbrella
  - **Paths:** docs/standards/README.md
  - **Explanation:** Standards folder exists but missing an index or README.
  - **Recommended Action:** Create an index for standards.

- **Severity:** MEDIUM
  - **Scope:** umbrella
  - **Paths:** docs/billing.md
  - **Explanation:** Missing canonical doc for major topic: billing
  - **Recommended Action:** Create canonical doc for billing

- **Severity:** MEDIUM
  - **Scope:** umbrella
  - **Paths:** docs/execution_plans.md
  - **Explanation:** Missing canonical doc for major topic: execution plans
  - **Recommended Action:** Create canonical doc for execution plans

## Duplicate / overlapping documentation
- **Severity:** MEDIUM
  - **Scope:** various
  - **Paths:** PROJECT_PLAN.md, docs/PROJECT_PLAN.md
  - **Explanation:** Duplicate filename project_plan.md found in multiple locations.
  - **Recommended Action:** Consolidate or rename to clarify distinct purposes.

- **Severity:** LOW
  - **Scope:** umbrella
  - **Paths:** archive/web-legacy/README.md, web/README.md
  - **Explanation:** Legacy web README exists alongside current web README.
  - **Recommended Action:** Ensure legacy is clearly marked or remove if entirely superseded.

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** PROJECT_PLAN.md, docs/PROJECT_PLAN.md
  - **Explanation:** Duplicate PROJECT_PLAN.md found at root and in docs/.
  - **Recommended Action:** Consolidate into a single canonical PROJECT_PLAN.md.

## Contradictions / drift
- **Severity:** CRITICAL
  - **Scope:** umbrella
  - **Paths:** README.md
  - **Explanation:** Bookiji must remain excluded from Spine billing docs, but mentioned together.
  - **Recommended Action:** Review and clarify Bookiji billing isolation.

- **Severity:** CRITICAL
  - **Scope:** umbrella
  - **Paths:** docs/BOOKIJI_INC_FULL_REVIEW.md
  - **Explanation:** Bookiji must remain excluded from Spine billing docs, but mentioned together.
  - **Recommended Action:** Review and clarify Bookiji billing isolation.

- **Severity:** CRITICAL
  - **Scope:** umbrella
  - **Paths:** docs/KINETIX_STAGING_SMOKE.md
  - **Explanation:** Bookiji must remain excluded from Spine billing docs, but mentioned together.
  - **Recommended Action:** Review and clarify Bookiji billing isolation.

- **Severity:** CRITICAL
  - **Scope:** umbrella
  - **Paths:** docs/PHASE3_ERROR_CONTRACT_ROLLOUT.md
  - **Explanation:** Bookiji must remain excluded from Spine billing docs, but mentioned together.
  - **Recommended Action:** Review and clarify Bookiji billing isolation.

- **Severity:** CRITICAL
  - **Scope:** umbrella
  - **Paths:** docs/PROJECT_PLAN.md
  - **Explanation:** Bookiji must remain excluded from Spine billing docs, but mentioned together.
  - **Recommended Action:** Review and clarify Bookiji billing isolation.

- **Severity:** CRITICAL
  - **Scope:** umbrella
  - **Paths:** docs/deployment/README.md
  - **Explanation:** Bookiji must remain excluded from Spine billing docs, but mentioned together.
  - **Recommended Action:** Review and clarify Bookiji billing isolation.

## Broken references
- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** README.md
  - **Explanation:** Broken internal link to ../../SPINE_CONTRACT.md
  - **Recommended Action:** Fix or remove link to ../../SPINE_CONTRACT.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** README.md
  - **Explanation:** Broken internal link to ../../docs/platform/APP_INTEGRATION_STANDARD.md
  - **Recommended Action:** Fix or remove link to ../../docs/platform/APP_INTEGRATION_STANDARD.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/IOS_WATCH_PARITY_MATRIX.md
  - **Explanation:** Broken internal link to apps/web/src/pages/RunDashboard.tsx
  - **Recommended Action:** Fix or remove link to apps/web/src/pages/RunDashboard.tsx

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/IOS_WATCH_PARITY_MATRIX.md
  - **Explanation:** Broken internal link to apps/web/src/pages/History.tsx
  - **Recommended Action:** Fix or remove link to apps/web/src/pages/History.tsx

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/IOS_WATCH_PARITY_MATRIX.md
  - **Explanation:** Broken internal link to apps/web/src/pages/Settings.tsx
  - **Recommended Action:** Fix or remove link to apps/web/src/pages/Settings.tsx

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/KINETIX_STAGING_SMOKE.md
  - **Explanation:** Broken internal link to ../../apps/web/.env.example
  - **Recommended Action:** Fix or remove link to ../../apps/web/.env.example

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/KINETIX_STAGING_SMOKE.md
  - **Explanation:** Broken internal link to ../../scripts/check-master-access.ts
  - **Recommended Action:** Fix or remove link to ../../scripts/check-master-access.ts

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/PHASE4_RELEASE_EVIDENCE.md
  - **Explanation:** Broken internal link to ../packages/ai-runtime/package.json
  - **Recommended Action:** Fix or remove link to ../packages/ai-runtime/package.json

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/PROJECT_PLAN.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/PROJECT_PLAN.md
  - **Explanation:** Broken internal link to ../../../../SPINE_CONTRACT.md
  - **Recommended Action:** Fix or remove link to ../../../../SPINE_CONTRACT.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/PROJECT_PLAN.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/MEMORY_BRIDGE_CONTRACT.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/MEMORY_BRIDGE_CONTRACT.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/ENV_PARITY.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/ENV_PARITY.md
  - **Explanation:** Broken internal link to ../../../../ops/env/infisical-architecture.md
  - **Recommended Action:** Fix or remove link to ../../../../ops/env/infisical-architecture.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/INFISICAL_LOCAL_DEV.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/README.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/README.md
  - **Explanation:** Broken internal link to ../../../../SPINE_CONTRACT.md
  - **Recommended Action:** Fix or remove link to ../../../../SPINE_CONTRACT.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/README.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/MEMORY_BRIDGE_CONTRACT.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/MEMORY_BRIDGE_CONTRACT.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../../packages/stripe-runtime/src/kinetixCheckoutSession.ts
  - **Recommended Action:** Fix or remove link to ../../../../packages/stripe-runtime/src/kinetixCheckoutSession.ts

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md
  - **Recommended Action:** Fix or remove link to ../../../bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../bookiji/src/lib/paymentsWebhookHandler.ts
  - **Recommended Action:** Fix or remove link to ../../../bookiji/src/lib/paymentsWebhookHandler.ts

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../bookiji/src/lib/services/stripe.ts
  - **Recommended Action:** Fix or remove link to ../../../bookiji/src/lib/services/stripe.ts

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../bookiji/src/lib/services/stripe.ts
  - **Recommended Action:** Fix or remove link to ../../../bookiji/src/lib/services/stripe.ts

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md
  - **Recommended Action:** Fix or remove link to ../../../../docs/platform/APP_INTEGRATION_STANDARD.md

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Broken internal link to ../../../bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md
  - **Recommended Action:** Fix or remove link to ../../../bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md

## Canonical ownership issues
- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** ARCHITECTURE.md, apps/web/HELP_CENTER_ARCHITECTURE.md, docs/CLOUD_STORAGE_ARCHITECTURE.md, docs/UNIFIED_STORAGE_ARCHITECTURE.md, docs/architecture/LLM_MATH_GUARDRAILS.md, docs/architecture/LLM_RESPONSE_GUARDRAILS.md
  - **Explanation:** Multiple files cover architecture without a clear canonical index or owner.
  - **Recommended Action:** Create a canonical architecture.md index or consolidate.

- **Severity:** HIGH
  - **Scope:** umbrella
  - **Paths:** archive/web-legacy/DEPLOYMENT.md, docs/PHASE4_DEPLOYMENT_CHECKLIST.md, docs/deployment/DEPLOYMENT_TROUBLESHOOTING.md, docs/deployment/ENV_PARITY.md, docs/deployment/INFISICAL_LOCAL_DEV.md, docs/deployment/KINETIX_STRIPE_PRODUCTION_CHECKLIST.md, docs/deployment/KINETIX_SUBDOMAIN.md, docs/deployment/KINETIX_VERIFICATION_CHECKLIST.md, docs/deployment/README.md, docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
  - **Explanation:** Multiple files cover deployment without a clear canonical index or owner.
  - **Recommended Action:** Create a canonical deployment.md index or consolidate.

## Recommended cleanup actions (Top 10)
1. [CRITICAL] Bookiji must remain excluded from Spine billing docs, but mentioned together. -> Review and clarify Bookiji billing isolation. (Paths: README.md)
2. [CRITICAL] Bookiji must remain excluded from Spine billing docs, but mentioned together. -> Review and clarify Bookiji billing isolation. (Paths: docs/BOOKIJI_INC_FULL_REVIEW.md)
3. [CRITICAL] Bookiji must remain excluded from Spine billing docs, but mentioned together. -> Review and clarify Bookiji billing isolation. (Paths: docs/KINETIX_STAGING_SMOKE.md)
4. [CRITICAL] Bookiji must remain excluded from Spine billing docs, but mentioned together. -> Review and clarify Bookiji billing isolation. (Paths: docs/PHASE3_ERROR_CONTRACT_ROLLOUT.md)
5. [CRITICAL] Bookiji must remain excluded from Spine billing docs, but mentioned together. -> Review and clarify Bookiji billing isolation. (Paths: docs/PROJECT_PLAN.md)
6. [CRITICAL] Bookiji must remain excluded from Spine billing docs, but mentioned together. -> Review and clarify Bookiji billing isolation. (Paths: docs/deployment/README.md)
7. [HIGH] Duplicate PROJECT_PLAN.md found at root and in docs/. -> Consolidate into a single canonical PROJECT_PLAN.md. (Paths: PROJECT_PLAN.md, docs/PROJECT_PLAN.md)
8. [HIGH] Broken internal link to ../../SPINE_CONTRACT.md -> Fix or remove link to ../../SPINE_CONTRACT.md (Paths: README.md)
9. [HIGH] Broken internal link to ../../docs/platform/APP_INTEGRATION_STANDARD.md -> Fix or remove link to ../../docs/platform/APP_INTEGRATION_STANDARD.md (Paths: README.md)
10. [HIGH] Broken internal link to apps/web/src/pages/RunDashboard.tsx -> Fix or remove link to apps/web/src/pages/RunDashboard.tsx (Paths: docs/IOS_WATCH_PARITY_MATRIX.md)

## Safe auto-fix candidates
- Fix broken links in: README.md
- Fix broken links in: README.md
- Fix broken links in: docs/IOS_WATCH_PARITY_MATRIX.md
- Fix broken links in: docs/IOS_WATCH_PARITY_MATRIX.md
- Fix broken links in: docs/IOS_WATCH_PARITY_MATRIX.md
- Fix broken links in: docs/KINETIX_STAGING_SMOKE.md
- Fix broken links in: docs/KINETIX_STAGING_SMOKE.md
- Fix broken links in: docs/PHASE4_RELEASE_EVIDENCE.md
- Fix broken links in: docs/PROJECT_PLAN.md
- Fix broken links in: docs/PROJECT_PLAN.md
- Fix broken links in: docs/PROJECT_PLAN.md
- Fix broken links in: docs/deployment/ENV_PARITY.md
- Fix broken links in: docs/deployment/ENV_PARITY.md
- Fix broken links in: docs/deployment/INFISICAL_LOCAL_DEV.md
- Fix broken links in: docs/deployment/README.md
- Fix broken links in: docs/deployment/README.md
- Fix broken links in: docs/deployment/README.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md
- Fix broken links in: docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md

## Needs human decision
- Bookiji must remain excluded from Spine billing docs, but mentioned together. (Paths: README.md)
- Bookiji must remain excluded from Spine billing docs, but mentioned together. (Paths: docs/BOOKIJI_INC_FULL_REVIEW.md)
- Bookiji must remain excluded from Spine billing docs, but mentioned together. (Paths: docs/KINETIX_STAGING_SMOKE.md)
- Bookiji must remain excluded from Spine billing docs, but mentioned together. (Paths: docs/PHASE3_ERROR_CONTRACT_ROLLOUT.md)
- Bookiji must remain excluded from Spine billing docs, but mentioned together. (Paths: docs/PROJECT_PLAN.md)
- Bookiji must remain excluded from Spine billing docs, but mentioned together. (Paths: docs/deployment/README.md)
- Duplicate PROJECT_PLAN.md found at root and in docs/. (Paths: PROJECT_PLAN.md, docs/PROJECT_PLAN.md)
- Multiple files cover architecture without a clear canonical index or owner. (Paths: ARCHITECTURE.md, apps/web/HELP_CENTER_ARCHITECTURE.md, docs/CLOUD_STORAGE_ARCHITECTURE.md, docs/UNIFIED_STORAGE_ARCHITECTURE.md, docs/architecture/LLM_MATH_GUARDRAILS.md, docs/architecture/LLM_RESPONSE_GUARDRAILS.md)
- Multiple files cover deployment without a clear canonical index or owner. (Paths: archive/web-legacy/DEPLOYMENT.md, docs/PHASE4_DEPLOYMENT_CHECKLIST.md, docs/deployment/DEPLOYMENT_TROUBLESHOOTING.md, docs/deployment/ENV_PARITY.md, docs/deployment/INFISICAL_LOCAL_DEV.md, docs/deployment/KINETIX_STRIPE_PRODUCTION_CHECKLIST.md, docs/deployment/KINETIX_SUBDOMAIN.md, docs/deployment/KINETIX_VERIFICATION_CHECKLIST.md, docs/deployment/README.md, docs/deployment/STRIPE_KINETIX_ENTITLEMENTS.md)
