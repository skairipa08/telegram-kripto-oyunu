import { useState } from 'react';
import type { FriendsView, ScreenResource } from '../game/types';
import type { ActionFeedback } from '../game/live-game-model';
import {
  EmptyState,
  formatNumber,
  ResourceNotice,
  SectionTitle,
} from '../game/ui';
import './social.css';

type FriendsScreenProps = {
  resource: ScreenResource<FriendsView>;
  bindingFeedback?: ActionFeedback | null;
  onRetryBinding?: (() => void) | undefined;
};

const referralMilestones = [1, 3, 5, 10, 25, 50] as const;

const journeySteps = [
  { label: 'Aktivasyon', detail: 'Oyuna katılım', reward: '0,5 SRU' },
  { label: '2. gün', detail: 'Geri dönüş', reward: '1 SRU' },
  { label: '7. gün', detail: 'Haftalık bağlılık', reward: '2 SRU' },
  { label: 'İlerleme', detail: 'Ekonomide gelişim', reward: '1,5 SRU' },
] as const;

export function isSafeTelegramInvite(value: string) {
  try {
    const url = new URL(value);
    const params = [...url.searchParams.entries()];

    return (
      url.protocol === 'https:' &&
      url.hostname === 't.me' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.hash === '' &&
      /^\/[A-Za-z0-9_]+\/?$/.test(url.pathname) &&
      params.length === 1 &&
      params[0]?.[0] === 'startapp' &&
      /^ref_[A-Za-z0-9]+$/.test(params[0]?.[1] ?? '')
    );
  } catch {
    return false;
  }
}

function nextReferralTarget(qualified: number) {
  return referralMilestones.find((target) => target > qualified) ?? null;
}

function FriendsArtwork() {
  return (
    <svg
      className="friends-artwork"
      viewBox="0 0 320 164"
      role="img"
      aria-label="Birlikte yükselen şehir silüeti"
    >
      <path
        className="friends-artwork-sun"
        d="M213 26a45 45 0 0 1 45 45h-90a45 45 0 0 1 45-45Z"
      />
      <path
        className="friends-artwork-back"
        d="M12 132V96h28V65h30v67h18V83h35v49h17V48h46v84h18V74h35v58h18V91h39v41Z"
      />
      <path
        className="friends-artwork-front"
        d="M0 143v-20h38V99h27v44h43v-27h28v27h38V88h29v55h41v-32h30v32h46v21H0Z"
      />
      <path
        className="friends-artwork-line"
        d="M14 143h292M29 112h22m105-45h15m51 22h17m16 37h20"
      />
      <circle className="friends-artwork-coin" cx="67" cy="45" r="18" />
      <path className="friends-artwork-mark" d="M60 45h14m-7-7v14" />
    </svg>
  );
}

