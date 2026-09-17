import { useState, useRef, useEffect } from 'react';
import type { BusinessView, EmpireView, ScreenResource } from '../game/types';
import type { ActionFeedback } from '../game/live-game-model';
import { formatNumber, ResourceNotice, SectionTitle } from '../game/ui';
import { ShareReferralModal } from '../components/share-referral-modal';
import './empire-missions.css';

type EmpireScreenProps = {
  resource: ScreenResource<EmpireView>;
  onClaim?: (() => void) | undefined;
  onUpgrade?: ((slug: string) => void) | undefined;
  isClaimPending?: boolean | undefined;
  upgradingSlug?: string | null | undefined;
  claimRetryAvailable?: boolean | undefined;
  retryUpgradeSlug?: string | null | undefined;
  claimFeedback?: ActionFeedback | null | undefined;
  upgradeFeedback?: ActionFeedback | null | undefined;
  previewMiniGame?: boolean | undefined;
  onPreviewMiniGameReward?: ((amount: number) => void) | undefined;
  referralLink?: string | undefined;
  clanTag?: string | undefined;
  clanName?: string | undefined;
};

export type BusinessTier =
  'tier-local' | 'tier-tech' | 'tier-quantum' | 'tier-space';

export interface BusinessVisualMetadata {
  kind: string;
  tier: BusinessTier;
  tierLabel: string;
}

const BUSINESS_KIND_MAPPINGS: Array<{
  match: (slug: string) => boolean;
  kind: string;
  tier: BusinessTier;
  tierLabel: string;
}> = [
  {
    match: (s) => s === 'street_stand' || s.includes('stand'),
    kind: 'stand',
    tier: 'tier-local',
    tierLabel: 'Yerel Girişim',
  },
  {
    match: (s) => s === 'cafe' || s.includes('cafe') || s.includes('kafe'),
    kind: 'cafe',
    tier: 'tier-local',
    tierLabel: 'Yerel Girişim',
  },
  {
    match: (s) =>
      s === 'delivery_hub' || s.includes('delivery') || s.includes('kurye'),
    kind: 'delivery',
    tier: 'tier-local',
    tierLabel: 'Yerel Girişim',
  },
  {
    match: (s) =>
      s === 'factory' || s.includes('factory') || s.includes('fabrika'),
    kind: 'factory',
    tier: 'tier-local',
    tierLabel: 'Yerel Girişim',
  },
  {
    match: (s) => s === 'tech_company' || s === 'tech' || s.includes('tech'),
    kind: 'tech',
    tier: 'tier-tech',
    tierLabel: 'Teknoloji & Finans',
  },
  {
    match: (s) =>
      s === 'global_holding' || s === 'holding' || s.includes('holding'),
    kind: 'holding',
    tier: 'tier-tech',
    tierLabel: 'Teknoloji & Finans',
  },
  {
    match: (s) =>
      s === 'crypto_mining' || s.includes('mining') || s.includes('maden'),
    kind: 'crypto_mining',
    tier: 'tier-tech',
    tierLabel: 'Teknoloji & Finans',
  },
  {
    match: (s) =>
      s === 'blockchain_bank' || s.includes('bank') || s.includes('blokzincir'),
    kind: 'blockchain_bank',
    tier: 'tier-tech',
    tierLabel: 'Teknoloji & Finans',
  },
  {
    match: (s) =>
      s === 'ai_datacenter' || s.includes('datacenter') || s.includes('veri'),
    kind: 'ai_datacenter',
    tier: 'tier-quantum',
    tierLabel: 'Kuantum & Yapay Zeka',
  },
  {
    match: (s) =>
      s === 'cyber_security' ||
      s.includes('security') ||
      s.includes('guvenlik'),
    kind: 'cyber_security',
    tier: 'tier-quantum',
    tierLabel: 'Kuantum & Yapay Zeka',
  },
  {
    match: (s) =>
      s === 'fintech_giant' || s.includes('fintech') || s.includes('fintek'),
    kind: 'fintech_giant',
    tier: 'tier-quantum',
    tierLabel: 'Kuantum & Yapay Zeka',
  },
  {
    match: (s) =>
      s === 'quantum_lab' || s.includes('quantum') || s.includes('kuantum'),
    kind: 'quantum_lab',
    tier: 'tier-quantum',
    tierLabel: 'Kuantum & Yapay Zeka',
  },
  {
    match: (s) =>
      s === 'satellite_network' ||
      s.includes('satellite') ||
      s.includes('uydu'),
    kind: 'satellite_network',
    tier: 'tier-space',
    tierLabel: 'Galaktik Boyut',
  },
  {
    match: (s) =>
      s === 'spaceport_logistics' ||
      s.includes('spaceport') ||
      s.includes('uzay'),
    kind: 'spaceport_logistics',
    tier: 'tier-space',
    tierLabel: 'Galaktik Boyut',
  },
  {
    match: (s) =>
      s === 'orbital_colony' || s.includes('colony') || s.includes('yorunge'),
    kind: 'orbital_colony',
    tier: 'tier-space',
    tierLabel: 'Galaktik Boyut',
  },
  {
    match: (s) =>
      s === 'galactic_federation' ||
      s.includes('galactic') ||
      s.includes('federation'),
    kind: 'galactic_federation',
    tier: 'tier-space',
    tierLabel: 'Galaktik Boyut',
  },
];

