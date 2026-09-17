import { useState } from 'react';
import type { MissionView, MissionsView, ScreenResource } from '../game/types';
import type { ActionFeedback } from '../game/live-game-model';
import {
  EmptyState,
  formatNumber,
  ResourceNotice,
  SectionTitle,
} from '../game/ui';
import { CelebrationModal } from '../components/celebration-modal';
import { getSessionToken } from '../api/client';
import { useI18n } from '../i18n/i18n-context';
import './empire-missions.css';
import '../components/arcade.css';
import './social.css';

export interface StreakMilestone {
  readonly days: number;
  readonly label: string;
  readonly period: string;
  readonly sruMultiplier: string;
  readonly cashBonus: number;
  readonly badgeName?: string;
  readonly icon: string;
  readonly description: string;
}

export const STREAK_MILESTONES: readonly StreakMilestone[] = [
  {
    days: 7,
    label: '7 Gün',
    period: '1 Hafta',
    sruMultiplier: '1.0x SRU',
    cashBonus: 500,
    icon: '⚡',
    description: '+500 Nakit · 1.0x Sezon Puanı',
  },
  {
    days: 30,
    label: '30 Gün',
    period: '1 Ay',
    sruMultiplier: '2.5x SRU',
    cashBonus: 5000,
    icon: '🔥',
    description: '+5.000 Nakit · 2.5x Sezon Puanı',
  },
  {
    days: 90,
    label: '90 Gün',
    period: '3 Ay',
    sruMultiplier: '5.0x SRU',
    cashBonus: 25000,
    icon: '🛡️',
    description: '+25.000 Nakit · 5.0x Sezon Puanı',
  },
  {
    days: 180,
    label: '180 Gün',
    period: '6 Ay',
    sruMultiplier: '10.0x SRU',
    cashBonus: 100000,
    icon: '💎',
    description: '+100.000 Nakit · 10.0x Sezon Puanı',
  },
  {
    days: 365,
    label: '365 Gün',
    period: '1 Yıl',
    sruMultiplier: '25.0x SRU',
    cashBonus: 500000,
    badgeName: 'İmparatorluk Kıdemlisi',
    icon: '👑',
    description: '+500.000 Nakit · 25.0x SRU · İmparatorluk Kıdemlisi Rozeti',
  },
] as const;

export const FALLBACK_LIFETIME_MISSIONS: readonly MissionView[] = [
  {
    id: '00000000-0000-4000-a000-000000000001',
    title: 'İlk Milyon',
    description: 'Kariyerinde toplam 1.000.000 nakite ulaş',
    progress: 100,
    target: 1000000,
    reward: 100,
    difficulty: 'lifetime',
    status: 'in_progress',
  },
  {
    id: '00000000-0000-4000-a000-000000000002',
    title: 'Finansal Dev',
    description: 'Kariyerinde toplam 10.000.000 nakite ulaş',
    progress: 100,
    target: 10000000,
    reward: 250,
    difficulty: 'lifetime',
    status: 'in_progress',
  },
  {
    id: '00000000-0000-4000-a000-000000000003',
    title: 'İmparatorluk Ölçeği',
    description: 'Tüm işletmelerinde toplam 50 seviyeye ulaş',
    progress: 1,
    target: 50,
    reward: 150,
    difficulty: 'lifetime',
    status: 'in_progress',
  },
  {
    id: '00000000-0000-4000-a000-000000000004',
    title: 'Ağ Lideri',
    description: 'İmparatorluğuna 5 arkadaşını davet et',
    progress: 0,
    target: 5,
    reward: 80,
    difficulty: 'lifetime',
    status: 'in_progress',
  },
  {
    id: '00000000-0000-4000-a000-000000000005',
    title: 'Tıklama Ustası',
    description: 'Tıklama oyununda Çoklu Tık geliştirmesini seviye 10 yap',
    progress: 1,
    target: 10,
    reward: 50,
    difficulty: 'lifetime',
    status: 'in_progress',
  },
  {
    id: '00000000-0000-4000-a000-000000000006',
    title: 'Kuantum Birleştirici',
    description: 'Birleştirme oyununda Seviye 20 kutuya ulaş',
    progress: 1,
    target: 20,
    reward: 120,
    difficulty: 'lifetime',
    status: 'in_progress',
  },
];

