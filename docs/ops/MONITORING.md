# Project Empire — Production Monitoring, Telemetry & Alerting Runbook

**Document Version**: 1.0.0  
**Target Environment**: Cloudflare Workers (Edge API), Supabase / PostgreSQL 15+ (State Engine), Upstash / Redis (Edge Cache)  
**Classification**: Production Operations Runbook (R5)  
**Last Review Date**: 2026-09-15

---

## 1. Observability Architecture & Principles

Project Empire enforces a four-pillar observability strategy designed for distributed edge runtimes and low-latency transactional state engines.

```
+-----------------------------------------------------------------------------------+
|                              EDGE OBSERVABILITY                                  |
|                                                                                   |
|  +--------------------+     Cloudflare Logpush     +---------------------------+  |
|  | Cloudflare Workers | -------------------------> | Datadog / Grafana Loki    |  |
|  | (API Edge Gateway) |                            | (Structured JSON Logs)    |  |
|  +--------------------+                            +---------------------------+  |
|           |                                                                       |
|           | OpenTelemetry HTTP / OTLP                                             |
|           v                                                                       |
|  +--------------------+     Remote Write Export    +---------------------------+  |
|  | OpenTelemetry      | -------------------------> | Prometheus / Mimir        |  |
|  | Collector Gateway  |                            | (Time-Series Metrics)     |  |
|  +--------------------+                            +---------------------------+  |
|           |                                                                       |
|           | Trace Spans (W3C TraceContext)                                        |
|           v                                                                       |
|  +--------------------+                                                           |
|  | Grafana Tempo /    |                                                           |
|  | Jaeger Collector   |                                                           |
|  +--------------------+                                                           |
+-----------------------------------------------------------------------------------+
                                    |
                                    | PostgREST / Connection Pool
                                    v
+-----------------------------------------------------------------------------------+
|                            DATABASE OBSERVABILITY                                 |
|                                                                                   |
|  +--------------------+     pg_stat_statements     +---------------------------+  |
|  | Supabase Postgres  | -------------------------> | Prometheus postgres_      |  |
|  | (State Engine)     |                            | exporter                  |  |
|  +--------------------+                            +---------------------------+  |
|           |                                                                       |
|           | Continuous Analytics Pipeline                                         |
|           v                                                                       |
|  +--------------------+     Aggregated Rollup      +---------------------------+  |
|  | analytics_events   | -------------------------> | daily_metrics table       |  |
|  | Table              |                            | (DAU, QAP, SRU, Revenue)  |  |
|  +--------------------+                            +---------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 1.1 Guiding Principles

1. **Zero-Overhead Edge Telemetry**: Edge compute cannot block user requests on metric flushes. Metrics and telemetry export use asynchronous execution contexts (`ctx.waitUntil`) or Cloudflare Logpush pipelines.
2. **Deterministic Correlation**: Every incoming HTTP request is assigned a unique `requestId` (UUIDv4) and W3C `traceparent`. This trace context propagates through authentication, database transactions, ledger entries, and audit logs.
3. **PII and Secret Sanitation**: Telegram auth hashes, user phone numbers, database connection credentials, and session tokens are strictly redacted before emission to logs or external telemetry streams.
4. **Actionable Alerts**: No alert fires without a documented runbook link, clear escalation owner, and pre-defined remediation steps.

---

## 2. Telemetry Implementation Specification

### 2.1 OpenTelemetry & Prometheus Metric Collection

The API exports real-time metrics using OpenTelemetry standards, mapped to Prometheus exposition format.

#### Metric Taxonomy & Namespace Rules

- `empire_http_*`: HTTP transport and gateway metrics.
- `empire_economy_*`: Game progression, production, currency creation, and sinks.
- `empire_fraud_*`: Risk scoring, velocity spikes, and quarantine events.
- `empire_db_*`: Transaction latency, connection pool saturation, and row lock times.

#### Core Prometheus Metric Definitions

| Metric Name                            | Type      | Labels                                                     | Description                                                                                  |
| :------------------------------------- | :-------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `empire_http_requests_total`           | Counter   | `method`, `path`, `status_code`                            | Total HTTP requests handled by the edge API.                                                 |
| `empire_http_request_duration_seconds` | Histogram | `method`, `path`, `status_code`                            | Response latency distribution (buckets: 5ms, 15ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s). |
| `empire_active_users_current`          | Gauge     | `tier` (`guest`, `authenticated`, `pass_holder`)           | Estimated concurrently active sessions in 5-minute sliding window.                           |
| `empire_economy_cash_claimed_total`    | Counter   | `business_slug`, `source` (`active`, `offline`)            | Total game cash issued to players.                                                           |
| `empire_economy_cash_spent_total`      | Counter   | `business_slug`, `action` (`upgrade`)                      | Total game cash sunk via upgrades.                                                           |
| `empire_economy_sru_value`             | Gauge     | `season_id`                                                | Current dynamic Standard Reward Unit (100–500).                                              |
| `empire_missions_claimed_total`        | Counter   | `difficulty` (`easy`, `normal`, `hard`, `weekly`)          | Total completed mission rewards claimed.                                                     |
| `empire_streak_claims_total`           | Counter   | `day` (`1`..`7`), `cycle_bonus` (`true`, `false`)          | Daily streak claims executed.                                                                |
| `empire_fraud_flags_total`             | Counter   | `severity`, `primary_reason`                               | Total fraud signals emitted by detection engine.                                             |
| `empire_fraud_frozen_rewards_total`    | Counter   | `reward_type`, `action` (`frozen`, `approved`, `rejected`) | Quarantined reward claims lifecycle.                                                         |
| `empire_db_query_duration_seconds`     | Histogram | `rpc_name`, `status` (`ok`, `error`)                       | Latency of PostgREST RPC executions.                                                         |
| `empire_db_pool_connections_active`    | Gauge     | `pool_id`                                                  | Number of active checked-out database connections.                                           |

#### Prometheus Scrape & Remote Write Configuration

The edge runtime exposes Prometheus metrics at `/metrics` (restricted via IP allowlist and bearer token) and pushes to Prometheus Remote Write endpoints:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'empire-api'
    scheme: https
    bearer_token: '${PROMETHEUS_SCRAPE_BEARER_TOKEN}'
    static_configs:
      - targets: ['api.project-empire.game:443']
    metrics_path: '/metrics'
    tls_config:
      insecure_skip_verify: false

  - job_name: 'supabase-postgres'
    static_configs:
      - targets: ['db-exporter.internal.project-empire.game:9187']
```