function resolveBusinessVisual(
  slug: string,
  index: number,
): BusinessVisualMetadata {
  const normalized = slug.toLowerCase();
  const matched = BUSINESS_KIND_MAPPINGS.find((m) => m.match(normalized));
  if (matched) {
    return matched;
  }
  const fallbackIndex = index % BUSINESS_KIND_MAPPINGS.length;
  return BUSINESS_KIND_MAPPINGS[fallbackIndex]!;
}

function BusinessSilhouette({ kind }: { kind: string }) {
  const art: Record<string, React.ReactNode> = {
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
    crypto_mining: (
      <>
        <rect x="7" y="12" width="36" height="26" rx="4" />
        <circle cx="17" cy="25" r="6" />
        <circle cx="33" cy="25" r="6" />
        <path d="M17 21v8m-4-4h8M33 21v8m-4-4h8M14 7h22M19 7v5M31 7v5" />
      </>
    ),
    blockchain_bank: (
      <>
        <path d="M7 43h36M10 17h30M25 7l18 10H7z" />
        <path d="M13 17v26M21 17v26M29 17v26M37 17v26" />
        <circle cx="25" cy="30" r="3" />
      </>
    ),
    ai_datacenter: (
      <>
        <rect x="10" y="8" width="30" height="10" rx="2" />
        <rect x="10" y="20" width="30" height="10" rx="2" />
        <rect x="10" y="32" width="30" height="10" rx="2" />
        <circle cx="16" cy="13" r="1.5" />
        <circle cx="16" cy="25" r="1.5" />
        <circle cx="16" cy="37" r="1.5" />
        <path d="M22 13h12M22 25h12M22 37h12" />
      </>
    ),
    cyber_security: (
      <>
        <path d="M25 6l16 6v12c0 10-7 18-16 21-9-3-16-11-16-21V12z" />
        <rect x="20" y="23" width="10" height="8" rx="2" />
        <path d="M22 23v-3a3 3 0 016 0v3" />
      </>
    ),
    fintech_giant: (
      <>
        <path d="M25 7l15 9v18l-15 9-15-9V16z" />
        <path d="M16 29l6-6 5 4 7-9M34 18h-6m6 0v6" />
      </>
    ),
    quantum_lab: (
      <>
        <circle cx="25" cy="25" r="4" />
        <ellipse cx="25" cy="25" rx="19" ry="8" transform="rotate(-30 25 25)" />
        <ellipse cx="25" cy="25" rx="19" ry="8" transform="rotate(30 25 25)" />
        <ellipse cx="25" cy="25" rx="19" ry="8" transform="rotate(90 25 25)" />
      </>
    ),
    satellite_network: (
      <>
        <rect
          x="19"
          y="19"
          width="12"
          height="12"
          rx="2"
          transform="rotate(45 25 25)"
        />
        <path d="M8 12l9 9M33 29l9 9M7 17l6-6M37 37l6-6" />
        <path d="M25 15V8m-5 0h10M25 35v7" />
      </>
    ),
    spaceport_logistics: (
      <>
        <path d="M25 6c-3 8-7 18-7 28h14c0-10-4-20-7-28z" />
        <path d="M18 34l-5 5v3h5l2-3M32 34l5 5v3h-5l-2-3" />
        <circle cx="25" cy="20" r="3" />
        <path d="M22 42h6" />
      </>
    ),
    orbital_colony: (
      <>
        <ellipse cx="25" cy="25" rx="20" ry="9" />
        <circle cx="25" cy="25" r="5" />
        <path d="M25 7v9M25 34v9M6 25h10M34 25h10" />
        <circle cx="10" cy="23" r="2" />
        <circle cx="40" cy="27" r="2" />
      </>
    ),
    galactic_federation: (
      <>
        <circle cx="25" cy="25" r="18" strokeDasharray="4 2" />
        <polygon points="25,11 29,20 39,20 31,26 34,36 25,30 16,36 19,26 11,20 21,20" />
        <circle cx="25" cy="25" r="4" />
      </>
    ),
  };

  return (
    <svg className="empire-business-art" viewBox="0 0 50 50" aria-hidden="true">
      {art[kind] || art.stand}
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
      {/* Staggered animated window lights */}
      <path
        className="empire-skyline-line empire-skyline-line-1"
        d="M57 104h13m-13 17h13m66-50h14m-14 20h14m128-84h15m-15 23h15"
      />
      <path
        className="empire-skyline-line empire-skyline-line-2"
        d="M123 94h14m-14 20h14m128 46h15m-15 23h15m64-23h14m-14 20h14"
      />
      <path
        d="M279 25V8m-9 0h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Blinking communications tower beacon */}
      <circle
        className="empire-skyline-beacon-pulse"
        cx="279"
        cy="8"
        r="8"
        fill="var(--accent)"
      />
      <circle
        className="empire-skyline-beacon"
        cx="279"
        cy="8"
        r="3"
        fill="#ffffff"
      />
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
  const [isJustUpgraded, setIsJustUpgraded] = useState(false);
  const prevLevelRef = useRef(business.level);

  useEffect(() => {
    if (business.level > prevLevelRef.current) {
      setIsJustUpgraded(true);
      const timer = setTimeout(() => setIsJustUpgraded(false), 1400);
      prevLevelRef.current = business.level;
      return () => clearTimeout(timer);
    }
    prevLevelRef.current = business.level;
  }, [business.level]);

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

  const visual = resolveBusinessVisual(business.slug, index);

  const handleUpgradeClick = () => {
    if (!onUpgrade || disabled) return;
    setIsJustUpgraded(true);
    setTimeout(() => setIsJustUpgraded(false), 1400);
    onUpgrade(business.slug);
  };

  return (
    <article
      className={`empire-business-card ${visual.tier}${
        business.recommended ? ' is-recommended' : ''
      }${unopened && unaffordable ? ' is-locked' : ''}${
        isJustUpgraded ? ' card-upgrade-burst' : ''
      }`}
    >
      {isJustUpgraded && (
        <div className="card-upgrade-shine" aria-hidden="true" />
      )}
      <div className="empire-business-topline">
        <span className="empire-business-icon">
          <BusinessSilhouette kind={visual.kind} />
        </span>
        <div>
          <div className="empire-business-level-row">
            <p className="eyebrow">SEVİYE {Math.max(0, business.level)}</p>
            <span className="empire-tier-tag">{visual.tierLabel}</span>
          </div>
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
        className={`button secondary empire-upgrade-button${
          isJustUpgraded ? ' button-upgraded-pulse' : ''
        }`}
        type="button"
        disabled={disabled}
        onClick={handleUpgradeClick}
        aria-label={`${business.name}: ${actionLabel}`}
      >
        {actionLabel}
      </button>
    </article>
  );
}

interface FloatingCoin {
  id: number;
  tx: number;
  ty: number;
  rot: number;
  curveX: number;
  delay: number;
}

interface FloatingClaimBadge {
  id: number;
  amountText: string;
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
  referralLink = '',
  clanTag,
  clanName,
}: EmpireScreenProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [floatingCoins, setFloatingCoins] = useState<FloatingCoin[]>([]);
  const [floatingClaimBadge, setFloatingClaimBadge] =
    useState<FloatingClaimBadge | null>(null);
  const [isClaimBursting, setIsClaimBursting] = useState(false);
  const prevClaimableRef = useRef<number | null>(null);

  const triggerClaimFlightAnimation = (amount: number) => {
    const amountToFormat = amount > 0 ? amount : 1400000;
    const formatted = `+₺${formatNumber(amountToFormat, true)}`;
    const badgeId = Date.now();
    setFloatingClaimBadge({ id: badgeId, amountText: formatted });
    setIsClaimBursting(true);

    const newCoins: FloatingCoin[] = Array.from({ length: 9 }, (_, i) => ({
      id: badgeId + i,
      tx: Math.round((Math.random() - 0.5) * 120),
      ty: Math.round(-240 - Math.random() * 120),
      rot: Math.round(180 + Math.random() * 360),
      curveX: Math.round((Math.random() - 0.5) * 80),
      delay: i * 75,
    }));
    setFloatingCoins(newCoins);

    setTimeout(() => {
      setIsClaimBursting(false);
    }, 1800);

    setTimeout(() => {
      setFloatingCoins([]);
      setFloatingClaimBadge((prev) => (prev?.id === badgeId ? null : prev));
    }, 2200);
  };

  useEffect(() => {
    const claimable = resource.data?.claimable;
    if (
      prevClaimableRef.current !== null &&
      prevClaimableRef.current > 0 &&
      (claimable === 0 || claimable === null)
    ) {
      triggerClaimFlightAnimation(prevClaimableRef.current);
    }
    prevClaimableRef.current = claimable ?? null;
  }, [resource.data?.claimable]);

  useEffect(() => {
    const claimable = resource.data?.claimable;
    if (claimable && claimable > 0) {
      const timer = setInterval(() => {
        const periodicId = Date.now();
        const miniCoin: FloatingCoin = {
          id: periodicId,
          tx: Math.round((Math.random() - 0.5) * 60),
          ty: -180,
          rot: 180,
          curveX: 20,
          delay: 0,
        };
        setFloatingCoins((prev) => [...prev, miniCoin]);
        setTimeout(() => {
          setFloatingCoins((prev) => prev.filter((c) => c.id !== periodicId));
        }, 1800);
      }, 20000);
      return () => clearInterval(timer);
    }
  }, [resource.data?.claimable]);

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

  const handleClaim = () => {
    if (!onClaim || !canClaim) return;
    triggerClaimFlightAnimation(data.claimable || 1400000);
    onClaim();
  };

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

      {/* Referral Quick Touchpoint */}
      {referralLink && (
        <div
          className="panel referral-quick-card"
          style={{
            background:
              'linear-gradient(135deg, rgba(241, 201, 154, 0.15), rgba(76, 175, 80, 0.12))',
            border: '1px solid rgba(241, 201, 154, 0.35)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <strong
              style={{ display: 'block', fontSize: '15px', color: '#f1c99a' }}
            >
              🤝 Ortak Yatırımcı Çağır (+5.000 Nakit)
            </strong>
            <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
              Arkadaşlarını davet et, anında <strong>+5.000 Nakit</strong>,
              %7'ye varan kademeli komisyon ve{' '}
              <strong>%0.1 ortak ciro primi</strong> kazan!
            </span>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => setIsShareModalOpen(true)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            🚀 Davet Et
          </button>
        </div>
      )}

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
            <div className="empire-claim-action-wrap">
              <button
                className={`button empire-claim-btn${isClaimBursting ? ' is-claiming-burst' : ''}`}
                type="button"
                disabled={!canClaim}
                onClick={handleClaim}
              >
                {isClaimPending
                  ? 'Toplanıyor…'
                  : claimRetryAvailable
                    ? 'Tekrar dene'
                    : 'Geliri topla'}
              </button>
              {floatingClaimBadge && (
                <span
                  className="floating-claim-badge"
                  key={floatingClaimBadge.id}
                >
                  {floatingClaimBadge.amountText}
                </span>
              )}
              {floatingCoins.length > 0 && (
                <div className="floating-coins-container" aria-hidden="true">
                  {floatingCoins.map((coin) => (
                    <span
                      key={coin.id}
                      className="floating-gold-coin"
                      style={
                        {
                          '--coin-tx': `${coin.tx}px`,
                          '--coin-ty': `${coin.ty}px`,
                          '--coin-rot': `${coin.rot}deg`,
                          '--coin-curve-x': `${coin.curveX}px`,
                          animationDelay: `${coin.delay}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <svg viewBox="0 0 24 24" className="gold-coin-svg">
                        <defs>
                          <linearGradient
                            id="goldCoinGrad"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#fff2a8" />
                            <stop offset="45%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="12"
                          cy="12"
                          r="10.5"
                          fill="url(#goldCoinGrad)"
                          stroke="#fef08a"
                          strokeWidth="1"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="8.5"
                          fill="none"
                          stroke="#78350f"
                          strokeWidth="0.8"
                          strokeDasharray="2 1.5"
                        />
                        <text
                          x="12"
                          y="16.5"
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="900"
                          fill="#78350f"
                        >
                          ₺
                        </text>
                      </svg>
                    </span>
                  ))}
                </div>
              )}
            </div>
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

      <ShareReferralModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        referralLink={referralLink}
        clanName={clanName}
        clanTag={clanTag}
      />
    </section>
  );
}
