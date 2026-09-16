# BRIEFING — 2026-09-15T11:36:30Z

## Mission
Author comprehensive, production-ready, actionable operational runbooks in `docs/ops/` (MONITORING.md, BACKUP_AND_DISASTER_RECOVERY.md, ROLLBACK_PLAN.md) for Project Empire.

## 🔒 My Identity
- Archetype: worker_ops
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_ops
- Original parent: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Milestone: M5 (Production Operations Runbooks)

## 🔒 Key Constraints
- EXCLUSIVE WRITE OWNERSHIP: Only `docs/ops/MONITORING.md`, `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`, `docs/ops/ROLLBACK_PLAN.md`, plus my `.agents/teamwork_preview_worker_ops/` files.
- DO NOT modify any code files in `packages/` or `apps/` or `apps/web/src/screens/**`.
- DO NOT CHEAT: Genuine, production-grade, actionable operational runbooks with exact query formulas, concrete CLI commands, complete DOWN SQL migrations (0001 through 0009), feature flags, and emergency circuit breakers.
- Independent verification will be conducted by teamwork_preview_auditor.

## Current Parent
- Conversation ID: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Updated: 2026-09-15T11:36:30Z

## Task Summary
- **What to build**:
  1. `docs/ops/MONITORING.md`: Telemetry architecture (OTel/Prometheus, structured JSON, tracing), core KPI metrics (DAU, QAP, SRU, error rate, p50/p95/p99 latency) with formulas and cadences, health check probes (`/health/live`, `/health/ready`), anomaly alert thresholds with escalation matrices.
  2. `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`: Automated snapshot policies (daily physical snapshots, retention 30d/12m), continuous WAL streaming to S3/GCS with encryption, PITR step-by-step restoration commands (RTO < 15m, RPO < 1m), disaster recovery failover playbooks.
  3. `docs/ops/ROLLBACK_PLAN.md`: Reversible migration scripts (complete DOWN SQL for 0001 through 0009), feature flag kill-switches (`feature.referrals`, `feature.token`, `feature.stars_payments`, `feature.missions`), emergency API circuit breaker procedures.
- **Success criteria**: Comprehensive, fully specified, actionable markdown runbooks ready for SRE/Ops team execution.
- **Interface contracts**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\PROJECT.md`
- **Code layout**: `docs/ops/`

## Key Decisions Made
- Use exact SQL schemas from migrations 0001 through 0009 for the DOWN migration scripts to ensure 100% reversible database rollbacks.
- Provide production OpenTelemetry configurations, Prometheus Alertmanager rules, Grafana PromQL dashboards, and AWS/GCS CLI commands.
- Provide automated failover bash/PowerShell scripts and PostgREST/Cloudflare worker operational switches.

## Artifact Index
- `docs/ops/MONITORING.md` — Telemetry, KPIs, health probes, and alert thresholds
- `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md` — Snapshots, WAL archiving, PITR, DR playbooks
- `docs/ops/ROLLBACK_PLAN.md` — Migration DOWN scripts (0001-0009), feature flag kill-switches, circuit breakers
- `.agents/teamwork_preview_worker_ops/handoff.md` — Final handoff report

## Change Tracker
- **Files modified**:
  - `docs/ops/MONITORING.md`: Production observability, OTel/Prometheus metrics, structured JSON logging, distributed tracing, DAU/QAP/SRU formulas, health probes, P1/P2 alerting.
  - `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`: Snapshots, retention 30d/12m, WAL streaming, PITR step-by-step restoration (RTO < 15m, RPO < 1m), DR failover playbooks.
  - `docs/ops/ROLLBACK_PLAN.md`: DOWN migration SQL scripts (0001-0009), feature flag kill-switches, emergency circuit breakers (rate-limit, read-only maintenance, traffic shedding).
- **Build status**: PASS (`pnpm prettier --check docs/ops/*.md` exits 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Prettier check PASS (0 errors, clean formatting)
- **Lint status**: 0 violations
- **Tests added/modified**: N/A (operational runbooks verified with Prettier)

## Loaded Skills
- None specified by parent.
