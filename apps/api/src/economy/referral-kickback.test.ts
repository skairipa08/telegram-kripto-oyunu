import { describe, expect, it } from 'vitest';
import { MemoryEconomyStore } from '../dev-store';

describe('Referral 0.1% (1-in-1000) Kickback & Invitee Milestones Integration', () => {
  it('accurately credits 0.1% kickback and 1M cash milestones to referrer X when invitee Y earns cash', async () => {
    const store = new MemoryEconomyStore();
    const userX = 'userX_12345678-0000-0000-0000-000000000001';
    const userY = 'userY_87654321-0000-0000-0000-000000000002';

    // 1. Initial status for User X
    const initialStatusX = await store.getReferralStatus(userX);
    expect(initialStatusX.totalInvites).toBe(0);
    expect(initialStatusX.totalKickbackCashEarned).toBe(0);
    expect(initialStatusX.unclaimedKickbackCash).toBe(0);

    // 2. User Y registers with User X referral code
    const refCodeX = `REF_${userX.slice(0, 8)}`;
    const joinResult = await store.bindReferral(userY, refCodeX, 'req-ref-1');
    expect(joinResult.success).toBe(true);

    // 3. User Y earns 1,000,000 cash (e.g. from businesses or mini-games)
    // Note: starter referral bonus also counted 5000 cash towards lifetime earnings
    store.processInviteeEarnings(userY, 1_000_000);

    // Expected Kickback calculation:
    // 0.1% of 5,000 (starter) = 5
    // 0.1% of 1,000,000 = 1,000
    // Total direct 0.1% kickback = 1,005
    // Plus Milestones reached (lifetime cash >= 1,005,000):
    // 100,000 milestone -> +100 cash
    // 1,000,000 milestone -> +1,000 cash
    // Total milestones bonus = 1,100 cash
    // Grand Total kickback earned = 1,005 + 1,100 = 2,105 cash

    const statusX = await store.getReferralStatus(userX);
    expect(statusX.totalInvites).toBe(1);
    expect(statusX.totalKickbackCashEarned).toBe(2105);
    expect(statusX.unclaimedKickbackCash).toBe(2105);

    const milestones = statusX.inviteeMilestones as Array<{
      targetCash: number;
      rewardCash: number;
      completed: boolean;
      claimed: boolean;
    }>;

    const m100k = milestones.find((m) => m.targetCash === 100_000);
    const m1m = milestones.find((m) => m.targetCash === 1_000_000);
    const m10m = milestones.find((m) => m.targetCash === 10_000_000);

    expect(m100k?.completed).toBe(true);
    expect(m1m?.completed).toBe(true);
    expect(m10m?.completed).toBe(false);

    // 4. Referrer X claims kickback
    const initialPlayerStateX = await store.getPlayerState(userX);
    const initialCashX = initialPlayerStateX.cash;

    const claimRes = await store.claimReferralKickback(userX);
    expect(claimRes.claimedCash).toBe(2105);
    expect(claimRes.newCash).toBe(initialCashX + 2105);

    // 5. Verify status after claim
    const claimedStatusX = await store.getReferralStatus(userX);
    expect(claimedStatusX.totalKickbackCashEarned).toBe(2105);
    expect(claimedStatusX.unclaimedKickbackCash).toBe(0);
  });
});
