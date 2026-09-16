## 2026-09-15T11:33:49Z

You are a Worker creating Production Operations Runbooks for Project Empire.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_ops
Project root: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Specifically review section "## 2026-09-15T07:19:14Z" covering R5 (Production Operations Runbook: Monitoring, Backup & Rollback Plan).

Also read:
- Project Specification: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_6\PROJECT.md`
- Survey Report on DB and Ops: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey6_db_load_rep\handoff.md` (Specifically Section 5: Production Operations Runbooks).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP (You own ONLY these files in `docs/ops/`):
- `docs/ops/MONITORING.md`
- `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`
- `docs/ops/ROLLBACK_PLAN.md`
DO NOT modify any code files in `packages/` or `apps/`.

TASK DETAILS:
Create comprehensive, production-ready, actionable operational runbooks in `docs/ops/`:
1. `docs/ops/MONITORING.md`:
   - Telemetry Architecture: OpenTelemetry / Prometheus metric collection, structured JSON logging, distributed tracing.
   - Core KPI Metrics: Definitions, query formulas, and collection cadence for DAU (Daily Active Users), QAP (Qualified Active Players), SRU (Season Reward Units), error rate (5xx / total requests), and latency percentiles (p50, p95, p99).
   - Health Check Probes: Liveness probe (`/health/live`), readiness probe (`/health/ready` verifying DB connection pool, migration state, Redis/cache status).
   - Anomaly Alert Thresholds: P1/P2 alert thresholds with escalation matrices (e.g. error rate > 1% for 5m, p99 latency > 500ms, abnormal velocity spikes).
2. `docs/ops/BACKUP_AND_DISASTER_RECOVERY.md`:
   - Automated Snapshot Policies: Daily full physical snapshots, retention policy (30 days daily, 12 months monthly).
   - Continuous WAL Archiving: Streaming WAL replication to S3/GCS compliant storage with encryption at rest.
   - Point-In-Time-Recovery (PITR) Procedures: Step-by-step restoration commands and verification steps achieving RTO < 15 minutes and RPO < 1 minute.
   - Disaster Recovery Scenarios & Playbooks: Complete database corruption, regional cloud outage, corrupted data migration disaster failover playbooks.
3. `docs/ops/ROLLBACK_PLAN.md`:
   - Reversible Migration Scripts: Explicit DOWN migration SQL scripts for every migration from `202609140001` through `202609140009`.
   - Feature Flag Kill-Switches: Configuration, environment variables, and dynamic toggles for `feature.referrals`, `feature.token`, `feature.stars_payments`, and `feature.missions`.
   - Emergency API Circuit-Breaker Procedures: Rate-limiting escalation, read-only maintenance mode activation, traffic shed rules.

Verify markdown formatting and completeness.
Write your completion report to:
`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_ops\handoff.md`
Notify parent with `send_message` when complete.
