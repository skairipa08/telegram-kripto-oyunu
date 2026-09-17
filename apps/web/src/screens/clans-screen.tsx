import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  calculateClanCapacity,
  calculateClanProductionBonus,
  generateClanRefLink,
} from '@empire/game-core';
import {
  clanLeaderboardResponseSchema,
  createClanResponseSchema,
  joinClanResponseSchema,
  type ClanLeaderboardEntry,
} from '@empire/shared';
import { formatNumber } from '../game/ui';
import { ShareReferralModal } from '../components/share-referral-modal';
import './social.css';

export interface ClansScreenProps {
  userCash: number;
  userId: string;
  botUsername?: string | undefined;
  onCashUpdated?: ((newCash: number) => void) | undefined;
}

const EMBLEM_OPTIONS = [
  '🛡️',
  '🦁',
  '⚡',
  '👑',
  '🦅',
  '🐺',
  '💎',
  '🚀',
  '🔥',
  '🏴‍☠️',
];

export function ClansScreen({
  userCash,
  userId,
  botUsername = 'ProjectEmpireBot',
  onCashUpdated,
}: ClansScreenProps) {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<
    'my_clan' | 'leaderboard' | 'create'
  >('my_clan');
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [createEmblem, setCreateEmblem] = useState('🛡️');
  const [createChannel, setCreateChannel] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Fetch Leaderboard & userClanId
  const leaderboardQuery = useQuery({
    queryKey: ['clans-leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/clans/leaderboard', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Karteller listesi alınamadı');
      const data = await res.json();
      return clanLeaderboardResponseSchema.parse(data);
    },
    staleTime: 30000,
  });

  // Fetch My Clan
  const myClanQuery = useQuery({
    queryKey: ['clans-my'],
    queryFn: async () => {
      const res = await fetch('/api/clans/my', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Kartel bilgisi alınamadı');
      const data = await res.json();
      return data.clan as ClanLeaderboardEntry | null;
    },
    staleTime: 30000,
  });

  const myClan = myClanQuery.data;

  // Create Clan Mutation
  const createClanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/clans/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          name: createName.trim(),
          tag: createTag.trim().toUpperCase(),
          emblem: createEmblem,
          telegramChannelUrl: createChannel.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.code === 'INSUFFICIENT_FUNDS'
            ? 'Kartel kurmak için en az 50.000 Nakit gerekiyor!'
            : data?.error?.code === 'ALREADY_IN_CLAN'
              ? 'Zaten bir kartelin üyesisin. Önce ayrılmalısın.'
              : data?.error?.code === 'TAG_TAKEN'
                ? 'Bu kartel etiketi (TAG) zaten kullanılıyor.'
                : 'Kartel oluşturulamadı.',
        );
      }
      return createClanResponseSchema.parse(data);
    },
    onSuccess: (data) => {
      setFeedback({
        type: 'success',
        message: `Tebrikler! [${data.clan.tag}] ${data.clan.name} karteli kuruldu!`,
      });
      queryClient.invalidateQueries({ queryKey: ['clans-my'] });
      queryClient.invalidateQueries({ queryKey: ['clans-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['economy'] });
      if (data.newCash && onCashUpdated) onCashUpdated(data.newCash);
      setActiveSubTab('my_clan');
    },
    onError: (err: Error) => {
      setFeedback({ type: 'error', message: err.message });
    },
  });

  // Join Clan Mutation
  const joinClanMutation = useMutation({
    mutationFn: async (clanId: string) => {
      const res = await fetch('/api/clans/join', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({ clanId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.code === 'CLAN_FULL'
            ? 'Bu kartel maksimum üye kapasitesine ulaştı!'
            : data?.error?.code === 'ALREADY_IN_CLAN'
              ? 'Zaten bu karteldesin.'
              : 'Kartele katılınamadı.',
        );
      }
      return joinClanResponseSchema.parse(data);
    },
    onSuccess: () => {
      setFeedback({
        type: 'success',
        message: 'Kartele başarıyla katıldın!',
      });
      queryClient.invalidateQueries({ queryKey: ['clans-my'] });
      queryClient.invalidateQueries({ queryKey: ['clans-leaderboard'] });
      setActiveSubTab('my_clan');
    },
    onError: (err: Error) => {
      setFeedback({ type: 'error', message: err.message });
    },
  });

  const clanRefLink = myClan
    ? generateClanRefLink(botUsername, userId, myClan.clanId)
    : `https://t.me/${botUsername}?startapp=ref_${userId}`;

  return (
    <div className="social-screen clans-hub">
      {/* Sub-navigation tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          className={activeSubTab === 'my_clan' ? 'button' : 'button secondary'}
          onClick={() => {
            setActiveSubTab('my_clan');
            setFeedback(null);
          }}
          style={{ flex: 1, padding: '10px', fontSize: '13px' }}
        >
          {myClan ? '🛡️ Kartelim' : '🛡️ Kartel Bilgisi'}
        </button>
        <button
          type="button"
          className={
            activeSubTab === 'leaderboard' ? 'button' : 'button secondary'
          }
          onClick={() => {
            setActiveSubTab('leaderboard');
            setFeedback(null);
          }}
          style={{ flex: 1, padding: '10px', fontSize: '13px' }}
        >
          🏆 Kartel Sıralaması
        </button>
        {!myClan && (
          <button
            type="button"
            className={
              activeSubTab === 'create' ? 'button' : 'button secondary'
            }
            onClick={() => {
              setActiveSubTab('create');
              setFeedback(null);
            }}
            style={{ flex: 1, padding: '10px', fontSize: '13px' }}
          >
            ➕ Kartel Kur
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="alert"
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            background:
              feedback.type === 'success'
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
            border:
              feedback.type === 'success'
                ? '1px solid #22c55e'
                : '1px solid #ef4444',
            color: feedback.type === 'success' ? '#4ade80' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: MY CLAN (OR EMPTY IF NOT IN ONE) */}
      {activeSubTab === 'my_clan' && (
        <div>
          {myClan ? (
            <div className="panel" style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '20px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingBottom: '16px',
                }}
              >
                <span
                  style={{
                    fontSize: '44px',
                    background: 'rgba(241, 201, 154, 0.15)',
                    padding: '12px',
                    borderRadius: '16px',
                    border: '1px solid rgba(241, 201, 154, 0.3)',
                  }}
                  aria-hidden="true"
                >
                  {myClan.emblem || '🛡️'}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      className="badge"
                      style={{
                        background: '#f1c99a',
                        color: '#000',
                        fontWeight: 'bold',
                      }}
                    >
                      [{myClan.tag}]
                    </span>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>
                      {myClan.name}
                    </h2>
                  </div>
                  <p
                    className="muted"
                    style={{ margin: '4px 0 0 0', fontSize: '13px' }}
                  >
                    Kartel Seviyesi: <strong>{myClan.clanLevel}</strong> ·
                    Kapasite:{' '}
                    <strong>
                      {myClan.memberCount} /{' '}
                      {calculateClanCapacity(myClan.clanLevel)}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Clan Level-Up Visual Progress */}
              <div className="clan-level-card">
                <div className="clan-level-header">
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#ffd700',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      KARTEL GELİŞİMİ
                    </span>
                    <strong style={{ display: 'block', fontSize: '15px' }}>
                      Seviye {myClan.clanLevel} → {myClan.clanLevel + 1}
                    </strong>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: 'linear-gradient(90deg, #38bdf8, #ffd700)',
                      color: '#0b0f17',
                      fontWeight: 800,
                      fontSize: '11px',
                    }}
                  >
                    Kapasite: {myClan.memberCount} /{' '}
                    {calculateClanCapacity(myClan.clanLevel)}
                  </span>
                </div>
                <div
                  className="clan-level-progress-track"
                  aria-label="Seviye ilerleme çubuğu"
                >
                  <div
                    className="clan-level-progress-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          15,
                          Math.round(
                            (myClan.memberCount /
                              calculateClanCapacity(myClan.clanLevel)) *
                              100,
                          ),
                        ),
                      )}%`,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '6px',
                    fontSize: '11px',
                    opacity: 0.75,
                  }}
                >
                  <span>
                    Mevcut bonus: +
                    {(
                      calculateClanProductionBonus(myClan.clanLevel) * 100
                    ).toFixed(1)}
                    %
                  </span>
                  <span>
                    Sonraki seviye: +
                    {(
                      calculateClanProductionBonus(myClan.clanLevel + 1) * 100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              </div>

              {/* Clan Production & Bonuses */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span
                    style={{ fontSize: '12px', opacity: 0.8, display: 'block' }}
                  >
                    Holding Toplam Gücü
                  </span>
                  <strong style={{ fontSize: '16px', color: '#f1c99a' }}>
                    {formatNumber(myClan.totalProductionPerSecond, true)} / sn
                  </strong>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#4ade80',
                      display: 'block',
                    }}
                  >
                    Kartel Üretim Bonusu
                  </span>
                  <strong style={{ fontSize: '16px', color: '#22c55e' }}>
                    +
                    {(
                      calculateClanProductionBonus(myClan.clanLevel) * 100
                    ).toFixed(1)}
                    % Hız
                  </strong>
                </div>
              </div>

              {/* Telegram Community Channel */}
              {myClan.telegramChannelUrl && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>
                    📢 Resmi Kartel Kanalı
                  </span>
                  <a
                    href={myClan.telegramChannelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Kanala Katıl
                  </a>
                </div>
              )}

              {/* Clan Referral Recruitment Button */}
              <div
                style={{
                  background:
                    'linear-gradient(135deg, rgba(241, 201, 154, 0.15), rgba(76, 175, 80, 0.12))',
                  border: '1px solid rgba(241, 201, 154, 0.35)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: '15px',
                      color: '#f1c99a',
                      display: 'block',
                    }}
                  >
                    🛡️ Kartele Yeni Üye & Ortak Davet Et
                  </strong>
                  <p
                    className="muted"
                    style={{ fontSize: '12px', margin: '4px 0 0 0' }}
                  >
                    Özel kartel davet linkini paylaş. Katılanlar hem doğrudan
                    karteline eklenir hem de ikiniz de +5.000 Nakit
                    kazanırsınız!
                  </p>
                </div>

                <button
                  type="button"
                  className="button"
                  onClick={() => setIsShareModalOpen(true)}
                  style={{ padding: '12px', fontWeight: 'bold' }}
                >
                  🚀 Kartel Davet Bağlantısını Paylaş
                </button>
              </div>
            </div>
          ) : (
            <div
              className="panel"
              style={{ padding: '24px', textAlign: 'center' }}
            >
              <span
                style={{
                  fontSize: '48px',
                  display: 'block',
                  marginBottom: '12px',
                }}
              >
                🛡️
              </span>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
                Henüz Bir Kartele Üye Değilsin
              </h3>
              <p
                className="muted"
                style={{ fontSize: '13px', marginBottom: '20px' }}
              >
                Bir kartele katılarak tüm işletmelerinde{' '}
                <strong>+2% ile +10% arası kalıcı üretim bonusu</strong>{' '}
                kazanabilir veya kendi kartelini kurup lider olabilirsin!
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'center',
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={() => setActiveSubTab('create')}
                  style={{ padding: '10px 18px' }}
                >
                  ➕ Kendi Kartelini Kur (50K Nakit)
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setActiveSubTab('leaderboard')}
                  style={{ padding: '10px 18px' }}
                >
                  🏆 Kartel Listesini Gör
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: LEADERBOARD & DIRECTORY */}
      {activeSubTab === 'leaderboard' && (
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <p
              className="eyebrow"
              style={{ margin: '0 0 4px 0', color: '#f1c99a' }}
            >
              GLOBAL KARTEL LİGİ
            </p>
            <h3 style={{ margin: 0, fontSize: '18px' }}>
              En Güçlü Holding Birlikleri
            </h3>
          </div>

          {leaderboardQuery.isLoading ? (
            <p className="muted">Karteller yükleniyor…</p>
          ) : leaderboardQuery.data?.clans.length === 0 ? (
            <p className="muted">Henüz kurulmuş bir kartel bulunmuyor.</p>
          ) : (
            <div>
              {/* Olympic 3-Pedestal Podium for Top 3 Clans */}
              {(() => {
                const clans = leaderboardQuery.data?.clans ?? [];
                const topClans = clans.slice(0, 3);
                const otherClans = clans.slice(3);

                const renderPedestal = (
                  clan: ClanLeaderboardEntry | undefined,
                  rank: 1 | 2 | 3,
                  tierClass: 'gold' | 'silver' | 'bronze',
                  rankLabel: string,
                ) => {
                  if (!clan) return null;
                  const isUserInThisClan =
                    myClan && myClan.clanId === clan.clanId;

                  return (
                    <div
                      className={`clan-podium-pedestal ${tierClass}`}
                      key={clan.clanId}
                    >
                      {rank === 1 && (
                        <span className="clan-podium-crown" aria-hidden="true">
                          👑
                        </span>
                      )}
                      <span className="clan-podium-rank-tag">{rankLabel}</span>
                      <span className="clan-podium-emblem">
                        {clan.emblem || '🛡️'}
                      </span>
                      <span className="clan-podium-name" title={clan.name}>
                        {clan.name}
                      </span>
                      <span className="clan-podium-tag">[{clan.tag}]</span>
                      <span className="clan-podium-prod">
                        {formatNumber(clan.totalProductionPerSecond, true)}/sn
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          opacity: 0.7,
                          margin: '2px 0 6px',
                        }}
                      >
                        Sv.{clan.clanLevel} · {clan.memberCount} üye
                      </span>

                      {isUserInThisClan ? (
                        <span
                          className="badge"
                          style={{
                            background: '#22c55e',
                            color: '#fff',
                            fontSize: '10px',
                            padding: '2px 6px',
                          }}
                        >
                          Karteldesin
                        </span>
                      ) : !myClan ? (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={joinClanMutation.isPending}
                          onClick={() => joinClanMutation.mutate(clan.clanId)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            minHeight: '28px',
                            width: '100%',
                          }}
                        >
                          Katıl
                        </button>
                      ) : null}
                    </div>
                  );
                };

                const rank1Clan =
                  topClans.find((c) => c.rank === 1) || topClans[0];
                const rank2Clan =
                  topClans.find((c) => c.rank === 2) ||
                  (topClans.length > 1 ? topClans[1] : undefined);
                const rank3Clan =
                  topClans.find((c) => c.rank === 3) ||
                  (topClans.length > 2 ? topClans[2] : undefined);

                return (
                  <div>
                    {topClans.length > 0 && (
                      <div className="clan-podium">
                        {renderPedestal(rank2Clan, 2, 'silver', '#2 Gümüş')}
                        {renderPedestal(rank1Clan, 1, 'gold', '#1 Altın')}
                        {renderPedestal(rank3Clan, 3, 'bronze', '#3 Bronz')}
                      </div>
                    )}

                    {/* Clans Ranked 4+ or remaining */}
                    {otherClans.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          marginTop: '16px',
                        }}
                      >
                        <p
                          className="eyebrow"
                          style={{
                            margin: '0 0 6px 0',
                            fontSize: '11px',
                            opacity: 0.8,
                          }}
                        >
                          DİĞER KARTEL SIRALAMASI
                        </p>
                        {otherClans.map((clan) => {
                          const isUserInThisClan =
                            myClan && myClan.clanId === clan.clanId;
                          return (
                            <div
                              key={clan.clanId}
                              style={{
                                padding: '12px 14px',
                                borderRadius: '10px',
                                background: isUserInThisClan
                                  ? 'rgba(241, 201, 154, 0.15)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                border: isUserInThisClan
                                  ? '1px solid #f1c99a'
                                  : '1px solid rgba(255, 255, 255, 0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 'bold',
                                    color: '#8c9ba5',
                                    width: '24px',
                                  }}
                                >
                                  #{clan.rank}
                                </span>
                                <span style={{ fontSize: '24px' }}>
                                  {clan.emblem}
                                </span>
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: '11px',
                                        background: 'rgba(241, 201, 154, 0.2)',
                                        color: '#f1c99a',
                                      }}
                                    >
                                      [{clan.tag}]
                                    </span>
                                    <strong style={{ fontSize: '14px' }}>
                                      {clan.name}
                                    </strong>
                                  </div>
                                  <span
                                    style={{ fontSize: '11px', opacity: 0.75 }}
                                  >
                                    Sv. {clan.clanLevel} · {clan.memberCount}{' '}
                                    üye ·{' '}
                                    {formatNumber(
                                      clan.totalProductionPerSecond,
                                      true,
                                    )}{' '}
                                    / sn
                                  </span>
                                </div>
                              </div>

                              <div>
                                {isUserInThisClan ? (
                                  <span
                                    className="badge"
                                    style={{
                                      background: '#22c55e',
                                      color: '#fff',
                                      fontSize: '11px',
                                    }}
                                  >
                                    Karteldesin
                                  </span>
                                ) : !myClan ? (
                                  <button
                                    type="button"
                                    className="button secondary"
                                    disabled={joinClanMutation.isPending}
                                    onClick={() =>
                                      joinClanMutation.mutate(clan.clanId)
                                    }
                                    style={{
                                      padding: '6px 14px',
                                      fontSize: '12px',
                                    }}
                                  >
                                    Katıl
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: CREATE CLAN */}
      {activeSubTab === 'create' && !myClan && (
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <p
              className="eyebrow"
              style={{ margin: '0 0 4px 0', color: '#f1c99a' }}
            >
              YENİ BİRLİK
            </p>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Kartelini Kur</h3>
            <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
              Kurulum Bedeli: <strong>50.000 Nakit</strong> · Kartel lideri
              olarak tüm üyelerin toplam üretiminden{' '}
              <strong>%1 liderlik payı</strong> kazanırsın!
            </p>
          </div>

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  marginBottom: '4px',
                }}
              >
                Kartel Adı (En fazla 32 karakter)
              </label>
              <input
                type="text"
                maxLength={32}
                placeholder="Örn: Kripto Aslanları"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  marginBottom: '4px',
                }}
              >
                Kartel Etiketi (TAG, 3-6 karakter büyük harf)
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="Örn: LIONS"
                value={createTag}
                onChange={(e) => setCreateTag(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  marginBottom: '6px',
                }}
              >
                Kartel Amblemi
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EMBLEM_OPTIONS.map((emb) => (
                  <button
                    key={emb}
                    type="button"
                    onClick={() => setCreateEmblem(emb)}
                    style={{
                      fontSize: '22px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border:
                        createEmblem === emb
                          ? '2px solid #f1c99a'
                          : '1px solid rgba(255,255,255,0.1)',
                      background:
                        createEmblem === emb
                          ? 'rgba(241, 201, 154, 0.25)'
                          : 'rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                    }}
                  >
                    {emb}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  marginBottom: '4px',
                }}
              >
                Telegram Kanal / Grup Bağlantısı (İsteğe bağlı)
              </label>
              <input
                type="url"
                placeholder="https://t.me/karteliniz"
                value={createChannel}
                onChange={(e) => setCreateChannel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                }}
              />
            </div>

            <button
              type="button"
              className="button"
              onClick={() => createClanMutation.mutate()}
              disabled={
                !createName.trim() ||
                createTag.length < 3 ||
                userCash < 50000 ||
                createClanMutation.isPending
              }
              style={{
                padding: '14px',
                fontWeight: 'bold',
                marginTop: '6px',
                opacity: userCash < 50000 ? 0.6 : 1,
              }}
            >
              {userCash < 50000
                ? 'Yetersiz Nakit (50.000 Gerekli)'
                : createClanMutation.isPending
                  ? 'Kuruluyor…'
                  : '50.000 Nakit ile Kartel Kur'}
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareReferralModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        referralLink={clanRefLink}
        clanName={myClan?.name}
        clanTag={myClan?.tag}
      />
    </div>
  );
}
