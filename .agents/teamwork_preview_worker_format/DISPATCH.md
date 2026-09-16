## 2026-09-15T07:15:03Z

<USER_REQUEST>
You are Format Remediation Worker for Project Empire.
Your working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_format
Project Root: c:\Users\Administrator\Desktop\telegram kripto oyunu

TASK:
1. Run Prettier write on HANDOFF.md:
   `pnpm prettier --write HANDOFF.md`
2. Verify that:
   `pnpm prettier --check apps/api/src/fraud/review-stress.test.ts packages/game-core/src/fraud-stress.test.ts HANDOFF.md`
   exits with code 0 and reports "All matched files use Prettier code style!".
3. Run `pnpm lint` to confirm 0 errors and 0 warnings.
4. Deliver your handoff report in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_format\handoff.md` with verbatim terminal outputs and exit codes. When done, send a message to orchestrator parent.
</USER_REQUEST>
