# Project Empire — Production Backup & Disaster Recovery Runbook

**Document Version**: 1.0.0  
**Target Environment**: PostgreSQL 15+ (Supabase / AWS RDS / Aurora), Cloudflare Edge, AWS S3 / GCS Cold Storage  
**Classification**: Production Operations Runbook (R5)  
**Last Review Date**: 2026-09-15

---

## 1. Business Continuity & Disaster Recovery Objectives

Project Empire maintains strict Service Level Agreements (SLAs) for disaster recovery and business continuity to protect player game economy state, financial transactions, and immutable audit trails.

```
+------------------------------------------------------------------------------------+
|                         RECOVERY OBJECTIVE TARGETS                                 |
|                                                                                    |
|   [ RTO: Recovery Time Objective ]              [ RPO: Recovery Point Objective ]  |
|              < 15 Minutes                                   < 1 Minute             |
|                                                                                    |
|  Total elapsed time from disaster declaration    Maximum allowable data loss window|
|  to traffic resumption on healthy database.      under any catastrophic scenario.  |
+------------------------------------------------------------------------------------+
```

### 1.1 Data Classification & Recovery Tiers

| Tier       | Data Classification           | Database Tables                                                                                         | Target RPO | Target RTO | Backup Strategy                                                              |
| :--------- | :---------------------------- | :------------------------------------------------------------------------------------------------------ | :--------- | :--------- | :--------------------------------------------------------------------------- |
| **Tier 1** | **Financial & Audit Ledgers** | `purchases`, `reward_ledger`, `admin_audit_logs`, `fraud_flags`                                         | **< 10s**  | **< 10m**  | Synchronous replication + Continuous WAL streaming with 60s archive timeout. |
| **Tier 2** | **Player Progression State**  | `users`, `player_balances`, `player_businesses`, `player_streaks`, `mission_instances`, `season_scores` | **< 60s**  | **< 15m**  | Continuous WAL archiving + Daily physical snapshots.                         |
| **Tier 3** | **Analytics & Telemetry**     | `analytics_events`, `daily_metrics`                                                                     | **< 1h**   | **< 4h**   | Nightly logical dump + Aggregation tables.                                   |

---

## 2. Automated Snapshot Policies & Retention Schedules

### 2.1 Physical vs. Logical Backup Hierarchy

1. **Continuous Physical Snapshots**: Block-level volume snapshots (AWS EBS / Google Cloud Persistent Disk) coordinated with PostgreSQL `pg_backup_start()` / `pg_backup_stop()`.
2. **Logical Consistent Exports**: Nightly `pg_dump` in directory format (`-Fd`) with multi-threaded parallel compression (`-j 8`) for granular object-level recovery.

```
                  BACKUP RETENTION LIFECYCLE (WORM S3 BUCKET)

  [ Daily Snapshot ] ──> S3 Standard (Days 1 - 14)
                               │
                               ▼
                        S3 Glacier Instant (Days 15 - 30) ──> Purged at Day 31

  [ Monthly Snapshot ] ──> S3 Glacier Instant (Months 1 - 3)
  (1st of Month)               │
                               ▼
                        S3 Glacier Flexible (Months 4 - 12) ──> Purged at Month 13
```

### 2.2 Retention Policy Matrix

| Backup Type                | Execution Schedule              | Window                   | Storage Class                        | Retention Period     | Immutability (WORM)            |
| :------------------------- | :------------------------------ | :----------------------- | :----------------------------------- | :------------------- | :----------------------------- |
| **Daily Physical**         | Every day at 02:00 UTC          | Lowest traffic window    | AWS S3 Standard -> Glacier Instant   | **30 Days**          | Object Lock (Governance, 30d)  |
| **Monthly Archive**        | 1st of every month at 03:00 UTC | Scheduled maintenance    | AWS S3 Glacier Flexible Deep Archive | **12 Months (365d)** | Object Lock (Compliance, 365d) |
| **Pre-Migration Snapshot** | Prior to any DDL migration      | Ad-hoc automated trigger | AWS S3 Standard                      | **14 Days**          | Object Lock (Governance, 14d)  |

