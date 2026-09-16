import { ApiError } from '../api/client';
import type { QueryClient } from '@tanstack/react-query';
import type { PlayerState, ShopCatalogResponseDto } from '@empire/shared';

export type ActionFeedback = {
  kind: 'error' | 'status' | 'success';
  message: string;
};

export type ReferralBindAttempt = {
  actor: string;
  code: string;
  requestId: string;
};

export type EconomyMutationAttempt = {
  operation: string;
  requestId: string;
};

const knownMutationMessages: Readonly<Record<string, string>> = {
  INSUFFICIENT_CASH: 'Bu yükseltme için yeterli Cash yok.',
  BUSINESS_NOT_FOUND: 'Bu işletme artık kullanılamıyor. Sayfayı yenile.',
  ALREADY_CLAIMED: 'Bu görev ödülü daha önce alındı.',
  NOT_COMPLETED: 'Bu görev henüz tamamlanmadı.',
  MISSION_NOT_FOUND: 'Bu görev artık kullanılamıyor. Görevleri yenile.',
  ALREADY_REFERRED: 'Hesabın zaten bir davet koduna bağlı.',
  INVALID_CODE: 'Davet kodu geçerli değil.',
  SELF_REFERRAL: 'Kendi davet kodunu kullanamazsın.',
  REQUEST_ID_CONFLICT: 'İstek çakıştı. Sayfayı yenileyip tekrar dene.',
};

type ClaimableBusiness = {
  level: number;
  productionPerSecond: number;
  lastClaimAt: string;
};

export function estimateClaimableCash(
  businesses: readonly ClaimableBusiness[],
  now: number,
  offlineCapSeconds: number,
) {
  const cap = Math.max(0, offlineCapSeconds);
  const estimate = businesses.reduce((total, business) => {
    if (business.level <= 0 || business.productionPerSecond <= 0) return total;

    const lastClaimAt = Date.parse(business.lastClaimAt);
    if (!Number.isFinite(lastClaimAt)) return total;

    const elapsedSeconds = Math.min(
      cap,
      Math.max(0, Math.floor((now - lastClaimAt) / 1000)),
    );
    return total + business.productionPerSecond * elapsedSeconds;
  }, 0);

  return Math.floor(estimate);
}

export async function invalidateAfterMissionClaim(
  queryClient: QueryClient,
  actor: string,
  newSeasonPoints: number,
) {
  const gameStateKey = ['game-design', actor, 'state'] as const;
  queryClient.setQueryData<PlayerState>(gameStateKey, (current) => {
    if (!current || current.game.status !== 'active') return current;
    return {
      ...current,
      game: {
        ...current.game,
        economy: {
          ...current.game.economy,
          seasonPoints: newSeasonPoints,
        },
      },
    };
  });

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: gameStateKey }),
    queryClient.invalidateQueries({
      queryKey: ['game-design', actor, 'missions'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['game-design', actor, 'economy'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['game-design', actor, 'leaderboard'],
    }),
  ]);
}

export function normalizeReferralInviteLink(
  deepLink: string | null | undefined,
) {
  if (!deepLink) return '';
  return deepLink.includes('?startapp=')
    ? deepLink
    : deepLink.replace('?start=', '?startapp=');
}

export function ensureReferralBindAttempt(
  current: ReferralBindAttempt | null,
  actor: string,
  code: string,
  createRequestId: () => string,
) {
  if (current?.actor === actor && current.code === code) {
    return { attempt: current, shouldSubmit: false } as const;
  }

  return {
    attempt: { actor, code, requestId: createRequestId() },
    shouldSubmit: true,
  } as const;
}

export function ensureEconomyMutationAttempt(
  current: EconomyMutationAttempt | null,
  operation: string,
  createRequestId: () => string,
) {
  if (current?.operation === operation) return current;
  return { operation, requestId: createRequestId() };
}

export const ensureMutationAttempt = ensureEconomyMutationAttempt;

export function isDefinitiveMutationFailure(error: unknown) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export function hasSessionAccessError(errors: readonly unknown[]) {
  return errors.some(
    (error) =>
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403),
  );
}

export function getMutationFeedback(
  error: unknown,
  actionLabel: string,
): ActionFeedback {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    return {
      kind: 'error',
      message:
        'Oturumun sona ermiş olabilir. Oyunu Telegram’dan yeniden açıp tekrar dene.',
    };
  }

  if (error instanceof ApiError) {
    const message = knownMutationMessages[error.code];
    if (message) return { kind: 'error', message };
  }

  return {
    kind: 'error',
    message: `${actionLabel} işlemi tamamlanamadı. Bağlantını kontrol edip aynı işlemi tekrar dene.`,
  };
}

export type TelegramInvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

export function getInvoiceStatusFeedback(
  status: TelegramInvoiceStatus,
): ActionFeedback {
  switch (status) {
    case 'paid':
      return {
        kind: 'success',
        message:
          'Ödeme tamamlandı! Satın aldığın ayrıcalık hesabına tanımlandı.',
      };
    case 'cancelled':
      return {
        kind: 'status',
        message: 'Ödeme işlemi iptal edildi.',
      };
    case 'failed':
      return {
        kind: 'error',
        message:
          'Ödeme tamamlanamadı. Lütfen Yıldız bakiyeni kontrol edip tekrar dene.',
      };
    case 'pending':
      return {
        kind: 'status',
        message:
          'Ödeme onay bekliyor. İşlem onaylandığında ürün hesabına aktarılacaktır.',
      };
  }
}

export async function handleInvoicePaidSuccess(
  queryClient: QueryClient,
  actor: string,
  sku: string,
) {
  if (sku === 'convenience_pass_30d') {
    queryClient.setQueryData<ShopCatalogResponseDto>(
      ['game-design', actor, 'shop'],
      (prev) =>
        prev ? { ...prev, pass: { ...prev.pass, isActive: true } } : prev,
    );
  }
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['game-design', actor, 'shop'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['game-design', actor, 'economy'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['game-design', actor, 'state'],
    }),
  ]);
}
