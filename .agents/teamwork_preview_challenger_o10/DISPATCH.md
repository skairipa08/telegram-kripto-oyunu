## 2026-09-16T12:57:55Z
<USER_REQUEST>
You are the Empirical Challenger.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_o10
Please maintain your progress in progress.md inside your directory.

MANDATORY FIRST STEP: Read the user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md under timestamp ## 2026-09-16T12:42:13Z.

Review the worker reports:
- Stream 1 Worker Handoff: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o10_stream1\handoff.md`
- Stream 2 Worker Handoff: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o10_stream2\handoff.md`

Your Mission:
1. Write and run empirical stress tests, oracles, and fuzzers to challenge:
   - Free-range stake validation (`validateCrashStake`): negative numbers, floats, NaN, zero balance, exact balance, numbers exceeding balance, extreme numbers ($10^{15}$).
   - Adaptive crash curve under adversarial betting patterns:
     - Steady modest bets: verify high win rate / low early dump rate ($P(M < 1.50) \approx 35\%$).
     - Sudden spike bets (>2.5x average): verify early dump rate escalates to $70\%-80\%$, protecting the house edge.
     - Martingale jumps after consecutive wins: verify risk score escalates properly.
   - Extended streak milestones (`calculateExtendedStreakReward` and `evaluateStreak`):
     - Days 0, 1, 6, 7, 8, 29, 30, 31, 89, 90, 91, 179, 180, 181, 364, 365, 366, 1000.
     - Verify exact math for points, cash bonuses (500, 5,000, 25,000, 100,000, 500,000), SRU multipliers (1.0x, 2.5x, 5.0x, 10.0x, 25.0x), and badge `imperial_veteran`.
     - Verify continuous progression without 7-day modulo reset.
2. Run your challenge tests and record all empirical outputs and statistics.
3. Write your comprehensive challenge report and explicit verdict (APPROVE or REJECT) to `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_o10\handoff.md`.
4. Send a message to parent with your verdict and empirical data.
</USER_REQUEST>