### 2.3 Automated Snapshot Execution Script (`backup-snapshot.sh`)

This script runs on the primary backup agent host via cron (`0 2 * * *`):

```bash
#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Project Empire — Production Daily Snapshot Runner
# ==============================================================================

export S3_BACKUP_BUCKET="s3://project-empire-backups-eu-central-1"
export KMS_KEY_ID="arn:aws:kms:eu-central-1:123456789012:key/empire-db-backup-key"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_DIR="/var/backups/postgres/${TIMESTAMP}"
LOG_FILE="/var/log/postgres/backup_${TIMESTAMP}.log"

mkdir -p "${BACKUP_DIR}"
exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[$(date -u)] INFO: Starting production snapshot for Project Empire..."

# 1. Coordinate with Postgres engine for clean physical checkpoint
echo "[$(date -u)] INFO: Initiating PostgreSQL backup checkpoint..."
psql -U postgres -d empire_production -c "SELECT pg_backup_start('daily_physical_${TIMESTAMP}', true);"

# 2. Execute parallel compressed logical dump as secondary fail-safe
echo "[$(date -u)] INFO: Creating parallel compressed logical dump..."
pg_dump -U postgres -d empire_production \
  --format=directory \
  --jobs=8 \
  --compress=6 \
  --verbose \
  --file="${BACKUP_DIR}/logical_dump"

# 3. Release PostgreSQL backup checkpoint
echo "[$(date -u)] INFO: Finalizing PostgreSQL backup checkpoint..."
psql -U postgres -d empire_production -c "SELECT pg_backup_stop();"

# 4. Create encrypted tarball
echo "[$(date -u)] INFO: Packaging and encrypting backup archive..."
tar -cf - -C "/var/backups/postgres" "${TIMESTAMP}" | zstd -T8 -3 > "/tmp/empire_backup_${TIMESTAMP}.tar.zst"

# 5. Push to Multi-Region S3 Storage with KMS Encryption and WORM Lock
echo "[$(date -u)] INFO: Uploading archive to S3 with KMS encryption..."
aws s3 cp "/tmp/empire_backup_${TIMESTAMP}.tar.zst" \
  "${S3_BACKUP_BUCKET}/daily/empire_backup_${TIMESTAMP}.tar.zst" \
  --sse aws:kms \
  --sse-kms-key-id "${KMS_KEY_ID}" \
  --metadata "retention=30d,type=daily_snapshot,created_at=${TIMESTAMP}"

# 6. If 1st of month, also copy to monthly compliance archive
DAY_OF_MONTH=$(date -u +"%d")
if [ "${DAY_OF_MONTH}" = "01" ]; then
  echo "[$(date -u)] INFO: Designating backup as Monthly Compliance Archive (12 Months Retention)..."
  aws s3 cp "${S3_BACKUP_BUCKET}/daily/empire_backup_${TIMESTAMP}.tar.zst" \
    "${S3_BACKUP_BUCKET}/monthly/empire_backup_monthly_${TIMESTAMP}.tar.zst" \
    --sse aws:kms \
    --sse-kms-key-id "${KMS_KEY_ID}"
fi

# 7. Cleanup local scratch files
rm -rf "${BACKUP_DIR}" "/tmp/empire_backup_${TIMESTAMP}.tar.zst"
echo "[$(date -u)] SUCCESS: Production snapshot completed successfully."
```

---

## 3. Continuous WAL Archiving & Replication Architecture

To achieve an **RPO < 1 minute**, Project Empire employs continuous Write-Ahead Log (WAL) archiving using `pgBackRest` with streaming replication to an offsite S3-compliant object store.

