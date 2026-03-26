# MediLink Agent Mapping & Orchestration

This document defines the specialized AI agents required for the MediLink project, their specific responsibilities, and when they should be activated according to the project plans.

## Agent Core Inventory

| Agent | Primary Role | Trigger Condition | Mandatory Skills |
|-------|--------------|-------------------|------------------|
| **Planner** | Implementation Planning | Start of any new phase or complex feature | `blueprint`, `iterative-retrieval` |
| **Architect** | System & Schema Design | Database migrations, RLS changes, Service boundaries | `postgres-patterns`, `backend-patterns` |
| **TDD Guide** | Test-First Implementation | Writing any new logic, repository, or component | `tdd-workflow`, `typescript-testing` |
| **Database Reviewer** | SQL & RLS Specialist | Creation of `001_initial_schema.sql` and RLS policy audits | `postgres-patterns`, `database-migrations` |
| **Security Reviewer** | Vulnerability Audit | Auth flows, PII handling, Stripe webhooks, RLS logic | `security-review`, `typescript-security` |
| **Code Reviewer** | Quality & Standards | Post-implementation of any task | `coding-standards`, `typescript-coding-style` |
| **E2E Runner** | Journey Verification | Final verification of user flows (Auth, CRUD, Export) | `e2e-testing` |
| **Build Resolver** | CI/CD & Type Safety | `npm run build` or `tsc` failures | `build-error-resolver` |
| **Doc Updater** | Knowledge Persistence | After major architecture changes or new service additions | `doc-updater`, `update-codemaps` |

---

## Phase-Specific Agent Assignments

### Phase 1: Project Scaffolding
*   **Planner**: Execute `Step 1` of `medilink-mvp.md`.
*   **Build Resolver**: Ensure `npm run build` passes after scaffolding.
*   **Doc Updater**: Initialize `docs/CODEMAPS/` for the new structure.

### Phase 2: Database & Auth (PII Critical)
*   **Architect**: Design the `profiles`, `patients`, and `subscriptions` schema.
*   **Database Reviewer**: **MANDATORY audit** of RLS policies in `001_initial_schema.sql` to prevent data leakage.
*   **TDD Guide**: Implement `auth.repository.ts` with 100% test coverage.
*   **Security Reviewer**: Audit JWT handling in `middleware.ts` and password hashing logic.

### Phase 3: Dashboard Features (Feature Rich)
*   **TDD Guide**: Lead implementation of `PatientRepository`, `FileRepository`, and `ExportService`.
*   **Code Reviewer**: Ensure `many small files` pattern is maintained (files < 400 lines).
*   **Planner**: Manage the parallel execution of `Step 6` (Folders) and `Step 7` (Notes).

### Phase 4: Billing & Public Profile
*   **Security Reviewer**: **CRITICAL audit** of Stripe webhook signature verification.
*   **Architect**: Design `doctor_profiles` and `profile_analytics` schema for public access.
*   **E2E Runner**: Verify the full "Free-to-Pro" upgrade flow.

---

## Agent Operational Protocols (for AI Understanding)

### 1. The Verification Gate
No implementation is considered complete until the **Verification Loop** has been executed.
*   **Command**: `/verify full`
*   **Logic**: If (Build == PASS && Tests == PASS && Coverage >= 80%), then proceed to **Code Reviewer**.

### 2. TDD Enforcement (Red-Green-Refactor)
Agents must strictly follow the `tdd-workflow`:
1.  **Red**: Write a test in `__tests__/` that fails.
2.  **Green**: Write the minimal code in `lib/` or `components/` to pass.
3.  **Refactor**: Clean the implementation while keeping tests green.

### 3. Security-First Principle
Any code touching the following must trigger a **Security Reviewer** pass:
*   `auth.uid()` calls
*   Supabase RLS policies
*   Stripe Webhooks
*   Patient PII (Names, DOB, Medical Files)

### 4. Context Efficiency
Use `iterative-retrieval` when exploring the codebase to minimize token usage. Start with `grep_search` for symbols before reading entire files.

---

## Success Metrics for Agents
*   **Coverage**: 80% overall, 100% for Auth/Billing/RBAC.
*   **Type Safety**: Zero `any` types in the entire project.
*   **Architecture**: Low coupling between `repositories` and `UI components`.
*   **Security**: Zero hardcoded secrets and passing RLS audit.
