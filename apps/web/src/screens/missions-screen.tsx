import { useState } from 'react';
import type { MissionView, MissionsView, ScreenResource } from '../game/types';
import type { ActionFeedback } from '../game/live-game-model';
import {
  EmptyState,
  formatNumber,
  ResourceNotice,
  SectionTitle,
} from '../game/ui';
import './empire-missions.css';

type MissionsScreenProps = {
  resource: ScreenResource<MissionsView>;
  onClaim?: (id: string) => void;
  pendingMissionId?: string | null;
  retryMissionId?: string | null;
  claimFeedback?: ActionFeedback | null;
};

type MissionFilter = 'daily' | 'weekly';

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
  pendingMissionId = null,
  retryMissionId = null,
  claimFeedback = null,
}: MissionsScreenProps) {
  const [filter, setFilter] = useState<MissionFilter>('daily');

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
  const visibleMissions = missions.filter((mission) =>
    filter === 'weekly'
      ? mission.difficulty === 'weekly'
      : mission.difficulty !== 'weekly',
  );
  const streakDays = Math.min(7, Math.max(0, streak));

  return (
    <section className="missions-screen" aria-label="Görevler">
      <SectionTitle
        eyebrow="SEZON İLERLEMESİ"
        title="Görevler"
        description="Kısa hedefleri tamamla, serini koru ve sezon puanı biriktir."
      />

      <article className="panel missions-streak">
        <div className="missions-streak-copy">
          <p className="eyebrow">GÜNLÜK SERİ</p>
          <h2>{formatNumber(streak)} gün</h2>
          <p className="muted">Her gün geri dönerek ritmini koru.</p>
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
            Günlük
          </button>
          <button
            type="button"
            aria-pressed={filter === 'weekly'}
            onClick={() => setFilter('weekly')}
          >
            Haftalık
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
              : 'Haftalık görev bulunmuyor'
          }
          description={
            filter === 'daily'
              ? 'Yeni günlük hedefler açıldığında burada görünecek.'
              : 'Yeni haftalık hedefler yayınlandığında görev defterine eklenecek.'
          }
        />
      )}
    </section>
  );
}
