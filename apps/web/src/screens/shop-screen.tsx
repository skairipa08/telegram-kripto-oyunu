import type { ActionFeedback } from '../game/live-game-model';
import type { ScreenResource, ShopView } from '../game/types';
import {
  EmptyState,
  formatNumber,
  ResourceNotice,
  SectionTitle,
} from '../game/ui';
import './shop-analytics.css';

export type ShopScreenProps = {
  resource: ScreenResource<ShopView>;
  starsPaymentsEnabled?: boolean;
  onPurchase?: (sku: string) => void;
  purchasingSku?: string | null;
  purchaseFeedback?: ActionFeedback | null;
};

function formatExpiry(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function StarPrice({ value }: { value: number }) {
  return (
    <span
      className="sa-price"
      aria-label={`${formatNumber(value)} Telegram Yıldızı`}
    >
      <span aria-hidden="true">★</span>
      {formatNumber(value)}
    </span>
  );
}

function PassEmblem() {
  return (
    <svg className="sa-pass-emblem" viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r="57" />
      <circle cx="66" cy="66" r="46" />
      <path d="M38 82V51l28-16 28 16v31L66 98 38 82Z" />
      <path d="M50 78V58l16-9 16 9v20L66 87 50 78Z" />
      <path d="M66 35v14M38 51l12 7m44-7-12 7M66 87v11" />
      <circle cx="66" cy="68" r="6" />
    </svg>
  );
}

function CosmeticArt({ variant }: { variant: 'frame' | 'emblem' }) {
  if (variant === 'frame') {
    return (
      <svg viewBox="0 0 240 154" aria-hidden="true">
        <defs>
          <linearGradient id="saFrameMetal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1c99a" />
            <stop offset=".48" stopColor="#8c5a36" />
            <stop offset="1" stopColor="#dfaa72" />
          </linearGradient>
        </defs>
        <rect x="34" y="16" width="172" height="122" rx="24" />
        <rect x="46" y="28" width="148" height="98" rx="18" />
        <path d="M34 58 18 77l16 19m172-38 16 19-16 19M80 16 96 5h48l16 11M80 138l16 11h48l16-11" />
        <circle cx="120" cy="77" r="29" />
        <path
          className="sa-art-metal"
          d="m120 53 7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2 7-15Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 240 154" aria-hidden="true">
      <defs>
        <linearGradient id="saEmblemMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1c99a" />
          <stop offset=".5" stopColor="#9b6844" />
          <stop offset="1" stopColor="#e5b47d" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="77" r="58" />
      <circle cx="120" cy="77" r="47" />
      <path
        className="sa-art-metal"
        d="M120 37 153 55v39l-33 23-33-23V55l33-18Z"
      />
      <path d="M103 91V67l17-10 17 10v24l-17 10-17-10Zm17-34V37m-33 18-15-9m81 9 15-9" />
      <circle cx="120" cy="79" r="7" />
    </svg>
  );
}

export function ShopScreen({
  resource,
  starsPaymentsEnabled = false,
  onPurchase,
  purchasingSku = null,
  purchaseFeedback = null,
}: ShopScreenProps) {
  if (resource.status !== 'ready' || !resource.data) {
    const unavailableResource: ScreenResource<unknown> = resource.data
      ? resource
      : {
          ...resource,
          status: resource.status === 'ready' ? 'unavailable' : resource.status,
        };
    return (
      <section className="sa-screen sa-shop" aria-labelledby="shop-title">
        <SectionTitle eyebrow="SEÇKİN KOLEKSİYON" title="Mağaza" />
        <ResourceNotice resource={unavailableResource} label="Mağaza" />
      </section>
    );
  }

  const { passActive, expiresAt, products } = resource.data;
  const pass = products.find((product) => product.type === 'convenience_pass');
  const cosmetics = products
    .filter((product) => product.type === 'cosmetic')
    .slice(0, 2);
  const expiry = passActive ? formatExpiry(expiresAt) : null;

  const isPassPurchasing = purchasingSku === pass?.sku;
  const isAnyPurchasing = purchasingSku !== null;

  return (
    <section className="sa-screen sa-shop" aria-labelledby="shop-title">
      <SectionTitle
        eyebrow="SEÇKİN KOLEKSİYON"
        title="Mağaza"
        description="Şehrinin ritmini koruyan ayrıcalıklar ve imparatorluğuna karakter katan seçkin parçalar."
        action={
          passActive ? (
            <span className="badge sa-active-badge">Empire Pass aktif</span>
          ) : !starsPaymentsEnabled ? (
            <span className="badge sa-badge-soon">Yakında</span>
          ) : undefined
        }
      />

      {purchaseFeedback && (
        <div
          className={`sa-feedback-banner ${purchaseFeedback.kind}`}
          role={purchaseFeedback.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span>{purchaseFeedback.message}</span>
        </div>
      )}

      {pass ? (
        <article className="sa-pass-card" aria-labelledby="empire-pass-title">
          <div className="sa-pass-glow" aria-hidden="true" />
          <div className="sa-pass-copy">
            <div className="sa-pass-header-row">
              <p className="eyebrow">AYRICALIK ÜYELİĞİ</p>
              {!starsPaymentsEnabled && (
                <span className="badge sa-badge-soon">Yakında</span>
              )}
            </div>
            <h2 id="empire-pass-title">Empire Pass</h2>
            <p className="sa-pass-product-name">{pass.name}</p>
            <p>{pass.description}</p>
            <div className="sa-pass-meta">
              {pass.durationDays !== null && (
                <span>
                  <strong>{formatNumber(pass.durationDays)}</strong> gün erişim
                </span>
              )}
              {passActive && expiry && (
                <span>
                  <strong>{expiry}</strong> tarihine kadar
                </span>
              )}
              {passActive && !expiry && (
                <span>Bitiş tarihi henüz iletilmedi</span>
              )}
            </div>
          </div>
          <div className="sa-pass-seal">
            <PassEmblem />
            <StarPrice value={pass.price} />
            <button
              className="button sa-buy-button"
              type="button"
              disabled={
                !starsPaymentsEnabled ||
                isAnyPurchasing ||
                (passActive && !isPassPurchasing)
              }
              onClick={() => {
                if (starsPaymentsEnabled && onPurchase) {
                  onPurchase(pass.sku);
                }
              }}
            >
              {!starsPaymentsEnabled
                ? 'Satışlar yakında'
                : isPassPurchasing
                  ? 'Ödeme açılıyor…'
                  : passActive
                    ? 'Empire Pass Aktif'
                    : 'Empire Pass Al'}
            </button>
          </div>
        </article>
      ) : (
        <EmptyState
          title="Empire Pass henüz listelenmiyor"
          description="Üyelik ürünü mağaza verisine eklendiğinde süre ve yıldız fiyatı burada görünecek."
        />
      )}

      <section
        className="panel sa-comparison"
        aria-labelledby="pass-comparison-title"
      >
        <div className="sa-comparison-heading">
          <div>
            <p className="eyebrow">PLAN ÖZELLİKLERİ</p>
            <h2 id="pass-comparison-title">Günlük akışına daha fazla alan</h2>
          </div>
          <span className="badge">Bilgilendirme</span>
        </div>
        <p className="muted sa-plan-note">
          Bu avantajlar planlanan üyelik kapsamını gösterir; satışlar başlayana
          kadar etkin değildir.
        </p>
        <div
          className="sa-comparison-table"
          role="table"
          aria-label="Ücretsiz plan ve Empire Pass karşılaştırması"
        >
          <div className="sa-comparison-row sa-comparison-labels" role="row">
            <span role="columnheader">Özellik</span>
            <span role="columnheader">Ücretsiz</span>
            <span role="columnheader">Pass</span>
          </div>
          {[
            ['Çevrimdışı kazanç', '4 saat', '12 saat'],
            ['Üretim kuyruğu', '1', '3'],
            ['Günlük görev yenileme', '1', '3'],
            ['Sezon puanı', '×1', '×1'],
          ].map(([feature, free, premium]) => (
            <div className="sa-comparison-row" role="row" key={feature}>
              <span role="rowheader">{feature}</span>
              <span role="cell">{free}</span>
              <strong role="cell">{premium}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="sa-cosmetics" aria-labelledby="cosmetics-title">
        <div className="sa-subheading">
          <div>
            <p className="eyebrow">KOLEKSİYON</p>
            <h2 id="cosmetics-title">Şehrinin imzası</h2>
          </div>
          <p className="muted">Yalnızca görsel özelleştirme</p>
        </div>
        {cosmetics.length > 0 ? (
          <div className="sa-cosmetic-grid">
            {cosmetics.map((product, index) => {
              const isThisPurchasing = purchasingSku === product.sku;
              return (
                <article className="panel sa-cosmetic-card" key={product.sku}>
                  <div className="sa-cosmetic-art">
                    <CosmeticArt variant={index === 0 ? 'frame' : 'emblem'} />
                  </div>
                  <div className="sa-cosmetic-copy">
                    <div>
                      <div className="sa-cosmetic-title-row">
                        <h3>{product.name}</h3>
                        {!starsPaymentsEnabled && (
                          <span className="badge sa-badge-soon">Yakında</span>
                        )}
                      </div>
                      <p className="muted">{product.description}</p>
                    </div>
                    <StarPrice value={product.price} />
                  </div>
                  <button
                    className="button secondary sa-cosmetic-buy"
                    type="button"
                    disabled={!starsPaymentsEnabled || isAnyPurchasing}
                    onClick={() => {
                      if (starsPaymentsEnabled && onPurchase) {
                        onPurchase(product.sku);
                      }
                    }}
                  >
                    {!starsPaymentsEnabled
                      ? 'Satışlar yakında'
                      : isThisPurchasing
                        ? 'Ödeme açılıyor…'
                        : 'Satın Al'}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Kozmetik koleksiyon hazırlanıyor"
            description="Gerçek ürünler mağazaya eklendiğinde çerçeve ve amblemler burada listelenecek."
          />
        )}
      </section>

      <footer className="sa-support panel" aria-label="Mağaza desteği">
        <span className="sa-support-mark" aria-hidden="true">
          ◇
        </span>
        <div>
          <h2>Satın alma desteği</h2>
          <p className="muted">
            Satışlar açıldığında teslimat ve destek bilgileri bu bölümde yer
            alacak. Henüz bir satın alma geçmişi oluşturulmadı.
          </p>
        </div>
      </footer>
    </section>
  );
}