---

### 2.2 Structured JSON Logging

All logs emitted by Cloudflare Workers and background handlers conform to strict JSON format for direct ingestion by Grafana Loki or Datadog.

#### JSON Log Schema

```json
{
  "timestamp": "2026-09-15T14:32:01.124Z",
  "level": "INFO",
  "service": "empire-api",
  "environment": "production",
  "requestId": "c7a8b412-f14d-4952-b883-9fa7d10e5bb1",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "userId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "telegramUserId": "847291039",
  "route": {
    "method": "POST",
    "path": "/economy/claim",
    "status": 200,
    "durationMs": 42.15
  },
  "client": {
    "ip": "203.0.113.42",
    "country": "TR",
    "userAgent": "Mozilla/5.0 (TelegramMiniApp/1.0)",
    "asn": 47524
  },
  "event": {
    "type": "cash_claim",
    "details": {
      "claimedAmount": 15420,
      "offlineCapSeconds": 14400,
      "isCapped": false,
      "newBalance": 182400
    }
  },
  "error": null
}
```

#### Sanitization and PII Scrubbing Rules

Log processors and edge middleware execute pre-emission redaction:

- Regex filter `initData=([^&]+)` replaces query auth payloads with `[REDACTED]`.
- Regex filter `telegram_payment_charge_id=([^&]+)` replaces billing charge IDs with `[REDACTED]`.
- Passwords, database connection URIs, and private JWT keys are stripped.

---

### 2.3 Distributed Tracing

Project Empire instruments end-to-end request tracing adhering to W3C Trace Context recommendations.

#### Trace Propagation Header Standards

- `traceparent`: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
- `tracestate`: `congo=t61rcWkgMzE,rojo=00f067a`

#### Span Hierarchy

