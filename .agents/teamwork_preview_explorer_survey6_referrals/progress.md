# Progress — survey6_referrals

Last visited: 2026-09-15T07:22:00Z

- [x] Initialized workspace and briefing
- [ ] Read authoritative user request in `.agents/ORIGINAL_REQUEST.md` (specifically R3)
- [ ] Inspect database schema/migrations for referrals, referral_events, player_balances, season_scores, badges, etc.
- [ ] Inspect packages/game-core for referral logic, configs, formulas (SRU, tier multipliers, milestone criteria)
- [ ] Inspect apps/api for referral routes, controllers, services, event hooks (login, upgrade, level up)
- [ ] Trace qualification checks (activation, retained_d2, retained_d7, progression)
- [ ] Trace status updates (`referrals.status = 'qualified'`, `is_qualified = true`, `qualified_at`)
- [ ] Trace rewards crediting/claiming and referral_events
- [ ] Trace badges, invite counts, tier stats
- [ ] Synthesize findings into handoff.md
- [ ] Notify parent agent
