## 2026-09-14T13:05:25Z
You are a teamwork_preview_challenger (Starter Flow & API Challenger).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_1_iter2
Project workspace: c:\Users\Administrator\Desktop\telegram kripto oyunu

MANDATORY FIRST STEP: Read c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md (specifically the section starting at ## 2026-09-14T12:46:12Z) and c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_2\PROJECT.md.

Your Mission:
Adversarially challenge and stress-test the onboarding starter grant flow, database triggers, and API endpoints.
1. Write and execute stress scripts or empirical test cases for:
   - New user creation with and without referral binding: ensure no user can ever exist with 0 cash and 0 production.
   - PGlite database trigger `trigger_new_user_starter_economy` and RPC `empire_init_player_economy` concurrency, idempotency, and edge cases.
   - API endpoints `GET /economy/roi` and `GET /economy/simulation` with missing params, invalid tokens, extreme query inputs, and high-volume requests.
2. Run tests to confirm zero regressions in existing 137 tests.
3. Write your findings and adversarial results to `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_1_iter2\handoff.md`.
Include an explicit verdict: APPROVE or CHALLENGE_FAILED. Send a message to parent when done.
