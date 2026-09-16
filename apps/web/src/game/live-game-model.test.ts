import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import {
  ensureEconomyMutationAttempt,
  ensureMutationAttempt,
  ensureReferralBindAttempt,
  estimateClaimableCash,
  getInvoiceStatusFeedback,
  getMutationFeedback,
  handleInvoicePaidSuccess,
  hasSessionAccessError,
  invalidateAfterMissionClaim,
  isDefinitiveMutationFailure,
  normalizeReferralInviteLink,
} from './live-game-model';

describe('live game mutation feedback', () => {
  it.each([401, 403])(
    'turns an HTTP %s mutation failure into safe Turkish session guidance',
    (status) => {
      const feedback = getMutationFeedback(
        new ApiError(status, 'SENSITIVE_SERVER_DETAIL'),
        'Görev ödülü',
      );

      expect(feedback).toEqual({
        kind: 'error',
        message:
          'Oturumun sona ermiş olabilir. Oyunu Telegram’dan yeniden açıp tekrar dene.',
      });
      expect(feedback.message).not.toContain('SENSITIVE_SERVER_DETAIL');
    },
  );

  it('uses a safe Turkish fallback for malformed or network failures', () => {
    expect(
      getMutationFeedback(new Error('private network detail'), 'Gelir'),
    ).toEqual({
      kind: 'error',
      message:
        'Gelir işlemi tamamlanamadı. Bağlantını kontrol edip aynı işlemi tekrar dene.',
    });
  });

  it.each([
    ['INSUFFICIENT_CASH', 'Bu yükseltme için yeterli Cash yok.'],
    ['ALREADY_CLAIMED', 'Bu görev ödülü daha önce alındı.'],
    ['ALREADY_REFERRED', 'Hesabın zaten bir davet koduna bağlı.'],
    ['INVALID_CODE', 'Davet kodu geçerli değil.'],
    ['REQUEST_ID_CONFLICT', 'İstek çakıştı. Sayfayı yenileyip tekrar dene.'],
  ])('maps the known %s code without exposing raw details', (code, message) => {
    expect(getMutationFeedback(new ApiError(400, code), 'İşlem')).toEqual({
      kind: 'error',
      message,
    });
  });
});

describe('claimable cash estimate', () => {
  it('sums each active business from its own last claim time', () => {
    const now = Date.parse('2026-09-15T12:00:00.000Z');

    expect(
      estimateClaimableCash(
        [
          {
            level: 2,
            productionPerSecond: 2,
            lastClaimAt: '2026-09-15T11:58:20.000Z',
          },
          {
            level: 1,
            productionPerSecond: 3,
            lastClaimAt: '2026-09-15T11:59:50.000Z',
          },
          {
            level: 0,
            productionPerSecond: 999,
            lastClaimAt: '2026-09-15T10:00:00.000Z',
          },
        ],
        now,
        60,
      ),
    ).toBe(150);
  });
});

