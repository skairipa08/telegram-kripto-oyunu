import type { BusinessView, EmpireView, ScreenResource } from '../game/types';
import type { ActionFeedback } from '../game/live-game-model';
import { formatNumber, ResourceNotice, SectionTitle } from '../game/ui';
import { EmpireArcade } from '../components/empire-arcade';
import './empire-missions.css';

type EmpireScreenProps = {
  resource: ScreenResource<EmpireView>;
  onClaim?: () => void;
  onUpgrade?: (slug: string) => void;
  isClaimPending?: boolean;
  upgradingSlug?: string | null;
  claimRetryAvailable?: boolean;
  retryUpgradeSlug?: string | null;
  claimFeedback?: ActionFeedback | null;
  upgradeFeedback?: ActionFeedback | null;
  previewMiniGame?: boolean;
  onPreviewMiniGameReward?: (amount: number) => void;
};

const businessKinds = [
  'stand',
  'cafe',
  'delivery',
  'factory',
  'tech',
  'holding',
] as const;

function BusinessSilhouette({
  kind,
}: {
  kind: (typeof businessKinds)[number];
}) {
  const art = {
    stand: (
      <>
        <path d="M10 22h28v21H10zM7 18h34l-4-8H11z" />
        <path d="M16 27h8v16m6-16h3" />
      </>
    ),
    cafe: (
      <>
        <path d="M9 19h29v24H9zM7 14h33v5H7z" />
        <path d="M15 25h9v7h-9zm16 0h3m-3 5h3" />
        <path d="M36 8c-5 1-7-2-5-5" />
      </>
    ),
    delivery: (
      <>
        <path d="M6 18h23v18H6zm23 7h8l6 7v4H29z" />
        <circle cx="15" cy="39" r="4" />
        <circle cx="36" cy="39" r="4" />
        <path d="M32 28h7" />
      </>
    ),
    factory: (
      <>
        <path d="M7 23l11-7v7l12-7v27H7zM34 7h7v36h-7z" />
        <path d="M13 30h5m5 0h5m-15 6h5m5 0h5" />
      </>
    ),
    tech: (
      <>
        <rect x="8" y="10" width="33" height="26" rx="3" />
        <path d="M19 43h11m-6-7v7M15 18h8l-5 9h12" />
      </>
    ),
    holding: (
      <>
        <path d="M8 43h34M12 18h26v25H12zM8 14h34L25 6z" />
        <path d="M18 23v14m7-14v14m7-14v14" />
      </>
    ),
  }[kind];

  return (
    <svg className="empire-business-art" viewBox="0 0 50 50" aria-hidden="true">
      {art}
    </svg>
  );
}

function Skyline() {
  return (
    <svg className="empire-skyline" viewBox="0 0 420 172" aria-hidden="true">
      <defs>
        <linearGradient id="empire-building" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".78" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <path className="empire-skyline-ground" d="M18 145h384M40 154h340" />
      <path
        fill="url(#empire-building)"
        d="M38 89h52v56H38zm64-36h66v92h-66zm79 55h49v37h-49zm62-83h72v120h-72zm85 48h54v72h-54z"
      />
      <path
        className="empire-skyline-line"
        d="M57 104h13m-13 17h13m66-50h14m-14 20h14m-14 20h14m-14 20h14m128-84h15m-15 23h15m-15 23h15m-15 23h15m64-23h14m-14 20h14M279 25V8m-9 0h18"
      />
      <circle cx="279" cy="8" r="3" fill="currentColor" />
    </svg>
  );
}

function BusinessCard({
  business,
  index,
  cash,
  onUpgrade,
  upgradePending,
  upgradesBlocked,
  retryUpgrade,
}: {
  business: BusinessView;
  index: number;
  cash: number;
  onUpgrade: ((slug: string) => void) | undefined;
  upgradePending: boolean;
  upgradesBlocked: boolean;
  retryUpgrade: boolean;
}) {
  const unopened = business.level === 0;
  const unaffordable = business.upgradeCost > cash;
  const disabled =
    !onUpgrade ||
    (unaffordable && !retryUpgrade) ||
    (upgradesBlocked && !retryUpgrade);
  const actionLabel = upgradePending
    ? 'Yükseltiliyor…'
    : retryUpgrade
      ? 'Tekrar dene'
      : unaffordable
        ? 'Cash gerekli'
        : !onUpgrade
          ? unopened
            ? 'İşletme açma yakında'
            : 'Yükseltme yakında'
          : unopened
            ? 'İşletmeyi aç'
            : 'Yükselt';

  return (
    <article
      className={`empire-business-card${business.recommended ? ' is-recommended' : ''}${unopened && unaffordable ? ' is-locked' : ''}`}
    >
      <div className="empire-business-topline">
        <span className="empire-business-icon">
          <BusinessSilhouette
            kind={businessKinds[index % businessKinds.length]!}
          />
        </span>
        <div>
          <p className="eyebrow">SEVİYE {Math.max(0, business.level)}</p>
          <h3>{business.name}</h3>
        </div>
        {business.recommended && <span className="badge">İYİ YATIRIM</span>}
      </div>
      <dl className="empire-business-stats">
        <div>
          <dt>Üretim</dt>
          <dd>{formatNumber(business.production, true)} / sn</dd>
        </div>
        <div>
          <dt>Maliyet</dt>
          <dd>{formatNumber(business.upgradeCost, true)}</dd>
        </div>
        {business.paybackSeconds !== null && (
          <div>
            <dt>Geri dönüş</dt>
            <dd>{formatNumber(business.paybackSeconds)} sn</dd>
          </div>
        )}
      </dl>
      <button
        className="button secondary empire-upgrade-button"
        type="button"
        disabled={disabled}
        onClick={() => onUpgrade?.(business.slug)}
        aria-label={`${business.name}: ${actionLabel}`}
      >
        {actionLabel}
      </button>
    </article>
  );
}