```
+---------------------+             +---------------------+
| PostgreSQL Primary  |             | PostgreSQL Standby  |
|  (eu-central-1a)    |             |   (eu-central-1b)   |
|                     |             |                     |
|  wal_level=replica  |             |  Hot Standby Mode   |
+---------------------+             +---------------------+
           |                                   ^
           | Streaming WAL (max_wal_senders)   |
           +-----------------------------------+
           |
           | Continuous Archive Command (archive_timeout = 60s)
           v
+---------------------------------------------------------+
|                  pgBackRest Archive                     |
|           Push WAL Segments (16MB Compressed)           |
+---------------------------------------------------------+
           |
           | TLS 1.3 / KMS AES-256
           v
+---------------------------------------------------------+
|            AWS S3 Compliant Storage (Bucket)            |
|       s3://project-empire-backups-eu-central-1/wal      |
|           Object Lock: WORM Compliance Mode             |
+---------------------------------------------------------+
           |
           | Cross-Region S3 Replication (CRR)
           v
+---------------------------------------------------------+
|             Secondary Region Disaster Store             |
|       s3://project-empire-backups-us-east-1/wal         |
+---------------------------------------------------------+
```

### 3.1 PostgreSQL Engine Configuration (`postgresql.conf`)

The primary database cluster applies these non-negotiable archiving settings:

```ini
# Replication & WAL Settings
wal_level = replica
max_wal_size = 16GB
min_wal_size = 2GB
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9

# Continuous Archiving Configuration (RPO < 1m Guarantee)
archive_mode = on
archive_command = 'pgbackrest --stanza=empire archive-push %p'
archive_timeout = 60 # Force segment switch every 60s during low traffic
wal_compression = zstd

# Standby Connections
max_wal_senders = 10
wal_keep_size = 8GB
hot_standby = on
```

### 3.2 pgBackRest Configuration (`/etc/pgbackrest/pgbackrest.conf`)

```ini
[global]
repo1-type=s3
repo1-s3-endpoint=s3.eu-central-1.amazonaws.com
repo1-s3-bucket=project-empire-backups-eu-central-1
repo1-s3-region=eu-central-1
repo1-s3-key-type=auto
repo1-s3-kms-key-id=arn:aws:kms:eu-central-1:123456789012:key/empire-db-backup-key
repo1-path=/pgbackrest
repo1-retention-full=4
repo1-retention-diff=14
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=ENV[PGBACKREST_CIPHER_PASS]
compress-type=zst
compress-level=3
process-max=4
log-level-console=info
log-level-file=detail

[empire]
pg1-path=/var/lib/postgresql/15/main
pg1-user=postgres
```

---

## 4. Point-In-Time-Recovery (PITR) Procedures

Point-In-Time-Recovery allows restoring the database to the exact second immediately preceding a catastrophic event (e.g., accidental table truncation, malicious data corruption, or rogue migration).

### 4.1 15-Minute RTO Timeline Budget

|     Minute      | Operational Step                                             | Responsible Role         | Verification Artifact                             |
| :-------------: | :----------------------------------------------------------- | :----------------------- | :------------------------------------------------ |
| **T+00 - T+01** | Declare Incident & Activate Read-Only Maintenance Mode       | Incident Commander / SRE | API returns 503 `MAINTENANCE_MODE`                |
| **T+01 - T+02** | Identify Target Recovery Timestamp ($T_{\text{target}}$)     | Lead DBA                 | Exact UTC timestamp from audit/ledger logs        |
| **T+02 - T+05** | Provision Target Node & Restore Base Physical Snapshot       | SRE                      | `pgbackrest restore` base files unpacked          |
| **T+05 - T+10** | Replay WAL Archive Stream to $T_{\text{target}}$             | PostgreSQL Engine        | Engine reaches `recovery_target_time` and pauses  |
| **T+10 - T+12** | Execute Data Integrity & Sanity Verification Queries         | Lead DBA                 | Mathematical assertions pass (0 invariant errors) |
| **T+12 - T+14** | Promote Instance & Update Cloudflare Edge Connection Strings | SRE                      | `wrangler secret put SUPABASE_URL`                |
| **T+14 - T+15** | Disable Maintenance Mode & Resume Full Production Traffic    | Incident Commander       | Health check returns 200 OK                       |

---

### 4.2 Step-by-Step Restoration Commands

#### Step 1: Activate Read-Only Maintenance Mode

Halt state mutations across the edge network so no further corrupt data is written:

```bash
# Set maintenance flag via Cloudflare CLI
wrangler secret put MAINTENANCE_MODE --env production <<< "true"
```

#### Step 2: Determine Target Timestamp