```
[Client Request: POST /economy/upgrade]
  │
  ├── [Span 1: Auth Session Validation] (Edge Worker KV / Cache) - 1.2ms
  │     └─ Verify Session Cookie & Expiry
  │
  ├── [Span 2: PostgREST RPC Dispatch] (Network Round-Trip) - 18.5ms
  │     │
  │     ├── [Span 2.1: Transaction Begin & Row Lock] - 4.1ms
  │     │     └─ SELECT cash FROM player_balances WHERE user_id = $1 FOR UPDATE
  │     │
  │     ├── [Span 2.2: Business Level Calculation] - 0.8ms
  │     │     └─ Verification of next level cost against balance
  │     │
  │     ├── [Span 2.3: Mutation & Reward Ledger Insert] - 2.4ms
  │     │     └─ INSERT INTO reward_ledger (...)
  │     │
  │     └── [Span 2.4: Mission Progress Evaluation] - 3.2ms
  │           └─ UPDATE mission_instances SET progress = progress + 1
  │
  └── [Span 3: Response Serialization & Telemetry Flush] - 0.9ms
```

---

## 3. Core Business & Technical KPI Metrics

### 3.1 Daily Active Users (DAU)

#### Definition

Distinct unique player accounts that initiate at least one authenticated state-altering interaction (`auth_success`, `app_open`, `cash_claim`, `business_upgrade`, `mission_claim`, `streak_claim`) within a rolling 24-hour UTC boundary.

#### SQL Metric Calculation Query

```sql
-- Executed daily at 00:05 UTC for the preceding calendar day
SELECT
  date_trunc('day', created_at) AS metric_date,
  count(distinct user_id) AS dau_count
FROM public.analytics_events
WHERE created_at >= (current_date - interval '1 day')
  AND created_at < current_date
  AND user_id IS NOT NULL
GROUP BY 1;
```

#### Real-Time Prometheus Approximation (Sliding 24h)

```promql
count(count by (user_id) (rate(empire_http_requests_total{status="200", user_id!=""}[24h]) > 0))
```

#### Collection Cadence

- In-memory sliding counter: Updated continuously on edge.
- Database ledger persistence: Rollup committed daily into `public.daily_metrics.dau`.

---

### 3.2 Qualified Active Players (QAP)

#### Definition

High-engagement, non-sybil players required to establish economic stability. A player is qualified if they meet all three criteria:

1. Account age >= 3 calendar days.
2. Active on >= 3 distinct calendar days within the past 7 days.
3. Possesses at least one business tier >= Level 5 (or total empire levels >= 10).

#### SQL Metric Calculation Query

```sql
-- Hourly calculation to update economic scaling baseline
WITH recent_active_days AS (
  SELECT
    user_id,
    count(distinct date_trunc('day', created_at)) AS active_day_count
  FROM public.analytics_events
  WHERE created_at >= now() - interval '7 days'
    AND user_id IS NOT NULL
  GROUP BY user_id
  HAVING count(distinct date_trunc('day', created_at)) >= 3
),
qualified_progressions AS (
  SELECT
    pb.user_id
  FROM public.player_businesses pb
  GROUP BY pb.user_id
  HAVING max(pb.level) >= 5 OR sum(pb.level) >= 10
)
SELECT
  count(distinct r.user_id) AS qap_total
FROM recent_active_days r
JOIN qualified_progressions q ON q.user_id = r.user_id
JOIN public.users u ON u.id = r.user_id
WHERE u.status = 'active'
  AND u.risk_score < 75;
```

#### Collection Cadence

- Hourly snapshot stored in memory.
- Daily aggregation stored in `public.daily_metrics.qap`.

---

### 3.3 Standard Reward Unit (SRU)

#### Definition

Macro-economic reward index governing Season Point emissions. The SRU dynamically scales down as player count increases to control token inflation while guaranteeing a hard floor and ceiling:

$$\text{SRU} = \text{clamp}\left(\text{round}\left(\text{SRU}_{\text{base}} \times \left(\frac{\text{QAP}}{\text{Reference}_{\text{QAP}}}\right)^\alpha\right), \text{SRU}_{\text{min}}, \text{SRU}_{\text{max}}\right)$$

_Constants_: $\text{SRU}_{\text{base}} = 500$, $\text{Reference}_{\text{QAP}} = 100$, $\alpha = -0.10$, $\text{SRU}_{\text{min}} = 100$, $\text{SRU}_{\text{max}} = 500$.

#### SQL Verification Query