export function EmpireScreen({
  resource,
  onClaim,
  onUpgrade,
  isClaimPending = false,
  upgradingSlug = null,
  claimRetryAvailable = false,
  retryUpgradeSlug = null,
  claimFeedback = null,
  upgradeFeedback = null,
  previewMiniGame = false,
  onPreviewMiniGameReward,
}: EmpireScreenProps) {
  if (resource.status !== 'ready' || !resource.data) {
    return (
      <section className="empire-screen" aria-label="İmparatorluk">
        <SectionTitle
          eyebrow="ŞEHRİNİN EKONOMİSİ"
          title="İmparatorluk"
          description="İşletmelerini büyüt, üretimi hızlandır ve sezon boyunca yüksel."
        />
        <ResourceNotice resource={resource} label="İmparatorluk verileri" />
      </section>
    );
  }

  const data = resource.data;
  const canClaim =
    ((data.claimable !== null && data.claimable > 0) || claimRetryAvailable) &&
    Boolean(onClaim) &&
    !isClaimPending;

  return (
    <section className="empire-screen" aria-label="İmparatorluk">
      <SectionTitle
        eyebrow="ŞEHRİNİN EKONOMİSİ"
        title="İmparatorluk"
        description="İşletmelerini büyüt, üretimi hızlandır ve sezon boyunca yüksel."
      />

      <div className="empire-ledger" aria-label="Ekonomi özeti">
        <div>
          <span>Nakit</span>
          <strong>{formatNumber(data.cash)}</strong>
          <small>Cash</small>
        </div>
        <div>
          <span>Sezon puanı</span>
          <strong>{formatNumber(data.seasonPoints)}</strong>
          <small>SP</small>
        </div>
      </div>

      <article className="panel empire-production">
        <div className="empire-production-copy">
          <p className="eyebrow">CANLI ÜRETİM</p>
          <h2>
            <span>{formatNumber(data.production, true)}</span> / saniye
          </h2>
          <p className="muted">
            Çevrimdışı üretim {formatNumber(data.offlineHours)} saate kadar
            kasada birikir.
          </p>
          <div className="empire-claim-row">
            <div>
              <span>Toplanabilir gelir</span>
              <strong>{formatNumber(data.claimable)}</strong>
            </div>
            <button
              className="button"
              type="button"
              disabled={!canClaim}
              onClick={onClaim}
            >
              {isClaimPending
                ? 'Toplanıyor…'
                : claimRetryAvailable
                  ? 'Tekrar dene'
                  : 'Geliri topla'}
            </button>
          </div>
          {claimFeedback && (
            <p
              className="empire-action-note"
              role={claimFeedback.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {claimFeedback.message}
            </p>
          )}
          {!onClaim && (
            <p className="empire-action-note">Gelir toplama yakında</p>
          )}
          {onClaim && !canClaim && !isClaimPending && !claimFeedback && (
            <p className="empire-action-note">Toplanacak gelir birikiyor.</p>
          )}
        </div>
        <div className="empire-production-art">
          <Skyline />
          <span>ŞEHİR ÜRETİM HATTI · AKTİF</span>
        </div>
      </article>

      <EmpireArcade
        preview={previewMiniGame}
        {...(onPreviewMiniGameReward
          ? { onPreviewReward: onPreviewMiniGameReward }
          : {})}
      />

      <div className="empire-list-heading">
        <div>
          <p className="eyebrow">YATIRIM PORTFÖYÜ</p>
          <h2>İşletmeler</h2>
        </div>
        <span className="muted">{data.businesses.length} işletme</span>
      </div>
      {data.businesses.length > 0 ? (
        <div className="empire-business-grid">
          {data.businesses.map((business, index) => (
            <BusinessCard
              key={business.slug}
              business={business}
              index={index}
              cash={data.cash}
              onUpgrade={onUpgrade}
              upgradePending={upgradingSlug === business.slug}
              upgradesBlocked={
                upgradingSlug !== null || retryUpgradeSlug !== null
              }
              retryUpgrade={retryUpgradeSlug === business.slug}
            />
          ))}
        </div>
      ) : (
        <div className="resource-state">
          <h2>Yatırım portföyün boş</h2>
          <p>İlk işletme açıldığında üretim seçenekleri burada görünecek.</p>
        </div>
      )}
      {upgradeFeedback && (
        <p
          className="empire-action-note"
          role={upgradeFeedback.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {upgradeFeedback.message}
        </p>
      )}
    </section>
  );
}
