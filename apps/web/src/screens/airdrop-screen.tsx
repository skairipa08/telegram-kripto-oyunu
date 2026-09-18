import { useState } from 'react';
import {
  calculateAirdropAllocation,
  validateTonAddress,
  type TONWalletProvider,
} from '@empire/game-core';
import { formatNumber } from '../game/ui';
import { triggerHaptic } from '../game/arcade-haptics';
import { playSuccessSound } from '../game/arcade-audio';
import './social.css';

export interface AirdropScreenProps {
  userSeasonPoints?: number;
  userCash?: number;
  userStreak?: number;
  userReferrals?: number;
  initialWalletAddress?: string | null;
  onWalletConnected?: ((address: string, provider: TONWalletProvider) => void) | undefined;
  onWalletDisconnected?: (() => void) | undefined;
}

export interface AirdropSocialTask {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: string;
  link: string;
  completed: boolean;
}

const DEFAULT_TASKS: AirdropSocialTask[] = [
  {
    id: 'tg_channel',
    title: 'Resmi Telegram Kanalına Katıl',
    description: 'En son airdrop duyurularını ve snapshot tarihlerini kaçırma.',
    points: 500,
    icon: '📢',
    link: 'https://t.me/ProjectEmpireNews',
    completed: false,
  },
  {
    id: 'x_twitter',
    title: 'X (Twitter) Hesabımızı Takip Et',
    description: 'Global kripto topluluğumuza katıl ve etkinlikleri takip et.',
    points: 500,
    icon: '🐦',
    link: 'https://x.com/ProjectEmpireTON',
    completed: false,
  },
  {
    id: 'youtube',
    title: 'YouTube Kanalımıza Abone Ol',
    description: 'Oyun rehberlerini ve strateji videolarını izle.',
    points: 500,
    icon: '▶️',
    link: 'https://youtube.com/@ProjectEmpireTON',
    completed: false,
  },
  {
    id: 'ton_connect',
    title: 'TON Cüzdanını Bağla',
    description: 'Airdrop tokenlarının gönderileceği cüzdan adresini doğrula.',
    points: 1000,
    icon: '💎',
    link: '#wallet',
    completed: false,
  },
];