```sql
SELECT
  s.id AS season_id,
  s.name AS season_name,
  s.sru_snapshot,
  s.qap_snapshot,
  round(
    greatest(
      100,
      least(
        500,
        500 * power((greatest(s.qap_snapshot, 1)::numeric / 100.0), -0.10)
      )
    )
  ) AS calculated_expected_sru
FROM public.seasons s
WHERE s.status = 'active';
```

#### Collection Cadence

- Evaluated during season epoch changes and synchronized to `seasons.sru_snapshot`.
- Exposed as Prometheus gauge `empire_economy_sru_value`.

---

### 3.4 Error Rate (5xx Ratio)

#### Definition

Percentage of unhandled server exceptions (HTTP status codes 500 through 599) relative to all completed HTTP requests over a 5-minute sliding window.

#### Formula

$$\text{Error Rate} = \left( \frac{\sum \text{rate}(\text{empire\_http\_requests\_total}\{\text{status}=\sim"5.." \}[5\text{m}])}{\sum \text{rate}(\text{empire\_http\_requests\_total}[5\text{m}])} \right) \times 100\%$$

#### PromQL Query

```promql
(sum(rate(empire_http_requests_total{status=~"5.."}[5m])) / sum(rate(empire_http_requests_total[5m]))) * 100
```

#### Target SLA

- Normal operation: < 0.02%
- Warning limit: >= 0.20%
- Critical P1 limit: >= 1.00%

---

### 3.5 Latency Percentiles (p50, p95, p99)

#### Definition

The time in milliseconds within which 50%, 95%, and 99% of all API requests are fully served and returned to the client.

#### PromQL Formulas

```promql
# p50 Latency (Median)
histogram_quantile(0.50, sum(rate(empire_http_request_duration_seconds_bucket[5m])) by (le)) * 1000

# p95 Latency (SLA Boundary)
histogram_quantile(0.95, sum(rate(empire_http_request_duration_seconds_bucket[5m])) by (le)) * 1000

# p99 Latency (Tail Degradation Boundary)
histogram_quantile(0.99, sum(rate(empire_http_request_duration_seconds_bucket[5m])) by (le)) * 1000
```

#### Service Level Objectives (SLOs)

- `p50`: <= 50 ms
- `p95`: <= 150 ms
- `p99`: <= 300 ms

---

## 4. Health Check Probes

Project Empire provides dual health probes ensuring load balancers and orchestrators accurately determine service health without executing heavy database operations unnecessarily.

### 4.1 Liveness Probe (`GET /health/live` & `GET /health`)

#### Objective

Confirms the edge worker process is running and accepting event loop tasks. Must return in under 5ms.

#### Request & Response

```http
GET /health/live HTTP/1.1
Host: api.project-empire.game

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-cache, no-store, must-revalidate

{
  "apiVersion": "v1",
  "status": "ok",
  "service": "empire-api",
  "timestamp": "2026-09-15T14:35:00.000Z"
}
```

---

### 4.2 Readiness Probe (`GET /health/ready`)

#### Objective

Deep dependency verification. Confirms database connection pools, schema migration versions, and cache layers are fully operable before traffic is routed to the instance.

#### Probing Sequence

1. **PostgreSQL Connectivity**: Executes `SELECT 1;` with a 2000ms timeout.
2. **Schema Migration Integrity**: Validates the latest active migration table exists and reflects version `202609140009`.
3. **Connection Pool Saturation**: Queries active connection count; rejects if saturation > 95%.
4. **Redis / KV Edge Cache**: Issues `PING` to edge storage; verifies response within 100ms.

#### Healthy Response (HTTP 200)

```json
{
  "apiVersion": "v1",
  "status": "ready",
  "service": "empire-api",
  "timestamp": "2026-09-15T14:35:00.125Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 8.4,
      "activeConnections": 24,
      "maxPoolConnections": 100
    },
    "schema": {
      "status": "healthy",
      "currentMigration": "202609140009_missions_and_launch",
      "pendingCount": 0
    },
    "cache": {
      "status": "healthy",
      "latencyMs": 1.2
    }
  }
}
```

#### Degraded / Failure Response (HTTP 503)

```json
{
  "apiVersion": "v1",
  "status": "unhealthy",
  "service": "empire-api",
  "timestamp": "2026-09-15T14:35:00.125Z",
  "error": {
    "code": "DEPENDENCY_FAILURE",
    "message": "Database query timeout exceeded 2000ms"
  },
  "checks": {
    "database": {
      "status": "unhealthy",
      "latencyMs": 2001.5,
      "error": "CONNECTION_TIMEOUT"
    },
    "schema": {
      "status": "unknown"
    },
    "cache": {
      "status": "healthy",
      "latencyMs": 1.1
    }
  }
}
```

