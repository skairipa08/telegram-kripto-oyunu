## 2026-09-17T11:04:10Z
You are Challenger 1 (teamwork_preview_challenger).

## Identity & Paths
- Your working directory: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_o12_1`
- Parent Orchestrator ID: `4fb5c810-ec2d-4451-a45c-639a7bf5c7c7`
- Project Workspace Root: `c:\Users\Administrator\Desktop\telegram kripto oyunu`
- Path to User Request: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md` (see timestamp section `## 2026-09-17T10:50:36Z`)
- Path to Project Architecture: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_12\PROJECT.md`
- Paths to Worker Handoffs:
  - `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o12_stream1\handoff.md`
  - `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o12_stream2\handoff.md`

## Mission & Scope: Adversarial Math Challenge
Empirically verify and stress test the mathematical models:
1. **Crypto Mines**:
   - Verify multiplier formula $(1 - 0.03) \times \prod_{i=0}^{k-1} \frac{25-i}{25-m-i}$ for all valid $m \in [1..24]$ and $k \in [1..25-m]$.
   - Fuzz the Fisher-Yates shuffle generator (`generateMineLocations`) over 1,000+ iterations: verify zero duplicate indices within any generated board, verify indices strictly inside $[0..24]$, and verify `excludeIndex` is strictly never chosen.
   - Verify that bust always results in 0 payout, and cashout matches exact formula floor.
2. **Crypto Predictions**:
   - Verify payout formula `Math.floor(stake * odds)` across boundary values and extreme stakes.
   - Verify bookmaker overround margins across all 7 markets in `INITIAL_PREDICTION_MARKETS` ($1/\text{yesOdds} + 1/\text{noOdds} > 1.0$).
   - Verify stake validation (rejecting negative, non-integer, < 50, > balance).
3. **Turnover & Referral Commission**:
   - Verify 0.1% kickback on 1,000,000 turnover yields exactly 1,000 cash.
   - Verify commission rates: 0-10 invites -> 3%, 11-30 invites -> 5%, 31+ invites -> 7% with zero off-by-one errors at 10, 11, 30, 31.
   - Verify `calculatePassiveCommission` with 1M cash yields exactly 30K, 50K, 70K.
4. **Execution & Report**:
   - Run vitest tests or create temporary test harness if needed.
   - Write your adversarial findings and final verdict (`APPROVE` or `REJECT`) to `handoff.md` in your working directory.
   - Send completion message to parent.
