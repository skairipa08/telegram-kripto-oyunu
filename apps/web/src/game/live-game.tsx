import { useEffect, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  bindReferralResponseSchema,
  claimCashResponseSchema,
  claimMissionResponseSchema,
  createInvoiceResponseSchema,
  economyRoiResponseSchema,
  leaderboardResponseSchema,
  playerMissionInstanceSchema,
  playerReferralOverviewSchema,
  playerStateSchema,
  playerStreakDtoSchema,
  publicConfigResponseSchema,
  shopCatalogResponseSchema,
  upgradeBusinessResponseSchema,
} from '@empire/shared';
import type {
  PlayerMissionInstance,
  PlayerReferralOverview,
  PlayerState,
  PlayerStreakDto,
} from '@empire/shared';
import { getGameResource } from './api';
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
import type {
  ActionFeedback,
  EconomyMutationAttempt,
  ReferralBindAttempt,
} from './live-game-model';
import { GameLayout } from './game-layout';
import type {
  EmpireView,
  FriendsView,
  GameTab,
  LeaderboardView,
  MissionsView,
  ScreenResource,
  ShopView,
} from './types';
import { EmpireScreen } from '../screens/empire-screen';
import { MissionsScreen } from '../screens/missions-screen';
import { FriendsScreen } from '../screens/friends-screen';
import { LeaderboardScreen } from '../screens/leaderboard-screen';
import { ShopScreen } from '../screens/shop-screen';
import { AdminScreen } from '../screens/admin-screen';
import { isDesignatedAdmin } from '../shell/admin-gate';
import { ApiError } from '../api/client';

async function postGameResource<T>(
  path: string,
  body: unknown,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: timeout,
  });

  if (!response.ok) {
    let code = 'UNAVAILABLE';
    try {
      const data = await response.json();
      if (typeof data?.error?.code === 'string') code = data.error.code;
    } catch {
      /* Keep raw server errors out of the UI. */
    }
    throw new ApiError(response.status, code);
  }

  return schema.parse(await response.json());
}

const missionsResponseSchema = {
  parse(value: unknown): PlayerMissionInstance[] {
    if (Array.isArray(value)) {
      return playerMissionInstanceSchema.array().parse(value);
    }
    if (
      value &&
      typeof value === 'object' &&
      'missions' in value &&
      Array.isArray((value as { missions: unknown }).missions)
    ) {
      return playerMissionInstanceSchema
        .array()
        .parse((value as { missions: unknown }).missions);
    }
    return playerMissionInstanceSchema.array().parse(value);
  },
};

const streakResponseSchema = {
  parse(value: unknown): PlayerStreakDto {
    if (
      value &&
      typeof value === 'object' &&
      'streak' in value &&
      typeof (value as { streak: unknown }).streak === 'object'
    ) {
      return playerStreakDtoSchema.parse((value as { streak: unknown }).streak);
    }
    return playerStreakDtoSchema.parse(value);
  },
};

const referralStatusResponseSchema = {
  parse(value: unknown): PlayerReferralOverview {
    if (
      value &&
      typeof value === 'object' &&
      'referral' in value &&
      typeof (value as { referral: unknown }).referral === 'object'
    ) {
      return playerReferralOverviewSchema.parse(
        (value as { referral: unknown }).referral,
      );
    }
    return playerReferralOverviewSchema.parse(value);
  },
};