#### Kubernetes / Cloudflare Health Monitor Spec

```yaml
# cloudflare-probe-config.yaml
probe:
  url: 'https://api.project-empire.game/health/ready'
  interval: 10
  timeout: 3
  retries: 2
  expected_codes: [200]
  consecutive_successes: 2
  consecutive_fails: 3
```

---

## 5. Anomaly Alert Thresholds & Escalation Matrices

### 5.1 Alert Severity Hierarchy

| Severity          | Definition                                                                                                        | Initial Response SLA       | Notification Channels                               | Escalation Path                                    |
| :---------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------- | :-------------------------------------------------- | :------------------------------------------------- |
| **P1 - Critical** | Catastrophic failure: Game loop broken, database unreachable, active financial exploit, or 5xx > 1%.              | < 5 minutes (24/7)         | PagerDuty Voice Call, SMS, `#ops-incident-p1` Slack | On-Call SRE -> Lead Engineer -> Incident Commander |
| **P2 - Major**    | Impaired performance: Latency SLO breached, single subsystem degraded (e.g. referrals down, fraud rate elevated). | < 30 minutes (24/7)        | PagerDuty Push, `#ops-alerts-p2` Slack              | On-Call SRE -> Component Specialist                |
| **P3 - Warning**  | Drift or minor irregularity: Single IP anomaly, small deviation in mission completion rates.                      | < 4 hours (Business hours) | `#ops-telemetry` Slack, Daily Digest                | Queue for next on-call engineering shift           |

---

### 5.2 Concrete Alert Rules & Escalation Thresholds

#### Rule P1-01: Critical 5xx Error Spike

- **Condition**: Error rate > 1.0% for >= 5 consecutive minutes.
- **PromQL Alert**:
  ```promql
  ((sum(rate(empire_http_requests_total{status=~"5.."}[5m])) / sum(rate(empire_http_requests_total[5m]))) * 100) > 1.0
  ```
- **Action Playbook**:
  1. Inspect Loki logs: `rate({service="empire-api"} |= "level: ERROR" [1m])`.
  2. If errors originate from DB timeouts, execute Readiness Check `GET /health/ready`.
  3. If DB deadlock or failure, trigger **Maintenance Mode Circuit Breaker** (`ROLLBACK_PLAN.md § 4.2`).

#### Rule P1-02: Tail Latency SLA Collapse

- **Condition**: p99 Latency > 500ms for >= 5 consecutive minutes.
- **PromQL Alert**:
  ```promql
  histogram_quantile(0.99, sum(rate(empire_http_request_duration_seconds_bucket[5m])) by (le)) > 0.500
  ```
- **Action Playbook**:
  1. Inspect PostgREST active query table:
     ```sql
     SELECT pid, now() - query_start AS duration, query, state
     FROM pg_stat_activity
     WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;
     ```
  2. Check for missing indexes or locks on `player_balances` or `mission_instances`.
  3. Kill unindexed blocking queries if detected.

#### Rule P1-03: Economic Currency Creation Anomaly (Exploit Detection)

- **Condition**: Cash claimed per minute exceeds physical maximum theoretical global production by > 200%.
- **PromQL Alert**:
  ```promql
  sum(rate(empire_economy_cash_claimed_total[5m])) > (10 * sum(empire_economy_total_theoretical_production_rate))
  ```
- **Action Playbook**:
  1. Immediate emergency kill-switch: Disable offline claim routes via feature flag or maintenance switch.
  2. Query `reward_ledger` for top recipients in last 15 minutes:
     ```sql
     SELECT user_id, sum(delta_cash) AS total_gained
     FROM public.reward_ledger
     WHERE created_at > now() - interval '15 minutes'
     GROUP BY user_id ORDER BY total_gained DESC LIMIT 20;
     ```
  3. Suspend identified exploit accounts via `UPDATE users SET status = 'suspended' WHERE id IN (...)`.

#### Rule P2-01: Fraud Quarantine Spike