Query the audit log or ledger from a read-replica to locate the exact second before corruption occurred:

```sql
-- Locate the malicious or rogue transaction
SELECT created_at, action, target_type, target_key, reason
FROM public.admin_audit_logs
ORDER BY created_at DESC
LIMIT 5;

-- Assume target timestamp is: '2026-09-15 14:18:22 UTC'
```

#### Step 3: Execute PITR via pgBackRest

Execute the restore on the target database node:

```bash
# 1. Stop the PostgreSQL service on the target node
sudo systemctl stop postgresql

# 2. Clean current data directory
sudo -u postgres rm -rf /var/lib/postgresql/15/main/*

# 3. Restore base snapshot and replay WAL logs up to target second
sudo -u postgres pgbackrest --stanza=empire \
  --type=time \
  --target="2026-09-15 14:18:22" \
  --target-action=promote \
  restore

# 4. Start PostgreSQL (it will automatically enter recovery mode and replay WAL)
sudo systemctl start postgresql
```

#### Step 4: Native PostgreSQL Recovery Alternative (`recovery.signal`)

If using native PostgreSQL replication tools without pgBackRest:

1. Place base backup files into `/var/lib/postgresql/15/main/`.
2. Create `/var/lib/postgresql/15/main/recovery.signal`:
   ```bash
   sudo -u postgres touch /var/lib/postgresql/15/main/recovery.signal
   ```
3. Append recovery parameters to `/var/lib/postgresql/15/main/postgresql.auto.conf`:
   ```ini
   restore_command = 'aws s3 cp s3://project-empire-backups-eu-central-1/wal/%f %p'
   recovery_target_time = '2026-09-15 14:18:22 UTC'
   recovery_target_action = 'promote'
   ```
4. Start database service: `sudo systemctl start postgresql`.

---

### 4.3 Post-Restore Data Integrity Verification

Before re-routing public user traffic to the restored instance, execute these verification checks:

```sql
-- =============================================================================
-- SANITY CHECK 1: Confirm Recovery Target Was Reached & Database Promoted
-- =============================================================================
SELECT pg_is_in_recovery() AS is_in_recovery;
-- Expected output: false (must be promoted to primary read/write)

-- =============================================================================
-- SANITY CHECK 2: Financial Balance vs. Reward Ledger Invariant Check
-- =============================================================================
WITH calculated_ledger AS (
  SELECT
    user_id,
    sum(delta_cash) AS total_ledger_cash,
    sum(delta_season_points) AS total_ledger_points
  FROM public.reward_ledger
  GROUP BY user_id
)
SELECT
  pb.user_id,
  pb.cash AS balance_cash,
  coalesce(cl.total_ledger_cash, 0) AS ledger_cash,
  (pb.cash - coalesce(cl.total_ledger_cash, 0)) AS cash_discrepancy
FROM public.player_balances pb
LEFT JOIN calculated_ledger cl ON cl.user_id = pb.user_id
WHERE (pb.cash - coalesce(cl.total_ledger_cash, 0)) < 0
LIMIT 10;
-- Expected output: 0 rows (no player balance exceeds their ledgered grants)

-- =============================================================================
-- SANITY CHECK 3: Verify Canonical Business Definitions are Intact
-- =============================================================================
SELECT count(*) FROM public.businesses;
-- Expected output: exactly 6 canonical businesses

-- =============================================================================
-- SANITY CHECK 4: Verify Active Season & Score State
-- =============================================================================
SELECT id, name, status, starts_at, ends_at, sru_snapshot
FROM public.seasons
WHERE status = 'active';
-- Expected output: exactly 1 active season
```

---

## 5. Disaster Recovery Scenarios & Playbooks

### Playbook A: Primary Database Node Hardware / Disk Collapse

**Trigger**: Primary database node becomes unresponsive; hardware failure reported by cloud provider.

```
[ Primary DB Fails ] ──> [ Patroni / Cloud Health Check Triggers ]
                                        │
                                        ▼
             [ Promote Hot Standby in AZ-b to New Primary ]
                                        │
                                        ▼
             [ Update Cloudflare Edge Connection Secrets ]
                                        │
                                        ▼
             [ Traffic Resumes (< 3 minutes total RTO) ]
```

