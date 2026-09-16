## 2026-09-16T11:43:04Z

You are teamwork_preview_challenger_1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_1
Your identity: teamwork_preview_challenger_1
Authoritative User Request: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (MUST read the entire file, especially the latest section dated 2026-09-16T11:18:25Z).
Master Project Architecture: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Stream 1 Worker Handoff: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream1\handoff.md

OBJECTIVE:
Empirically stress-test, adversarially probe, and challenge the Stream 1 implementation (Core Math Models, Invariants, Simulation & API Routes).

CHALLENGE TEST VECTORS:
1. Notcoin Tap Energy Conservation & Overflow Stress:
   - Can energy ever exceed maxEnergy or go below 0?
   - Test tap calculations with extreme values (tap count = 0, tap count = 10^6, energy = 0, elapsed time = 10^8 seconds). Does any combination yield NaN, Infinity, or negative balances?
   - Can the offline TapBot accumulator generate more taps than mathematically possible from accumulated energy? Verify that bot taps <= initial energy + regenerated energy.
   - Verify Telegram Stars SKUs: ensure seasonPointsMultiplier is permanently 1.0 (anti-P2W guardrail).
2. Catizen Merge Invariant & Fuzzing:
   - Super-linearity: Assert R_{k+1} > 2 * R_k for all tiers 1 to 12.
   - Auto-Merge Macro Solver Termination: Fuzz 1,000 randomized 12-slot boards. Prove it terminates in <= 11 steps without infinite loops, and that no unmerged pairs of the same tier remain on the board.
   - Parcel unboxing distribution: verify 75% T1, 20% T2, 5% T3 distribution.
3. Crypto Crash Provably Fair & RTP Currency Sink Invariant:
   - Verify HMAC-SHA256 Pareto distribution determinism (same seed + clientSeed + nonce yields identical multiplier).
   - Monte Carlo proof: Run 10,000+ rounds across cashout multipliers (1.5x, 2.0x, 5.0x, 10.0x) and verify player RTP is strictly 97.0% +/- 0.5% (3.0% house edge). Prove that hyperinflation is mathematically impossible.
4. API Security & Idempotency:
   - Verify 401 Unauthorized for unauthenticated requests on all 11 arcade endpoints.
   - Verify that repeated requests with the same requestId return identical responses without duplicate balance deduction or crediting.
5. Execute Test Commands:
   - Run `pnpm vitest run packages/game-core`
   - Run `pnpm vitest run apps/api/src/arcade/`
   - Document commands and verbatim outputs.

OUTPUT:
Write your report to:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_1\handoff.md
Include unambiguous verdict: `VERDICT: APPROVE` or `VERDICT: REQUEST_CHANGES`.
When done, send a message to orchestrator with verdict and handoff path.