- **Condition**: Quarantined rewards exceed 5% of total reward claims over 15 minutes.
- **PromQL Alert**:
  ```promql
  (sum(rate(empire_fraud_frozen_rewards_total{action="frozen"}[15m])) / sum(rate(empire_missions_claimed_total[15m]) + rate(empire_streak_claims_total[15m]))) * 100 > 5.0
  ```
- **Action Playbook**:
  1. Review flagged entries in `public.fraud_flags`:
     ```sql
     SELECT reason_codes, count(*)
     FROM public.fraud_flags
     WHERE created_at > now() - interval '1 hour'
     GROUP BY reason_codes ORDER BY count DESC;
     ```
  2. If false-positive cascade from legitimate game patch, adjust risk threshold in `packages/game-core/src/fraud.ts`.

#### Rule P2-02: Database Connection Pool Exhaustion Warning

- **Condition**: Active connections exceed 85% of pool capacity for 3 minutes.
- **PromQL Alert**:
  ```promql
  (empire_db_pool_connections_active / 100) * 100 > 85.0
  ```
- **Action Playbook**:
  1. Inspect long-lived transactions or connection leaks.
  2. Restart PostgREST connection poolers if connections are in `idle in transaction`.

---

### 5.3 Prometheus Alertmanager Configuration (`alerting_rules.yml`)

```yaml
groups:
  - name: empire_production_alerts
    rules:
      - alert: EmpireHighErrorRateP1
        expr: ((sum(rate(empire_http_requests_total{status=~"5.."}[5m])) / sum(rate(empire_http_requests_total[5m]))) * 100) > 1.0
        for: 5m
        labels:
          severity: p1
          component: edge_api
        annotations:
          summary: "Empire API 5xx error rate is {{ $value | printf '%.2f' }}% (> 1.0%)"
          description: 'High volume of HTTP 5xx responses detected. Potential database or downstream collapse.'
          runbook_url: 'https://github.com/project-empire/docs/ops/MONITORING.md#rule-p1-01-critical-5xx-error-spike'

      - alert: EmpireTailLatencyBreachedP1
        expr: histogram_quantile(0.99, sum(rate(empire_http_request_duration_seconds_bucket[5m])) by (le)) > 0.500
        for: 5m
        labels:
          severity: p1
          component: edge_api
        annotations:
          summary: "API p99 latency is {{ $value | printf '%.3f' }}s (> 500ms)"
          description: 'Tail latency has severely degraded, breaching user SLA.'
          runbook_url: 'https://github.com/project-empire/docs/ops/MONITORING.md#rule-p1-02-tail-latency-sla-collapse'

      - alert: EmpireDatabasePoolNearExhaustionP2
        expr: (empire_db_pool_connections_active / 100) * 100 > 85.0
        for: 3m
        labels:
          severity: p2
          component: database
        annotations:
          summary: "Database connection pool usage at {{ $value | printf '%.1f' }}%"
          description: 'Connection pool is approaching saturation (85%). Risk of client timeouts.'
          runbook_url: 'https://github.com/project-empire/docs/ops/MONITORING.md#rule-p2-02-database-connection-pool-exhaustion-warning'

      - alert: EmpireAbnormalCashVelocityP1
        expr: sum(rate(empire_economy_cash_claimed_total[5m])) > 100000000
        for: 2m
        labels:
          severity: p1
          component: economy
        annotations:
          summary: 'Cash emission rate {{ $value }} exceeds safe velocity ceiling'
          description: 'Possible unlimited cash duplication or offline claim exploit active.'
          runbook_url: 'https://github.com/project-empire/docs/ops/MONITORING.md#rule-p1-03-economic-currency-creation-anomaly-exploit-detection'
```

---

## 6. Verification and Audit Commands

To verify telemetry infrastructure health from the CLI:

```bash
# 1. Verify Edge Liveness Probe
curl -i https://api.project-empire.game/health/live

# 2. Verify Edge Readiness Probe (Deep DB & Migration Check)
curl -i https://api.project-empire.game/health/ready

# 3. Pull Prometheus Metrics (Authenticated)
curl -s -H "Authorization: Bearer ${PROMETHEUS_SCRAPE_BEARER_TOKEN}" https://api.project-empire.game/metrics | grep empire_

# 4. Check PostgREST Database Latency
curl -w "DNS: %{time_namelookup}s | Connect: %{time_connect}s | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" \
  -o /dev/null -s https://api.project-empire.game/health/ready
```