describe('mission claim refresh', () => {
  it('updates canonical points immediately and invalidates game state, missions, economy, and all leaderboard scopes', async () => {
    const client = new QueryClient();
    const actor = 'player-1';
    const expectedKeys = [
      ['game-design', actor, 'state'],
      ['game-design', actor, 'missions'],
      ['game-design', actor, 'economy'],
      ['game-design', actor, 'leaderboard', 'global'],
      ['game-design', actor, 'leaderboard', 'friends'],
    ] as const;
    const unrelatedKey = ['game-design', 'player-2', 'leaderboard', 'global'];

    for (const key of [...expectedKeys.slice(1), unrelatedKey]) {
      client.setQueryData(key, { value: 'cached' });
    }
    client.setQueryData(expectedKeys[0], {
      apiVersion: 'v1',
      user: {
        id: actor,
        telegramId: '123',
        firstName: 'Ada',
        username: null,
        language: 'tr',
      },
      session: { expiresAt: '2026-09-16T12:00:00.000Z' },
      game: {
        status: 'active',
        economy: {
          cash: 500,
          seasonPoints: 10,
          totalProductionPerSecond: 2,
          offlineCapSeconds: 14_400,
          businesses: [],
        },
      },
    });

    await invalidateAfterMissionClaim(client, actor, 125);

    const refreshed = client.getQueryData<{
      game: { status: string; economy: { seasonPoints: number } };
    }>(expectedKeys[0]);
    expect(refreshed?.game.economy.seasonPoints).toBe(125);

    for (const key of expectedKeys) {
      expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(
        true,
      );
    }
    expect(client.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  });
});

describe('referral integration safeguards', () => {
  it('does not invent a bot link when the API has no deep link', () => {
    expect(normalizeReferralInviteLink('')).toBe('');
    expect(normalizeReferralInviteLink(null)).toBe('');
  });

  it('normalizes the API deep link without changing its bot identity', () => {
    expect(
      normalizeReferralInviteLink(
        'https://t.me/ConfiguredBot?start=ref_INVITE123',
      ),
    ).toBe('https://t.me/ConfiguredBot?startapp=ref_INVITE123');
  });

  it('reuses one request id and suppresses a duplicate effect submission', () => {
    let generated = 0;
    const createRequestId = () => `request-${++generated}`;
    const first = ensureReferralBindAttempt(
      null,
      'player-1',
      'INVITE123',
      createRequestId,
    );
    const repeated = ensureReferralBindAttempt(
      first.attempt,
      'player-1',
      'INVITE123',
      createRequestId,
    );

    expect(first).toEqual({
      attempt: {
        actor: 'player-1',
        code: 'INVITE123',
        requestId: 'request-1',
      },
      shouldSubmit: true,
    });
    expect(repeated).toEqual({
      attempt: first.attempt,
      shouldSubmit: false,
    });
    expect(generated).toBe(1);
  });
});

describe('economy mutation idempotency', () => {
  it('keeps the same request id when an uncertain claim or upgrade is retried', () => {
    let generated = 0;
    const createRequestId = () => `operation-${++generated}`;
    const claim = ensureEconomyMutationAttempt(null, 'claim', createRequestId);
    const claimRetry = ensureEconomyMutationAttempt(
      claim,
      'claim',
      createRequestId,
    );
    const upgrade = ensureEconomyMutationAttempt(
      null,
      'upgrade:stand',
      createRequestId,
    );
    const upgradeRetry = ensureEconomyMutationAttempt(
      upgrade,
      'upgrade:stand',
      createRequestId,
    );

    expect(claimRetry).toBe(claim);
    expect(upgradeRetry).toBe(upgrade);
    expect(claim.requestId).toBe('operation-1');
    expect(upgrade.requestId).toBe('operation-2');
    expect(generated).toBe(2);
  });

  it('clears attempts only for definite HTTP 4xx rejections', () => {
    expect(
      isDefinitiveMutationFailure(new ApiError(400, 'INVALID_REQUEST')),
    ).toBe(true);
    expect(isDefinitiveMutationFailure(new ApiError(403, 'FORBIDDEN'))).toBe(
      true,
    );
    expect(isDefinitiveMutationFailure(new ApiError(500, 'UNAVAILABLE'))).toBe(
      false,
    );
    expect(isDefinitiveMutationFailure(new Error('timeout'))).toBe(false);
  });
});

describe('mission and referral mutation idempotency', () => {
  it('retains request ids for uncertain mission and referral retries', () => {
    let generated = 0;
    const createRequestId = () => `retry-${++generated}`;
    const mission = ensureMutationAttempt(
      null,
      'mission:mission-1',
      createRequestId,
    );
    const referral = ensureMutationAttempt(
      null,
      'referral:INVITE123',
      createRequestId,
    );

    expect(
      ensureMutationAttempt(mission, 'mission:mission-1', createRequestId),
    ).toBe(mission);
    expect(
      ensureMutationAttempt(referral, 'referral:INVITE123', createRequestId),
    ).toBe(referral);
    expect(generated).toBe(2);
  });
});

describe('mutation access recovery', () => {
  it.each([401, 403])(
    'detects an HTTP %s mutation access failure',
    (status) => {
      expect(
        hasSessionAccessError([
          new Error('unrelated'),
          new ApiError(status, 'SENSITIVE_DETAIL'),
        ]),
      ).toBe(true);
    },
  );

  it('does not treat business rejections or network failures as session loss', () => {
    expect(
      hasSessionAccessError([
        new ApiError(400, 'INSUFFICIENT_CASH'),
        new Error('timeout'),
      ]),
    ).toBe(false);
  });
});

describe('telegram invoice feedback and invalidation', () => {
  it.each([
    [
      'paid',
      'success',
      'Ödeme tamamlandı! Satın aldığın ayrıcalık hesabına tanımlandı.',
    ],
    ['cancelled', 'status', 'Ödeme işlemi iptal edildi.'],
    [
      'failed',
      'error',
      'Ödeme tamamlanamadı. Lütfen Yıldız bakiyeni kontrol edip tekrar dene.',
    ],
    [
      'pending',
      'status',
      'Ödeme onay bekliyor. İşlem onaylandığında ürün hesabına aktarılacaktır.',
    ],
  ] as const)(
    'maps %s to kind %s with proper localized copy',
    (status, expectedKind, expectedMessage) => {
      const feedback = getInvoiceStatusFeedback(status);
      expect(feedback.kind).toBe(expectedKind);
      expect(feedback.message).toBe(expectedMessage);
    },
  );

  it('optimistically sets pass state and invalidates queries on convenience pass purchase', async () => {
    const queryClient = new QueryClient();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueriesSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);

    await handleInvoicePaidSuccess(
      queryClient,
      'user-1',
      'convenience_pass_30d',
    );

    expect(setQueryDataSpy).toHaveBeenCalledWith(
      ['game-design', 'user-1', 'shop'],
      expect.any(Function),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['game-design', 'user-1', 'shop'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['game-design', 'user-1', 'economy'],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['game-design', 'user-1', 'state'],
    });
  });
});
