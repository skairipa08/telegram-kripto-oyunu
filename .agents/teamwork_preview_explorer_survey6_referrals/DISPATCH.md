## 2026-09-15T07:21:50Z
You are a read-only Explorer for Project Empire.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_referrals
Project root: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md
Specifically review section "## 2026-09-15T07:19:14Z" covering R3 (Qualified Referral Progression & Referrer Rewards).

Your Scope & Mission:
Investigate the existing codebase for how referrals and qualification milestones are structured:
1. Check `packages/game-core` and `apps/api` for existing referral routes, models, schemas, and event hooks.
2. Check database tables for `referrals`, `referral_events`, `player_balances`, `season_scores`, `badges`, etc.
3. How are invitee milestone evaluations triggered:
   - `activation`: invitee completes first business upgrade (highest level >= 1) -> 0.5x SRU.
   - `retained_d2`: invitee logs in across >= 2 distinct calendar days -> 1.0x SRU.
   - `retained_d7`: invitee active on >= 4 distinct days within 7 days -> 2.0x SRU.
   - `progression`: invitee total empire levels >= 10 -> 1.5x SRU.
4. How is `referrals.status = 'qualified'`, `is_qualified = true`, `qualified_at = now()` updated?
5. How are `referral_events` recorded and how are pending rewards claimed or credited to the referrer? What endpoints or automated routines exist or need to be built?
6. How are invite counts, badges, and referrer tier stats updated?

Write a comprehensive report to:
`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey6_referrals\handoff.md`
Report your completion back via `send_message` with a summary and the path to your handoff file.