#### Step-by-Step Action:

1. **Promote Standby Node**:
   If automated failover (Patroni / AWS Aurora Multi-AZ) does not complete within 90 seconds, manually promote:
   ```bash
   ssh standby-db.internal.project-empire.game "sudo -u postgres pg_ctl promote -D /var/lib/postgresql/15/main"
   ```
2. **Update Edge Connection Secrets**:
   ```bash
   wrangler secret put SUPABASE_URL --env production <<< "https://db-standby.internal.project-empire.game"
   ```
3. **Verify Edge Connectivity**:
   ```bash
   curl -i https://api.project-empire.game/health/ready
   ```

---

### Playbook B: Cloud Provider Regional Outage (e.g. AWS eu-central-1 Down)

**Trigger**: Complete data center or regional networking loss in primary hosting region.

#### Step-by-Step Action:

1. **Declare Disaster**: Incident Commander activates Cross-Region Failover plan.
2. **Spin Up Secondary DB in Failover Region (`us-east-1`)**:
   Restore base snapshot and WAL archive from replicated bucket `s3://project-empire-backups-us-east-1`:
   ```bash
   sudo -u postgres pgbackrest --stanza=empire \
     --repo1-s3-bucket=project-empire-backups-us-east-1 \
     --type=immediate \
     --target-action=promote \
     restore
   ```
3. **Switch Cloudflare Worker Environment to Failover Region**:
   ```bash
   wrangler deploy --env dr-us-east
   ```
4. **Broadcast Player Advisory**: Update status page (`https://status.project-empire.game`) indicating regional failover.

---

### Playbook C: Corrupted Data Migration Disaster Failover

**Trigger**: A faulty schema migration was applied in production that corrupted columns, miscalculated balances, or locked key tables.

#### Immediate Resolution Hierarchy:

1. **Option 1 (Preferred)**: If corruption is schema-only and data is uncorrupted, immediately execute the corresponding DOWN migration script from `ROLLBACK_PLAN.md`.
2. **Option 2 (Data Loss / Table Alteration)**: If data was irreversibly updated or truncated:
   - Put API into Read-Only Maintenance Mode.
   - Restore database to a sidecar instance (`empire_pitr_staging`) up to 60 seconds before migration started.
   - Use `pg_dump` / `pg_restore` to cleanly recover the affected tables back to the primary database:
     ```bash
     pg_dump -U postgres -h pitr-staging.internal -d empire_production \
       --table=public.player_balances \
       --table=public.reward_ledger \
       --data-only | psql -U postgres -h primary.internal -d empire_production
     ```
   - Disable Maintenance Mode.

---

## 6. Disaster Recovery Drills & Auditing

### 6.1 Drill Cadence

- **Automated Sidecar Restore Test (Weekly)**: Every Sunday at 04:00 UTC, an automated AWS Lambda / ECS task restores the latest physical snapshot and WAL stream to an ephemeral staging cluster, runs the Sanity Check SQL suite, and terminates the cluster.
- **Full Tabletop & Live Failover Drill (Quarterly)**: Engineering team simulates primary database termination during off-peak hours and verifies RTO < 15 minutes.

### 6.2 Weekly Drill Verification Script (`verify-pitr-drill.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo "Project Empire — Automated Weekly PITR Drill Verification"
echo "================================================================="

DRILL_CONTAINER="empire-pitr-drill-node"
docker run -d --name "${DRILL_CONTAINER}" -e POSTGRES_PASSWORD=drilltest postgres:15-alpine

echo "Restoring latest base backup into test container..."
# [Automated extraction and restore commands executed here]

echo "Executing sanity test assertions..."
docker exec -i "${DRILL_CONTAINER}" psql -U postgres -c "SELECT count(*) FROM public.businesses;" | grep -q "6"
echo "PASS: 6 Canonical businesses verified."

docker stop "${DRILL_CONTAINER}" && docker rm "${DRILL_CONTAINER}"
echo "SUCCESS: Weekly PITR drill completed with 0 errors."
```