export type StreakClaimResult = {
  rewardPoints: number;
  newStreak: number;
  newSeasonPoints?: number;
  isCycleBonus?: boolean;
};

type MissionsScreenProps = {
  resource: ScreenResource<MissionsView>;
  onClaim?: (id: string) => void;
  onClaimStreak?: () => Promise<StreakClaimResult | null> | void;
  pendingMissionId?: string | null;
  retryMissionId?: string | null;
  claimFeedback?: ActionFeedback | null;
};

type MissionFilter = 'daily' | 'weekly' | 'lifetime';

function MissionCard({
  mission,
  onClaim,
  claimPending,
  claimsBlocked,
  retryClaim,
}: {
  mission: MissionView;
  onClaim: ((id: string) => void) | undefined;
  claimPending: boolean;
  claimsBlocked: boolean;
  retryClaim: boolean;
}) {
  const progress =
    mission.target > 0
      ? Math.min(100, Math.max(0, (mission.progress / mission.target) * 100))
      : 0;
  const isComplete = mission.status === 'completed';
  const isClaimed = mission.status === 'claimed';
  const actionDisabled =
    !isComplete || !onClaim || (claimsBlocked && !retryClaim);
  const actionLabel = claimPending
    ? 'Alınıyor…'
    : retryClaim
      ? 'Tekrar dene'
      : isClaimed
        ? 'Alındı'
        : isComplete && onClaim
          ? 'Ödülü al'
          : isComplete
            ? 'Ödül alma yakında'
            : 'Devam ediyor';

  return (
    <article className={`panel missions-card is-${mission.status}`}>
      <div className="missions-card-heading">
        <div>
          <span
            className={`badge missions-difficulty is-${mission.difficulty}`}
          >
            {mission.difficulty === 'weekly'
              ? 'HAFTALIK'
              : mission.difficulty === 'hard'
                ? 'ZOR'
                : mission.difficulty === 'normal'
                  ? 'ORTA'
                  : 'KOLAY'}
          </span>
          <h3>{mission.title}</h3>
          <p className="muted">{mission.description}</p>
        </div>
        <div className="missions-reward">
          <strong>+{formatNumber(mission.reward)}</strong>
          <span>SP</span>
        </div>
      </div>
      <div className="missions-progress-copy">
        <span>{isClaimed ? 'Tamamlandı' : 'İlerleme'}</span>
        <strong>
          {formatNumber(Math.min(mission.progress, mission.target))} /{' '}
          {formatNumber(mission.target)}
        </strong>
      </div>
      <progress
        className="missions-progress"
        max={Math.max(1, mission.target)}
        value={Math.min(
          Math.max(0, mission.progress),
          Math.max(1, mission.target),
        )}
      >
        {Math.round(progress)}%
      </progress>
      <div className="missions-card-footer">
        <span className="missions-percent">%{Math.round(progress)}</span>
        <button
          className={`button${isComplete ? '' : ' secondary'}`}
          type="button"
          disabled={actionDisabled || isClaimed}
          onClick={() => onClaim?.(mission.id)}
          aria-label={`${mission.title}: ${actionLabel}`}
        >
          {actionLabel}
        </button>
      </div>
      {isComplete && !onClaim && (
        <p className="missions-action-note">
          Ödül alma özelliği hazır olduğunda tamamlanan görevini buradan
          kapatabilirsin.
        </p>
      )}
    </article>
  );
}