export function FriendsScreen({
  resource,
  bindingFeedback = null,
  onRetryBinding,
}: FriendsScreenProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const data = resource.status === 'ready' ? resource.data : null;

  const copyInvite = async () => {
    if (!data || !isSafeTelegramInvite(data.link)) {
      setCopyStatus('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(data.link);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  if (!data) {
    return (
      <section className="social-screen friends-screen" aria-label="Arkadaşlar">
        <SectionTitle
          eyebrow="Ortak büyüme"
          title="Arkadaşlar"
          description="Davet ettiğin oyuncuların kalıcı ilerlemesi, imparatorluğuna yeni bir gelir hattı açar."
        />
        {bindingFeedback && (
          <>
            <p
              className={`copy-status ${bindingFeedback.kind === 'error' ? 'is-error' : ''}`}
              role={bindingFeedback.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {bindingFeedback.message}
            </p>
            {onRetryBinding && (
              <button
                className="button secondary"
                type="button"
                onClick={onRetryBinding}
              >
                Tekrar dene
              </button>
            )}
          </>
        )}
        {resource.status === 'unavailable' && (
          <div className="panel social-context-panel">
            <p className="eyebrow">Nasıl işler?</p>
            <p>
              Her oyuncu aktivasyondan düzenli ilerlemeye uzanan dört aşamadan
              geçer. Nitelikli davetler bir sonraki ödül eşiğine birlikte
              ilerler.
            </p>
          </div>
        )}
        <ResourceNotice resource={resource} label="Arkadaş ağı" />
      </section>
    );
  }

  const nextTarget = nextReferralTarget(data.qualified);
  const safeInvite = isSafeTelegramInvite(data.link);

  return (
    <section className="social-screen friends-screen" aria-label="Arkadaşlar">
      <SectionTitle
        eyebrow="Ortak büyüme"
        title="Arkadaşlar"
        description="Güçlü ekonomiler tek başına kurulmaz. Ekibini davet et, kalıcı ilerlemeyi birlikte büyüt."
      />

      {bindingFeedback && (
        <>
          <p
            className={`copy-status ${bindingFeedback.kind === 'error' ? 'is-error' : ''}`}
            role={bindingFeedback.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {bindingFeedback.message}
          </p>
          {onRetryBinding && (
            <button
              className="button secondary"
              type="button"
              onClick={onRetryBinding}
            >
              Tekrar dene
            </button>
          )}
        </>
      )}

      <div className="friends-invite panel">
        <div className="friends-invite-copy">
          <p className="eyebrow">Özel davet hattın</p>
          <h2>Şehre yeni ortaklar çağır</h2>
          <p className="muted">
            Bağlantıyı dilediğin yerde paylaş. Gönderim yalnızca senin
            kontrolünde kalır.
          </p>
          <div className="invite-link-strip">
            <span
              className="invite-link"
              title={safeInvite ? data.link : undefined}
            >
              {safeInvite ? data.link : 'Davet bağlantısı kullanılamıyor'}
            </span>
            <button
              className="button invite-copy-button"
              type="button"
              onClick={() => void copyInvite()}
              disabled={!safeInvite}
            >
              {copyStatus === 'copied' ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
            </button>
          </div>
          <p
            className={`copy-status ${copyStatus === 'error' ? 'is-error' : ''}`}
            aria-live="polite"
          >
            {copyStatus === 'copied' && 'Davet bağlantısı panoya kopyalandı.'}
            {copyStatus === 'error' &&
              (safeInvite
                ? 'Bağlantı kopyalanamadı. Tarayıcı izinlerini kontrol et.'
                : 'Güvenli bir Telegram davet bağlantısı alınamadı.')}
          </p>
        </div>
        <FriendsArtwork />
      </div>

      <div
        className="panel referral-mutual-bonus-banner"
        style={{
          background:
            'linear-gradient(135deg, rgba(241, 201, 154, 0.15), rgba(76, 175, 80, 0.12))',
          border: '1px solid rgba(241, 201, 154, 0.3)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <span style={{ fontSize: '28px' }} aria-hidden="true">
          🎁
        </span>
        <div>
          <strong
            style={{ display: 'block', fontSize: '15px', color: '#f1c99a' }}
          >
            Karşılıklı +5.000 Nakit Başlangıç Bonusu
          </strong>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>
            Davet ettiğin her arkadaşın ve sen anında{' '}
            <strong>5.000'er Nakit</strong> kazanırsınız. Sınırsız davet!
          </span>
        </div>
      </div>

      <div className="friends-metrics" aria-label="Davet özeti">
        <div className="metric">
          <span>Nitelikli davet</span>
          <strong>{formatNumber(data.qualified)}</strong>
        </div>
        <div className="metric">
          <span>Toplam davet</span>
          <strong>{formatNumber(data.totalInvites)}</strong>
        </div>
        <div className="metric">
          <span>Komisyon Oranı</span>
          <strong style={{ color: '#22c55e' }}>
            %{data.totalInvites <= 10 ? 3 : data.totalInvites <= 30 ? 5 : 7}
          </strong>
        </div>
        <div className="metric">
          <span>Kazanılan puan</span>
          <strong>{formatNumber(data.earnedPoints)} SRU</strong>
        </div>
      </div>

      <div
        className="panel referral-commission-panel"
        style={{
          marginTop: '16px',
          padding: '16px 18px',
          borderRadius: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <div>
            <p className="eyebrow">KADEMELİ GELİR PAYI</p>
            <h3 style={{ margin: 0 }}>Ortak Kazanç Komisyonu</h3>
          </div>
          <span
            className="badge"
            style={{
              backgroundColor: '#22c55e',
              color: '#fff',
              fontWeight: 'bold',
            }}
          >
            Aktif Oran: %
            {data.totalInvites <= 10 ? 3 : data.totalInvites <= 30 ? 5 : 7}
          </span>
        </div>
        <p className="muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          Davet ettiğin tüm ortaklarının anlık kazançlarından kalıcı ve pasif
          komisyon kazanırsın.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '8px',
          }}
        >
          <div
            style={{
              padding: '10px',
              borderRadius: '8px',
              border:
                data.totalInvites <= 10
                  ? '1px solid #f1c99a'
                  : '1px solid rgba(255,255,255,0.08)',
              background:
                data.totalInvites <= 10
                  ? 'rgba(241, 201, 154, 0.08)'
                  : 'transparent',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '12px', opacity: 0.8, display: 'block' }}>
              0 - 10 Davet
            </span>
            <strong style={{ fontSize: '16px', color: '#f1c99a' }}>
              %3 Pasif
            </strong>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: '8px',
              border:
                data.totalInvites > 10 && data.totalInvites <= 30
                  ? '1px solid #f1c99a'
                  : '1px solid rgba(255,255,255,0.08)',
              background:
                data.totalInvites > 10 && data.totalInvites <= 30
                  ? 'rgba(241, 201, 154, 0.08)'
                  : 'transparent',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '12px', opacity: 0.8, display: 'block' }}>
              11 - 30 Davet
            </span>
            <strong style={{ fontSize: '16px', color: '#f1c99a' }}>
              %5 Pasif
            </strong>
          </div>
          <div
            style={{
              padding: '10px',
              borderRadius: '8px',
              border:
                data.totalInvites > 30
                  ? '1px solid #22c55e'
                  : '1px solid rgba(255,255,255,0.08)',
              background:
                data.totalInvites > 30
                  ? 'rgba(34, 197, 94, 0.1)'
                  : 'transparent',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '12px', opacity: 0.8, display: 'block' }}>
              31+ Davet
            </span>
            <strong style={{ fontSize: '16px', color: '#22c55e' }}>
              %7 Pasif (Maks)
            </strong>
          </div>
        </div>
      </div>

      <div className="referral-progress panel">
        <div className="referral-progress-heading">
          <div>
            <p className="eyebrow">Davet ödülleri</p>
            <h2>
              {nextTarget
                ? `Sıradaki eşik: ${nextTarget} nitelikli davet`
                : 'Tüm davet eşikleri tamamlandı'}
            </h2>
          </div>
          <span className="badge">
            {formatNumber(data.qualified)} nitelikli
          </span>
        </div>
        <progress
          aria-label={
            nextTarget
              ? `${nextTarget} davetlik sonraki eşiğe ilerleme`
              : 'Tüm davet eşikleri tamamlandı'
          }
          value={nextTarget ? Math.min(data.qualified, nextTarget) : 50}
          max={nextTarget ?? 50}
        />
        <div className="referral-milestones" aria-hidden="true">
          {referralMilestones.map((target) => (
            <span
              key={target}
              className={data.qualified >= target ? 'is-reached' : ''}
            >
              {target}
            </span>
          ))}
        </div>
      </div>

      <div className="journey-section">
        <div className="social-subheading">
          <p className="eyebrow">Oyuncu yolculuğu</p>
          <h2>Dört aşamada nitelikli ilerleme</h2>
        </div>
        <ol className="journey-grid">
          {journeySteps.map((step, index) => (
            <li className="journey-step panel" key={step.label}>
              <span className="journey-index">0{index + 1}</span>
              <div>
                <h3>{step.label}</h3>
                <p className="muted">{step.detail}</p>
              </div>
              <strong>{step.reward}</strong>
            </li>
          ))}
        </ol>
      </div>

      <div className="friends-list-section">
        <div className="social-subheading social-subheading-inline">
          <div>
            <p className="eyebrow">Ağın</p>
            <h2>Davet edilen oyuncular</h2>
          </div>
          <span className="badge">
            {data.friends === null
              ? 'Ayrıntı yok'
              : `${formatNumber(data.friends.length)} oyuncu`}
          </span>
        </div>
        {data.friends === null ? (
          <div className="resource-state" role="status">
            <h2>Davet ayrıntıları sunulmuyor</h2>
            <p>
              Gerçek davet toplamların yukarıda güncel kalır; oyuncu ayrıntıları
              API tarafından sağlandığında burada görünür.
            </p>
          </div>
        ) : data.friends.length === 0 ? (
          <EmptyState
            title="İlk ortağın için yer hazır"
            description="Davet bağlantını paylaşınca katılan oyuncuların ilerlemesi burada görünür."
          />
        ) : (
          <ul className="friends-list">
            {data.friends.map((friend, index) => (
              <li className="friend-row panel" key={`${friend.name}-${index}`}>
                <span className="friend-avatar" aria-hidden="true">
                  {friend.initial}
                </span>
                <div className="friend-identity">
                  <strong>{friend.name}</strong>
                  <span className="muted">{friend.stage}</span>
                </div>
                <span className="friend-days">
                  {formatNumber(friend.days)} gün
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
