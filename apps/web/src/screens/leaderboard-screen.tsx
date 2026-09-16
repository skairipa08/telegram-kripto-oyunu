import type { LeaderboardView, ScreenResource } from '../game/types';
import {
  EmptyState,
  formatNumber,
  ResourceNotice,
  SectionTitle,
} from '../game/ui';
import './social.css';

type LeaderboardScope = 'global' | 'friends';

type LeaderboardScreenProps = {
  resource: ScreenResource<LeaderboardView>;
  scope: LeaderboardScope;
  onScopeChange: (scope: LeaderboardScope) => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

function RankEmblem() {
  return (
    <svg className="rank-emblem" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 12h40v28L32 54 12 40Z" />
      <path d="m23 31 6 6 13-15" />
    </svg>
  );
}

export function LeaderboardScreen({
  resource,
  scope,
  onScopeChange,
  onLoadMore,
  loadingMore = false,
}: LeaderboardScreenProps) {
  const data = resource.status === 'ready' ? resource.data : null;
  const scopeLabel =
    scope === 'global' ? 'Genel sıralama' : 'Arkadaş sıralaması';

  const filters = (
    <div
      className="leaderboard-filters"
      role="group"
      aria-label="Sıralama kapsamı"
    >
      <button
        type="button"
        className={scope === 'global' ? 'is-active' : ''}
        aria-pressed={scope === 'global'}
        onClick={() => onScopeChange('global')}
      >
        Genel
      </button>
      <button
        type="button"
        className={scope === 'friends' ? 'is-active' : ''}
        aria-pressed={scope === 'friends'}
        onClick={() => onScopeChange('friends')}
      >
        Arkadaşlar
      </button>
    </div>
  );

  if (!data) {
    return (
      <section
        className="social-screen leaderboard-screen"
        aria-label="Liderlik tablosu"
      >
        <SectionTitle
          eyebrow="Sezon kürsüsü"
          title="Liderlik tablosu"
          description="Sezon puanları, kalıcı ekonomik ilerlemeyi aynı ölçekte karşılaştırır."
          action={resource.status === 'unavailable' ? undefined : filters}
        />
        {resource.status === 'unavailable' && (
          <div className="panel social-context-panel">
            <RankEmblem />
            <div>
              <p className="eyebrow">Sıralama düzeni</p>
              <p>
                Genel görünüm tüm oyuncuları, arkadaş görünümü ise yalnızca
                kendi çevreni karşılaştırır.
              </p>
            </div>
          </div>
        )}
        <ResourceNotice resource={resource} label={scopeLabel} />
      </section>
    );
  }

  return (
    <section
      className="social-screen leaderboard-screen"
      aria-label="Liderlik tablosu"
    >
      <SectionTitle
        eyebrow={data.seasonName}
        title="Liderlik tablosu"
        description="İmparatorluğunun sezon boyunca biriktirdiği gücü karşılaştır."
        action={filters}
      />

      <aside className="own-rank panel" aria-label="Senin sıralaman">
        <RankEmblem />
        <div className="own-rank-copy">
          <span className="eyebrow">Senin konumun</span>
          <strong>
            {data.ownRank === null
              ? 'Sıralama dışında'
              : `#${formatNumber(data.ownRank)}`}
          </strong>
        </div>
        <div className="own-rank-points">
          <span>Sezon puanı</span>
          <strong>{formatNumber(data.ownPoints)}</strong>
        </div>
      </aside>

      <div className="leaderboard-list-heading">
        <div>
          <p className="eyebrow">{scopeLabel}</p>
          <h2>Ekonomik güç sırası</h2>
        </div>
        <span className="badge">{formatNumber(data.total)} oyuncu</span>
      </div>

      {data.entries.length === 0 ? (
        <EmptyState
          title={
            scope === 'friends'
              ? 'Arkadaş sıralaman henüz boş'
              : 'Sıralama henüz oluşmadı'
          }
          description={
            scope === 'friends'
              ? 'Arkadaşların sezon puanı kazandığında burada karşılaştırabileceksin.'
              : 'İlk sezon puanları işlendiğinde oyuncular burada yerini alacak.'
          }
        />
      ) : (
        <ol className="leaderboard-list" aria-label={scopeLabel}>
          {data.entries.map((entry) => (
            <li
              className={`leaderboard-row panel ${entry.rank <= 3 ? 'is-leading' : ''} ${entry.isYou ? 'is-you' : ''}`}
              key={entry.userId}
              value={entry.rank}
            >
              <span
                className="leaderboard-rank"
                aria-label={`${entry.rank}. sıra`}
              >
                {entry.rank <= 3 && (
                  <span className="leader-dot" aria-hidden="true" />
                )}
                {formatNumber(entry.rank)}
              </span>
              <span className="leaderboard-name">
                <strong>{entry.name}</strong>
                {entry.isYou && <span className="badge">Sen</span>}
              </span>
              <span className="leaderboard-points">
                <strong>{formatNumber(entry.points)}</strong>
                <small>puan</small>
              </span>
            </li>
          ))}
        </ol>
      )}

      {data.hasMore && data.entries.length > 0 && (
        <button
          className="button secondary leaderboard-load-more"
          type="button"
          onClick={() => {
            if (!loadingMore) onLoadMore?.();
          }}
          disabled={loadingMore || !onLoadMore}
          aria-busy={loadingMore}
        >
          {loadingMore ? 'Sıralama yükleniyor…' : 'Daha fazla göster'}
        </button>
      )}
    </section>
  );
}