export function GameShell({
  state,
  onLogout,
  isLoggingOut,
  logoutFailed,
}: {
  state: PlayerState;
  onLogout: () => void;
  isLoggingOut: boolean;
  logoutFailed: boolean;
}) {
  const [tab, setTab] = useState<GameTab>('empire');
  const [view, setView] = useState<'game' | 'admin'>('game');
  const isAdmin = isDesignatedAdmin(state.user);
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [now, setNow] = useState(() => Date.now());
  const actor = state.user.id;
  const queryClient = useQueryClient();
  const claimAttempt = useRef<EconomyMutationAttempt | null>(null);
  const upgradeAttempt = useRef<EconomyMutationAttempt | null>(null);
  const missionAttempt = useRef<EconomyMutationAttempt | null>(null);
  const referralBindAttempt = useRef<ReferralBindAttempt | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const gameState = useQuery({
    queryKey: ['game-design', actor, 'state'],
    queryFn: ({ signal }) =>
      getGameResource('/api/game/state', playerStateSchema, signal),
    staleTime: 30000,
    retry: false,
  });

  const economy = useQuery({
    queryKey: ['game-design', actor, 'economy'],
    queryFn: ({ signal }) =>
      getGameResource('/api/economy/roi', economyRoiResponseSchema, signal),
    staleTime: 30000,
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: (attempt: EconomyMutationAttempt) =>
      postGameResource(
        '/api/economy/claim',
        { requestId: attempt.requestId },
        claimCashResponseSchema,
      ),
    onSuccess: async () => {
      claimAttempt.current = null;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['game-design', actor, 'economy'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['game-design', actor, 'state'],
        }),
      ]);
    },
    onError: (error) => {
      if (isDefinitiveMutationFailure(error)) claimAttempt.current = null;
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: ({
      slug,
      attempt,
    }: {
      slug: string;
      attempt: EconomyMutationAttempt;
    }) =>
      postGameResource(
        '/api/economy/upgrade',
        { businessSlug: slug, requestId: attempt.requestId },
        upgradeBusinessResponseSchema,
      ),
    onSuccess: async () => {
      upgradeAttempt.current = null;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['game-design', actor, 'economy'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['game-design', actor, 'state'],
        }),
      ]);
    },
    onError: (error) => {
      if (isDefinitiveMutationFailure(error)) upgradeAttempt.current = null;
    },
  });

  const missions = useQuery({
    queryKey: ['game-design', actor, 'missions'],
    enabled: tab === 'missions',
    queryFn: ({ signal }) =>
      getGameResource('/api/missions/active', missionsResponseSchema, signal),
    staleTime: 30000,
    retry: false,
  });

  const streak = useQuery({
    queryKey: ['game-design', actor, 'streak'],
    enabled: tab === 'missions',
    queryFn: ({ signal }) =>
      getGameResource('/api/streak', streakResponseSchema, signal),
    staleTime: 30000,
    retry: false,
  });

  const claimMissionMutation = useMutation({
    mutationFn: ({
      missionId,
      attempt,
    }: {
      missionId: string;
      attempt: EconomyMutationAttempt;
    }) =>
      postGameResource(
        `/api/missions/${encodeURIComponent(missionId)}/claim`,
        { missionInstanceId: missionId, requestId: attempt.requestId },
        claimMissionResponseSchema,
      ),
    onSuccess: async (result) => {
      missionAttempt.current = null;
      await invalidateAfterMissionClaim(
        queryClient,
        actor,
        result.newSeasonPoints,
      );
    },
    onError: (error) => {
      if (isDefinitiveMutationFailure(error)) missionAttempt.current = null;
    },
  });

  const referral = useQuery({
    queryKey: ['game-design', actor, 'referral'],
    enabled: tab === 'friends',
    queryFn: ({ signal }) =>
      getGameResource(
        '/api/referral/status',
        referralStatusResponseSchema,
        signal,
      ),
    staleTime: 30000,
    retry: false,
  });

  const bindReferralMutation = useMutation({
    mutationFn: (attempt: { code: string; requestId: string }) =>
      postGameResource(
        '/api/referral/bind',
        { referralCode: attempt.code, requestId: attempt.requestId },
        bindReferralResponseSchema,
      ),
    onSuccess: async () => {
      referralBindAttempt.current = null;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['game-design', actor, 'referral'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['game-design', actor, 'economy'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['game-design', actor, 'state'],
        }),
      ]);
    },
    onError: (error) => {
      if (isDefinitiveMutationFailure(error)) {
        referralBindAttempt.current = null;
      }
    },
  });

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const tgParam =
        (
          window as unknown as {
            Telegram?: {
              WebApp?: { initDataUnsafe?: { start_param?: string } };
            };
          }
        ).Telegram?.WebApp?.initDataUnsafe?.start_param ||
        urlParams.get('startapp') ||
        urlParams.get('tgWebAppStartParam');
      if (tgParam && tgParam.startsWith('ref_')) {
        const code = tgParam.slice(4);
        if (code && code.length >= 4) {
          const resolved = ensureReferralBindAttempt(
            referralBindAttempt.current,
            actor,
            code,
            () => crypto.randomUUID(),
          );
          referralBindAttempt.current = resolved.attempt;
          if (resolved.shouldSubmit)
            bindReferralMutation.mutate(resolved.attempt);
        }
      }
    } catch {
      /* Silently ignore non-browser or URL parse errors */
    }
  }, [actor]);

  const leaderboard = useInfiniteQuery({
    queryKey: ['game-design', actor, 'leaderboard', scope],
    enabled: tab === 'leaderboard',
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      getGameResource(
        `/api/leaderboard?scope=${scope}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
        leaderboardResponseSchema,
        signal,
      ),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    retry: false,
    staleTime: 30000,
  });

  const shop = useQuery({
    queryKey: ['game-design', actor, 'shop'],
    enabled: tab === 'shop',
    queryFn: ({ signal }) =>
      getGameResource('/api/shop', shopCatalogResponseSchema, signal),
    retry: false,
    staleTime: 30000,
  });

  const canonicalEconomy =
    gameState.data?.game.status === 'active'
      ? gameState.data.game.economy
      : null;
  const points = canonicalEconomy?.seasonPoints ?? null;

  const offlineCapSeconds =
    economy.data?.multipliers?.offlineCapSeconds ?? 14400;
  const claimable = economy.data
    ? estimateClaimableCash(economy.data.businesses, now, offlineCapSeconds)
    : null;

  const empireResource: ScreenResource<EmpireView> = {
    status: economy.isError ? 'error' : economy.isPending ? 'loading' : 'ready',
    onRetry: () => void economy.refetch(),
    data: economy.data
      ? {
          cash: economy.data.currentCash,
          seasonPoints: points,
          production: economy.data.totalProductionPerSecond,
          claimable,
          offlineHours:
            (economy.data.multipliers?.offlineCapSeconds ?? 14400) / 3600,
          businesses: economy.data.businesses.map((b) => ({
            slug: b.slug,
            name: b.name,
            level: b.level,
            production: b.productionPerSecond,
            upgradeCost: b.upgradeCost,
            paybackSeconds: b.paybackPeriodSeconds ?? null,
            recommended: economy.data.optimalUpgrade?.slug === b.slug,
          })),
        }
      : null,
  };

  const rawMissions = missions.data ?? [];
  const rawStreak = streak.data?.currentStreak ?? 0;

  const claimFeedback: ActionFeedback | null = claimMutation.isPending
    ? { kind: 'status', message: 'Gelir toplanıyor…' }
    : claimMutation.isError
      ? getMutationFeedback(claimMutation.error, 'Gelir')
      : claimMutation.isSuccess
        ? { kind: 'success', message: 'Gelir kasana eklendi.' }
        : null;
  const upgradeFeedback: ActionFeedback | null = upgradeMutation.isPending
    ? { kind: 'status', message: 'İşletme yükseltiliyor…' }
    : upgradeMutation.isError
      ? getMutationFeedback(upgradeMutation.error, 'Yükseltme')
      : upgradeMutation.isSuccess
        ? { kind: 'success', message: 'İşletme güncellendi.' }
        : null;
  const missionFeedback: ActionFeedback | null = claimMissionMutation.isPending
    ? { kind: 'status', message: 'Görev ödülü alınıyor…' }
    : claimMissionMutation.isError
      ? getMutationFeedback(claimMissionMutation.error, 'Görev ödülü')
      : claimMissionMutation.isSuccess
        ? { kind: 'success', message: 'Görev ödülü sezon puanına eklendi.' }
        : null;
  const referralFeedback: ActionFeedback | null = bindReferralMutation.isPending
    ? { kind: 'status', message: 'Davet kodu hesabına bağlanıyor…' }
    : bindReferralMutation.isError
      ? getMutationFeedback(bindReferralMutation.error, 'Davet kodu')
      : bindReferralMutation.isSuccess
        ? { kind: 'success', message: 'Davet kodu hesabına bağlandı.' }
        : null;

  const missionsResource: ScreenResource<MissionsView> = {
    status:
      missions.isError || streak.isError
        ? 'error'
        : missions.isPending || streak.isPending
          ? 'loading'
          : 'ready',
    onRetry: () => {
      void missions.refetch();
      void streak.refetch();
    },
    data: missions.data
      ? {
          streak: rawStreak,
          missions: rawMissions.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            difficulty: m.difficulty,
            progress: m.progress,
            target: m.target,
            reward: m.rewardPoints,
            status: m.status,
          })),
        }
      : null,
  };

  const refData = referral.data ?? null;
  const rawLink = refData?.deepLink ?? '';
  const safeLink = normalizeReferralInviteLink(rawLink);

  const friendsResource: ScreenResource<FriendsView> = {
    status: referral.isError
      ? 'error'
      : referral.isPending
        ? 'loading'
        : 'ready',
    onRetry: () => void referral.refetch(),
    data: refData
      ? {
          link: safeLink,
          totalInvites: refData.totalInvites,
          qualified: refData.qualifiedCount,
          earnedPoints: refData.totalEarnedPoints,
          friends: null,
        }
      : null,
  };

  const first = leaderboard.data?.pages[0];
  const leaderboardResource: ScreenResource<LeaderboardView> = {
    status: leaderboard.isError
      ? leaderboard.error instanceof ApiError &&
        leaderboard.error.code === 'SEASON_NOT_FOUND'
        ? 'unavailable'
        : 'error'
      : leaderboard.isPending
        ? 'loading'
        : 'ready',
    onRetry: () => void leaderboard.refetch(),
    data: first
      ? {
          scope,
          seasonName: 'Sezon sıralaması',
          entries: leaderboard
            .data!.pages.flatMap((page) => page.entries)
            .map((e) => ({
              rank: e.rank,
              userId: e.userId,
              name: e.firstName,
              points: e.points,
              isYou: e.isCurrentUser,
            })),
          ownRank: first.currentUser.rank,
          ownPoints: first.currentUser.points,
          total: first.totalCount,
          hasMore: Boolean(leaderboard.hasNextPage),
        }
      : null,
  };

  const shopResource: ScreenResource<ShopView> = {
    status: shop.isError ? 'error' : shop.isPending ? 'loading' : 'ready',
    onRetry: () => void shop.refetch(),
    data: shop.data
      ? {
          passActive: shop.data.pass.isActive,
          expiresAt: shop.data.pass.expiresAt,
          products: shop.data.skus.map((p) => ({
            sku: p.sku,
            name: p.name,
            description: p.description,
            price: p.starsPrice,
            type: p.type === 'pass' ? 'convenience_pass' : 'cosmetic',
            durationDays: p.durationDays ?? null,
          })),
        }
      : null,
  };

  const publicConfig = useQuery({
    queryKey: ['public-config'],
    queryFn: ({ signal }) =>
      getGameResource('/api/config/public', publicConfigResponseSchema, signal),
    staleTime: 60000,
    retry: false,
  });

  const starsPaymentsEnabled = Boolean(
    publicConfig.data?.featureFlags['feature.stars_payments'],
  );

  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);
  const [purchaseFeedback, setPurchaseFeedback] =
    useState<ActionFeedback | null>(null);

  const handlePurchase = async (sku: string) => {
    if (!starsPaymentsEnabled || purchasingSku) return;

    setPurchasingSku(sku);
    setPurchaseFeedback({
      kind: 'status',
      message: 'Ödeme penceresi hazırlanıyor…',
    });

    try {
      const invoice = await postGameResource(
        '/api/shop/invoice',
        { sku, requestId: crypto.randomUUID() },
        createInvoiceResponseSchema,
      );

      const webApp = window.Telegram?.WebApp;
      if (webApp && typeof webApp.openInvoice === 'function') {
        webApp.openInvoice(invoice.invoiceLink, async (status) => {
          setPurchaseFeedback(getInvoiceStatusFeedback(status));
          if (status === 'paid') {
            await handleInvoicePaidSuccess(queryClient, actor, sku);
          }
          setPurchasingSku(null);
        });
      } else {
        setPurchaseFeedback({
          kind: 'status',
          message:
            'Ödeme bağlantısı hazırlandı (Telegram Mini App içinde otomatik açılır).',
        });
        setPurchasingSku(null);
      }
    } catch {
      setPurchasingSku(null);
      setPurchaseFeedback({
        kind: 'error',
        message: 'Ödeme bağlantısı oluşturulamadı. Lütfen tekrar dene.',
      });
    }
  };

  const unauthorized = hasSessionAccessError([
    gameState.error,
    economy.error,
    missions.error,
    streak.error,
    referral.error,
    leaderboard.error,
    shop.error,
    claimMutation.error,
    upgradeMutation.error,
    claimMissionMutation.error,
    bindReferralMutation.error,
  ]);

  if (view === 'admin' && isAdmin) {
    return (
      <AdminScreen user={state.user} onBackToGame={() => setView('game')} />
    );
  }

  return (
    <GameLayout
      tab={tab}
      onTab={setTab}
      name={state.user.firstName}
      cash={unauthorized ? null : (economy.data?.currentCash ?? null)}
      points={unauthorized ? null : points}
      onLogout={onLogout}
      isLoggingOut={isLoggingOut}
      logoutFailed={logoutFailed}
      isAdmin={isAdmin}
      onOpenAdmin={() => setView('admin')}
    >
      {unauthorized ? (
        <div className="resource-state" role="alert">
          <h1>Oturumunu yeniden aç</h1>
          <p>Bu bilgilere ulaşmak için oyunu Telegram’dan yeniden başlat.</p>
        </div>
      ) : (
        <>
          {tab === 'empire' && (
            <EmpireScreen
              resource={empireResource}
              onClaim={() => {
                if (!claimMutation.isPending) {
                  const attempt = ensureEconomyMutationAttempt(
                    claimAttempt.current,
                    'claim',
                    () => crypto.randomUUID(),
                  );
                  claimAttempt.current = attempt;
                  claimMutation.mutate(attempt);
                }
              }}
              onUpgrade={(slug) => {
                if (!upgradeMutation.isPending) {
                  const operation = `upgrade:${slug}`;
                  if (
                    upgradeAttempt.current &&
                    upgradeAttempt.current.operation !== operation
                  ) {
                    return;
                  }
                  const attempt = ensureEconomyMutationAttempt(
                    upgradeAttempt.current,
                    operation,
                    () => crypto.randomUUID(),
                  );
                  upgradeAttempt.current = attempt;
                  upgradeMutation.mutate({ slug, attempt });
                }
              }}
              isClaimPending={claimMutation.isPending}
              upgradingSlug={
                upgradeMutation.isPending
                  ? upgradeMutation.variables.slug
                  : null
              }
              claimRetryAvailable={
                claimMutation.isError && claimAttempt.current !== null
              }
              retryUpgradeSlug={
                upgradeMutation.isError && upgradeAttempt.current
                  ? upgradeAttempt.current.operation.replace('upgrade:', '')
                  : null
              }
              claimFeedback={claimFeedback}
              upgradeFeedback={upgradeFeedback}
            />
          )}
          {tab === 'missions' && (
            <MissionsScreen
              resource={missionsResource}
              onClaim={(id) => {
                if (!claimMissionMutation.isPending) {
                  const operation = `mission:${id}`;
                  if (
                    missionAttempt.current &&
                    missionAttempt.current.operation !== operation
                  ) {
                    return;
                  }
                  const attempt = ensureMutationAttempt(
                    missionAttempt.current,
                    operation,
                    () => crypto.randomUUID(),
                  );
                  missionAttempt.current = attempt;
                  claimMissionMutation.mutate({ missionId: id, attempt });
                }
              }}
              pendingMissionId={
                claimMissionMutation.isPending
                  ? claimMissionMutation.variables.missionId
                  : null
              }
              retryMissionId={
                claimMissionMutation.isError && missionAttempt.current
                  ? claimMissionMutation.variables.missionId
                  : null
              }
              claimFeedback={missionFeedback}
            />
          )}
          {tab === 'friends' && (
            <FriendsScreen
              resource={friendsResource}
              bindingFeedback={referralFeedback}
              onRetryBinding={
                bindReferralMutation.isError && referralBindAttempt.current
                  ? () => {
                      if (
                        !bindReferralMutation.isPending &&
                        referralBindAttempt.current
                      ) {
                        bindReferralMutation.mutate(
                          referralBindAttempt.current,
                        );
                      }
                    }
                  : undefined
              }
            />
          )}
          {tab === 'leaderboard' && (
            <LeaderboardScreen
              resource={leaderboardResource}
              scope={scope}
              onScopeChange={setScope}
              onLoadMore={() => {
                if (!leaderboard.isFetchingNextPage)
                  void leaderboard.fetchNextPage();
              }}
              loadingMore={leaderboard.isFetchingNextPage}
            />
          )}
          {tab === 'shop' && (
            <ShopScreen
              resource={shopResource}
              starsPaymentsEnabled={starsPaymentsEnabled}
              onPurchase={handlePurchase}
              purchasingSku={purchasingSku}
              purchaseFeedback={purchaseFeedback}
            />
          )}
        </>
      )}
    </GameLayout>
  );
}