export function AirdropScreen({
  userSeasonPoints = 12500,
  userCash = 250000,
  userStreak = 7,
  userReferrals = 3,
  initialWalletAddress = null,
  onWalletConnected,
  onWalletDisconnected,
}: AirdropScreenProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(initialWalletAddress);
  const [provider, setProvider] = useState<TONWalletProvider>('tonkeeper');
  const [inputAddress, setInputAddress] = useState<string>('');
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AirdropSocialTask[]>(DEFAULT_TASKS);

  const isConnected = Boolean(walletAddress);

  const allocation = calculateAirdropAllocation({
    seasonPoints: userSeasonPoints,
    cashEarned: userCash,
    streakDays: userStreak,
    qualifiedReferrals: userReferrals,
    hasConnectedWallet: isConnected,
  });

  const handleConnectWallet = (addrToConnect: string, selectedProvider: TONWalletProvider) => {
    const val = validateTonAddress(addrToConnect);
    if (!val.valid || !val.normalizedAddress) {
      setErrorMessage(val.error || 'Geçersiz TON adresi formatı.');
      return;
    }

    setWalletAddress(val.normalizedAddress);
    setProvider(selectedProvider);
    setShowConnectModal(false);
    setInputAddress('');
    setErrorMessage(null);
    setSuccessMessage('💎 TON cüzdanınız başarıyla kaydedildi (Airdrop Dağıtımı Çok Yakında).');
    triggerHaptic('notification_success');
    playSuccessSound();

    setTasks((current) =>
      current.map((t) => (t.id === 'ton_connect' ? { ...t, completed: true } : t)),
    );

    if (onWalletConnected) {
      onWalletConnected(val.normalizedAddress, selectedProvider);
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setSuccessMessage('Cüzdan bağlantısı kaldırıldı.');
    triggerHaptic('impact_light');
    setTasks((current) =>
      current.map((t) => (t.id === 'ton_connect' ? { ...t, completed: false } : t)),
    );
    if (onWalletDisconnected) {
      onWalletDisconnected();
    }
  };

  return (
    <div className="airdrop-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px' }}>
      {/* Hero Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 22, 33, 0.95) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          borderRadius: '16px',
          padding: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              textTransform: 'uppercase',
            }}
          >
            🔒 FAZ 1 HAZIRLIK (ÇOK YAKINDA / SOON)
          </span>
          <span style={{ fontSize: '12px', color: '#06b6d4', fontWeight: 700 }}>
            💎 The Open Network (TON)
          </span>
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>
          🪂 $EMPIRE Token Airdrop Portalı
        </h2>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
          Project Empire airdrop havuzu, sezon boyunca oyuna emek veren tüm oyunculara şeffaf kriterlerle dağıtılacaktır. Parayla token satışı yoktur (Anti-P2W).
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22c55e',
            color: '#86efac',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* TON Wallet Connection Card */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Airdrop Cüzdan Durumu
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
              {isConnected ? '🛡️ TON Cüzdanı Bağlandı' : '💎 TON Cüzdanı Bağlantısı'}
            </h3>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: '6px',
              background: isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.15)',
              color: isConnected ? '#86efac' : '#facc15',
              border: isConnected ? '1px solid #22c55e' : '1px solid #eab308',
            }}
          >
            {isConnected ? 'Doğrulandı' : 'Bekleniyor (Soon)'}
          </span>
        </div>

        {isConnected && walletAddress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#38bdf8',
                wordBreak: 'break-all',
              }}
            >
              {walletAddress}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
              <span>Sağlayıcı: <strong style={{ color: '#f8fafc' }}>{provider.toUpperCase()}</strong></span>
              <button
                type="button"
                onClick={handleDisconnect}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cüzdanı Kaldır
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Tonkeeper, Telegram @wallet veya MyTonWallet cüzdanınızı bağlayarak snapshot gününe hazırlanın ve <strong>+1.000 Airdrop Puanı</strong> kazanın.
            </p>
            <button
              type="button"
              className="button"
              onClick={() => setShowConnectModal(true)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 800,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              💎 TON Cüzdanı Bağla (Yakında)
            </button>
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#181e29',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              borderRadius: '20px',
              padding: '20px',
              maxWidth: '380px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                💎 TON Cüzdanı Seç
              </h3>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Airdrop cüzdanınızı bağlamak için sağlayıcınızı seçin veya TON adresinizi (EQ/UQ) doğrudan girin:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'tonkeeper' as const, name: 'Tonkeeper', icon: '🛡️' },
                { id: 'telegram_wallet' as const, name: 'Telegram @wallet', icon: '✈️' },
                { id: 'mytonwallet' as const, name: 'MyTonWallet', icon: '💎' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    // Demo connection address for frictionless test/preview
                    const demoAddr = 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcACZq';
                    handleConnectWallet(demoAddr, p.id);
                  }}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    color: '#f8fafc',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{p.icon} {p.name}</span>
                  <span style={{ fontSize: '11px', color: '#06b6d4' }}>Tek Tıkla Bağla (Yakında) →</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Veya Manuel TON Adresi Girin:</span>
              <input
                type="text"
                placeholder="EQ... veya UQ..."
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '12px',
                }}
              />
              <button
                type="button"
                onClick={() => handleConnectWallet(inputAddress, 'generic')}
                disabled={!inputAddress.trim()}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#e1b47e',
                  color: '#0a0e17',
                  fontWeight: 800,
                  border: 'none',
                  cursor: inputAddress.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '12px',
                  marginTop: '4px',
                }}
              >
                Adresi Doğrula & Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Airdrop Points & Tier Card */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
              Airdrop Tahsisi
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#f59e0b' }}>
              {formatNumber(allocation.totalAirdropPoints)} Puan
            </h3>
          </div>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#0a0e17',
              fontSize: '12px',
              fontWeight: 900,
            }}
          >
            ⭐ {allocation.tier} Kademe
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Sezon Puanı</span>
            <strong style={{ fontSize: '14px', color: '#f8fafc' }}>+{formatNumber(allocation.seasonPointsContribution)}</strong>
          </div>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Kasa Hacmi</span>
            <strong style={{ fontSize: '14px', color: '#f8fafc' }}>+{formatNumber(allocation.cashContribution)}</strong>
          </div>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Günlük Seri ({userStreak} Gün)</span>
            <strong style={{ fontSize: '14px', color: '#f8fafc' }}>+{formatNumber(allocation.streakContribution)}</strong>
          </div>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Cüzdan Bonusu</span>
            <strong style={{ fontSize: '14px', color: isConnected ? '#10b981' : '#64748b' }}>
              {isConnected ? '+1.000' : '0 (Bağla)'}
            </strong>
          </div>
        </div>
      </div>

      {/* Airdrop Social & Ecosystem Tasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
          🎯 Airdrop Görevleri
        </h3>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(148, 163, 184, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ fontSize: '20px' }}>{task.icon}</span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: '13px', color: '#f8fafc' }}>{task.title}</strong>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>+{formatNumber(task.points)} Puan</span>
              </div>
            </div>

            <button
              type="button"
              disabled
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: task.completed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                color: task.completed ? '#86efac' : '#94a3b8',
                border: task.completed ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              {task.completed ? '✓ Tamamlandı' : 'Yakında (Soon)'}
            </button>
          </div>
        ))}
      </div>

      {/* Fairness & Anti-P2W Guarantee Footer */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px dashed rgba(148, 163, 184, 0.2)',
          fontSize: '11px',
          color: '#94a3b8',
          lineHeight: 1.5,
        }}
      >
        🛡️ <strong>Şeffaflık & Güvenlik Politikası:</strong> $EMPIRE Airdrop dağıtımı tamamen topluluk odaklıdır. Sybil (sahte bot) hesapları engellemek amacıyla her Telegram kullanıcısı yalnızca 1 TON cüzdanı bağlayabilir. Snapshot tarihi resmi kanallardan duyurulacaktır.
      </div>
    </div>
  );
}