export function MissionsScreen({
  resource,
  onClaim,
  onClaimStreak,
  pendingMissionId = null,
  retryMissionId = null,
  claimFeedback = null,
}: MissionsScreenProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<MissionFilter>('daily');
  const [isStreakClaiming, setIsStreakClaiming] = useState(false);
  const [localStreakClaimed, setLocalStreakClaimed] = useState(false);
  const [streakClaimError, setStreakClaimError] = useState<string | null>(null);

  // Check if streak is claimed either locally in this session or in backend data
  const isStreakClaimed =
    localStreakClaimed ||
    (resource.data
      ? resource.data.canClaimStreak === false ||
        resource.data.streakClaimedToday === true
      : false);

  const [celebration, setCelebration] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    rewardValue: string;
    badgeName?: string;
    icon?: string;
  } | null>(null);

  const handleClaimDailyStreak = async () => {
    if (isStreakClaiming || isStreakClaimed) return;
    setIsStreakClaiming(true);
    setStreakClaimError(null);
    try {
      let result: StreakClaimResult | null = null;
      if (onClaimStreak) {
        const res = await onClaimStreak();
        if (res) result = res;
      } else {
        const token = getSessionToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          headers['X-Empire-Session'] = token;
        }
        const resp = await fetch('/api/streak/claim', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as Record<string, unknown>;
          result = {
            rewardPoints: Number(data.rewardPoints ?? 125),
            newStreak: Number(
              data.newStreak ??
                (resource.data?.streak ? resource.data.streak + 1 : 1),
            ),
            newSeasonPoints: Number(data.newSeasonPoints ?? 0),
            isCycleBonus: Boolean(data.isCycleBonus),
          };
        } else {
          const errData = (await resp.json().catch(() => null)) as {
            error?: { code?: string };
          } | null;
          throw new Error(errData?.error?.code ?? 'CLAIM_FAILED');
        }
      }

      if (result) {
        setLocalStreakClaimed(true);
        const streakNum =
          result.newStreak ||
          (resource.data?.streak ? resource.data.streak + 1 : 1);
        setCelebration({
          isOpen: true,
          title: `${formatNumber(streakNum)}. Gün Serisi Tamamlandı!`,
          subtitle: result.isCycleBonus
            ? 'Döngü Bonusu Kazanıldı! Ekstra puan hesabına aktarıldı.'
            : 'Günlük giriş serini başarıyla korudun ve ritmi sürdürdün.',
          rewardValue: `+${formatNumber(result.rewardPoints)} Sezon Puanı`,
          icon: result.isCycleBonus ? '🏆' : '🎁',
        });
      }
    } catch (err: unknown) {
      const errCode = (err as Error)?.message || '';
      if (errCode === 'ALREADY_CLAIMED') {
        setLocalStreakClaimed(true);
        setStreakClaimError('Bugünün sandığı zaten açılmış.');
      } else {
        setStreakClaimError(
          'Sandık açılırken bir hata oluştu. Lütfen tekrar dene.',
        );
      }
    } finally {
      setIsStreakClaiming(false);
    }
  };

  if (resource.status !== 'ready' || !resource.data) {
    return (
      <section className="missions-screen" aria-label="Görevler">
        <SectionTitle
          eyebrow="SEZON İLERLEMESİ"
          title="Görevler"
          description="Kısa hedefleri tamamla, serini koru ve sezon puanı biriktir."
        />
        <ResourceNotice resource={resource} label="Görevler" />
      </section>
    );
  }

  const { missions, streak } = resource.data;
  const filteredMissions = missions.filter((mission) => {
    if (filter === 'weekly') return mission.difficulty === 'weekly';
    if (filter === 'lifetime')
      return (mission.difficulty as string) === 'lifetime';
    return (
      mission.difficulty !== 'weekly' &&
      (mission.difficulty as string) !== 'lifetime'
    );
  });
  const visibleMissions =
    filter === 'lifetime' && filteredMissions.length === 0
      ? FALLBACK_LIFETIME_MISSIONS
      : filteredMissions;
  const streakDays = Math.min(7, Math.max(0, streak));

  return (
    <section className="missions-screen" aria-label={t('missions_title')}>
      <SectionTitle
        eyebrow={t('missions_eyebrow')}
        title={t('missions_title')}
        description={t('missions_description')}
      />

      <article className="panel missions-streak">
        <div className="missions-streak-copy">
          <p className="eyebrow">{t('missions_eyebrow')}</p>
          <h2>{formatNumber(streak)} gün</h2>
          <p className="muted">{t('missions_description')}</p>
        </div>
        <ol
          className="missions-week-strip"
          aria-label={`Yedi günlük seride ${streakDays} gün tamamlandı`}
        >
          {Array.from({ length: 7 }, (_, index) => {
            const done = index < streakDays;
            return (
              <li key={index} className={done ? 'is-done' : ''}>
                <span aria-hidden="true">{done ? '✓' : index + 1}</span>
                <small>{index + 1}. gün</small>
              </li>
            );
          })}
        </ol>

        {/* Daily Streak Claim Chest Action */}
        <div className="streak-claim-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              className={`streak-chest-icon ${isStreakClaimed ? 'unlocked' : ''}`}
              role="img"
              aria-label="Sandık"
            >
              {isStreakClaimed ? '🔓' : '🎁'}
            </span>
            <div>
              <strong style={{ display: 'block', fontSize: '14px' }}>
                {isStreakClaimed
                  ? t('missions_chest_title_unlocked')
                  : t('missions_chest_title_daily')}
              </strong>
              <small className="muted" style={{ fontSize: '12px' }}>
                {isStreakClaimed
                  ? t('missions_chest_sub_unlocked')
                  : t('missions_chest_sub_daily')}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="streak-claim-btn"
            disabled={isStreakClaiming || isStreakClaimed}
            onClick={() => void handleClaimDailyStreak()}
          >
            {isStreakClaiming
              ? t('missions_chest_claiming')
              : isStreakClaimed
                ? t('missions_chest_claimed')
                : t('missions_chest_claim')}
          </button>
        </div>
        {streakClaimError && (
          <p
            role="alert"
            style={{
              color: '#f87171',
              fontSize: '12px',
              marginTop: '8px',
              textAlign: 'center',
            }}
          >
            {streakClaimError}
          </p>
        )}
      </article>

      {/* Extended Streak Milestones Visual Track */}
      <article
        className="panel missions-milestones-track"
        aria-label="Kıdem Kilometre Taşları"
      >
        <div className="missions-milestones-header">
          <div>
            <p className="eyebrow">KIDEM KİLOMETRE TAŞLARI</p>
            <h2>Uzun Vadeli Seri Hedefleri</h2>
          </div>
          <span className="missions-milestones-sub">
            Mevcut Seri: <strong>{formatNumber(streak)} gün</strong>
          </span>
        </div>

        <div
          className="missions-milestones-grid"
          role="list"
          aria-label="Seri Kilometre Taşları"
        >
          {STREAK_MILESTONES.map((milestone, idx) => {
            const isAchieved = streak >= milestone.days;
            const prevAchieved =
              idx === 0 || streak >= STREAK_MILESTONES[idx - 1]!.days;
            const isCurrentTarget = !isAchieved && prevAchieved;
            const progressPct = Math.min(
              100,
              Math.round((streak / milestone.days) * 100),
            );
            const remainingDays = Math.max(0, milestone.days - streak);

            return (
              <div
                key={milestone.days}
                role="listitem"
                className={`milestone-card ${
                  isAchieved
                    ? 'is-achieved'
                    : isCurrentTarget
                      ? 'is-target'
                      : 'is-locked'
                }`}
              >
                <div className="milestone-card-top">
                  <div className="milestone-title-group">
                    <span className="milestone-icon" aria-hidden="true">
                      {milestone.icon}
                    </span>
                    <div>
                      <strong>
                        {milestone.label} ({milestone.period})
                      </strong>
                      {milestone.badgeName && (
                        <span className="milestone-badge-tag">
                          {milestone.badgeName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="milestone-tag-group">
                    <span
                      className={`milestone-status-tag ${
                        isAchieved
                          ? 'achieved'
                          : isCurrentTarget
                            ? 'target'
                            : 'locked'
                      }`}
                    >
                      {isAchieved
                        ? '✓ AÇILDI'
                        : isCurrentTarget
                          ? 'HEDEF'
                          : '🔒 KİLİTLİ'}
                    </span>
                    <span className="milestone-percent-tag">
                      %{progressPct}
                    </span>
                  </div>
                </div>

                <div className="milestone-rewards-row">
                  <span className="milestone-reward-pill">
                    +{formatNumber(milestone.cashBonus)} Nakit
                  </span>
                  <span className="milestone-reward-pill">
                    {milestone.sruMultiplier}
                  </span>
                  {milestone.badgeName && (
                    <span className="milestone-reward-pill badge">
                      🏆 {milestone.badgeName}
                    </span>
                  )}
                </div>

                <p className="milestone-rewards-copy">
                  {milestone.description}
                </p>

                <div className="milestone-progress-track" aria-hidden="true">
                  <div
                    className="milestone-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="milestone-footer-info">
                  <small>
                    {isAchieved
                      ? 'Ödül hakkı tamamlandı'
                      : `${remainingDays} gün kaldı`}
                  </small>
                  <small>
                    {formatNumber(Math.min(streak, milestone.days))} /{' '}
                    {formatNumber(milestone.days)} gün
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <div className="missions-toolbar">
        <div>
          <p className="eyebrow">GÖREV DEFTERİ</p>
          <h2>Aktif hedefler</h2>
        </div>
        <div
          className="missions-segments"
          role="group"
          aria-label="Görev dönemi"
        >
          <button
            type="button"
            aria-pressed={filter === 'daily'}
            onClick={() => setFilter('daily')}
          >
            {t('missions_tab_daily')}
          </button>
          <button
            type="button"
            aria-pressed={filter === 'weekly'}
            onClick={() => setFilter('weekly')}
          >
            {t('lb_tab_weekly')}
          </button>
          <button
            type="button"
            aria-pressed={filter === 'lifetime'}
            onClick={() => setFilter('lifetime')}
          >
            {t('lb_tab_all')}
          </button>
        </div>
      </div>

      {claimFeedback && (
        <p
          className="missions-action-note"
          role={claimFeedback.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {claimFeedback.message}
        </p>
      )}

      {visibleMissions.length > 0 ? (
        <div className="missions-list">
          {visibleMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onClaim={onClaim}
              claimPending={pendingMissionId === mission.id}
              claimsBlocked={
                pendingMissionId !== null || retryMissionId !== null
              }
              retryClaim={retryMissionId === mission.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            filter === 'daily'
              ? 'Bugünün görevleri tamam'
              : filter === 'weekly'
                ? 'Haftalık görev bulunmuyor'
                : 'Genel başarılar tamamlandı'
          }
          description={
            filter === 'daily'
              ? 'Yeni günlük hedefler açıldığında burada görünecek.'
              : filter === 'weekly'
                ? 'Yeni haftalık hedefler yayınlandığında görev defterine eklenecek.'
                : 'Tüm kalıcı kilometre taşları tamamlandı!'
          }
        />
      )}
      {celebration && (
        <CelebrationModal
          isOpen={celebration.isOpen}
          onClose={() => setCelebration(null)}
          title={celebration.title}
          subtitle={celebration.subtitle}
          rewardValue={celebration.rewardValue}
          badgeName={celebration.badgeName}
          icon={celebration.icon}
        />
      )}
    </section>
  );
}
