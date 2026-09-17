import { useState, useContext } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClientContext,
} from '@tanstack/react-query';
import {
  DEFAULT_BUSINESSES,
  getUtcDateString,
  getDailyCipher,
  DAILY_COMBO_REWARD,
  DAILY_CIPHER_REWARD,
} from '@empire/game-core';
import {
  dailyComboStatusResponseSchema,
  submitDailyComboResponseSchema,
  submitDailyCipherResponseSchema,
} from '@empire/shared';
import { ShareReferralModal } from './share-referral-modal';
import { getSessionToken } from '../api/client';
import './arcade.css';

export interface DailyComboCardProps {
  userCash: number;
  referralLink: string;
  clanTag?: string | undefined;
  clanName?: string | undefined;
  onRewardClaimed?: ((newCash: number) => void) | undefined;
}

export function DailyComboCard(props: DailyComboCardProps) {
  const hasClient = Boolean(useContext(QueryClientContext));
  if (!hasClient) {
    return <DailyComboCardStatic {...props} />;
  }
  return <DailyComboCardLive {...props} />;
}

function DailyComboCardStatic({
  referralLink,
  clanTag,
  clanName,
}: DailyComboCardProps) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [cipherInput, setCipherInput] = useState('');
  const [activeTab, setActiveTab] = useState<'combo' | 'cipher'>('combo');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const todayStr = getUtcDateString();
  const dailyCipherHint = getDailyCipher(todayStr);

  const toggleSelectBusiness = (id: string) => {
    if (selectedSlugs.includes(id)) {
      setSelectedSlugs(selectedSlugs.filter((s) => s !== id));
    } else if (selectedSlugs.length < 3) {
      setSelectedSlugs([...selectedSlugs, id]);
    }
  };

  return (
    <div
      className="panel daily-mystery-panel"
      style={{
        background: 'linear-gradient(180deg, #131d2e 0%, #0c121e 100%)',
        border: '1px solid rgba(241, 201, 154, 0.35)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('combo')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: activeTab === 'combo' ? '1px solid #f1c99a' : 'none',
            background:
              activeTab === 'combo'
                ? 'rgba(241, 201, 154, 0.15)'
                : 'transparent',
            color: activeTab === 'combo' ? '#f1c99a' : '#8c9ba5',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <span>🎯 Günlük Kombo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cipher')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: activeTab === 'cipher' ? '1px solid #f1c99a' : 'none',
            background:
              activeTab === 'cipher'
                ? 'rgba(241, 201, 154, 0.15)'
                : 'transparent',
            color: activeTab === 'cipher' ? '#f1c99a' : '#8c9ba5',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <span>📻 Mors Şifresi</span>
        </button>
      </div>

      {activeTab === 'combo' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px',
            }}
          >
            <div>
              <p
                className="eyebrow"
                style={{ color: '#f1c99a', margin: '0 0 4px 0' }}
              >
                GÜNLÜK 3'LÜ GİZLİ KOMBO
              </p>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                Günün Gizli Kartlarını Bul
              </h3>
            </div>
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '8px',
                padding: '6px 12px',
                textAlign: 'right',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#22c55e',
                  fontWeight: 'bold',
                }}
              >
                ÖDÜL
              </span>
              <strong style={{ fontSize: '14px', color: '#fff' }}>
                +{DAILY_COMBO_REWARD.cash.toLocaleString()} 💰
              </strong>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            {[0, 1, 2].map((slotIndex) => {
              const slug = selectedSlugs[slotIndex];
              const business = DEFAULT_BUSINESSES.find((b) => b.id === slug);
              return (
                <div
                  key={slotIndex}
                  style={{
                    height: '76px',
                    borderRadius: '12px',
                    border: slug
                      ? '1px solid #f1c99a'
                      : '2px dashed rgba(255,255,255,0.2)',
                    background: slug
                      ? 'rgba(241, 201, 154, 0.12)'
                      : 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  {slug && business ? (
                    <>
                      <span style={{ fontSize: '20px' }}>🏢</span>
                      <strong
                        style={{
                          fontSize: '11px',
                          color: '#f1c99a',
                          marginTop: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                      >
                        {business.name}
                      </strong>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: '24px',
                        color: 'rgba(255,255,255,0.3)',
                      }}
                    >
                      ?
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              maxHeight: '140px',
              overflowY: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '16px',
              padding: '6px',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '8px',
            }}
          >
            {DEFAULT_BUSINESSES.map((b) => {
              const isSelected = selectedSlugs.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleSelectBusiness(b.id)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: isSelected
                      ? '1px solid #f1c99a'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: isSelected
                      ? 'rgba(241, 201, 154, 0.25)'
                      : 'rgba(255,255,255,0.05)',
                    color: isSelected ? '#f1c99a' : '#c3cad4',
                    cursor: 'pointer',
                  }}
                >
                  {b.name} {isSelected && '✓'}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="button"
              aria-disabled={selectedSlugs.length !== 3}
              style={{
                flex: 1,
                padding: '12px',
                fontWeight: 'bold',
                opacity: selectedSlugs.length !== 3 ? 0.6 : 1,
              }}
            >
              Komboyu Doğrula ({selectedSlugs.length}/3)
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsShareModalOpen(true)}
              style={{ padding: '12px 16px', fontSize: '13px' }}
            >
              📢 Paylaş
            </button>
          </div>
        </div>
      )}

      {activeTab === 'cipher' && (
        <div>
          <div
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '16px',
              fontFamily: 'monospace',
            }}
          >
            <div
              style={{
                fontSize: '22px',
                letterSpacing: '4px',
                color: '#f1c99a',
                fontWeight: 'bold',
              }}
            >
              {dailyCipherHint.morseCode}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Şifreli Kelimeyi Yaz"
              value={cipherInput}
              onChange={(e) => setCipherInput(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
              }}
            />
            <button
              type="button"
              className="button"
              aria-disabled={!cipherInput.trim()}
            >
              Şifreyi Çöz
            </button>
          </div>
        </div>
      )}

      <ShareReferralModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        referralLink={referralLink}
        clanName={clanName}
        clanTag={clanTag}
      />
    </div>
  );
}

function DailyComboCardLive({
  referralLink,
  clanTag,
  clanName,
  onRewardClaimed,
}: DailyComboCardProps) {
  const queryClient = useQueryClient();
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [cipherInput, setCipherInput] = useState('');
  const [activeTab, setActiveTab] = useState<'combo' | 'cipher'>('combo');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const todayStr = getUtcDateString();
  const dailyCipherHint = getDailyCipher(todayStr);

  const comboStatus = useQuery({
    queryKey: ['daily-combo-status', todayStr],
    queryFn: async () => {
      const token = getSessionToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Empire-Session'] = token;
      }
      const res = await fetch(`/api/combo/status?date=${todayStr}`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Status alınamadı');
      const data = await res.json();
      return dailyComboStatusResponseSchema.parse(data);
    },
    staleTime: 60000,
  });

  const claimComboMutation = useMutation({
    mutationFn: async (slugs: [string, string, string]) => {
      const token = getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: window.location.origin,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Empire-Session'] = token;
      }
      const res = await fetch('/api/combo/claim', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          date: todayStr,
          selectedSlugs: slugs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.code === 'WRONG_COMBO'
            ? 'Yanlış kart kombinasyonu! İpuçlarını kontrol et veya tekrar dene.'
            : data?.error?.code === 'ALREADY_COMPLETED'
              ? 'Bugünkü kombo ödülünü zaten aldın.'
              : 'Kombo doğrulanamadı.',
        );
      }
      return submitDailyComboResponseSchema.parse(data);
    },
    onSuccess: (data) => {
      setFeedback({
        type: 'success',
        message: `Tebrikler! +${data.rewardCash.toLocaleString()} Nakit & +${data.rewardSeasonPoints} Sezon Puanı kazandın!`,
      });
      queryClient.invalidateQueries({ queryKey: ['daily-combo-status'] });
      queryClient.invalidateQueries({ queryKey: ['game-design'] });
      queryClient.invalidateQueries({ queryKey: ['economy'] });
      if (data.newCash && onRewardClaimed) {
        onRewardClaimed(data.newCash);
      }
    },
    onError: (err: Error) => {
      setFeedback({
        type: 'error',
        message: err.message,
      });
    },
  });

  const claimCipherMutation = useMutation({
    mutationFn: async (word: string) => {
      const token = getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: window.location.origin,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Empire-Session'] = token;
      }
      const res = await fetch('/api/combo/cipher-claim', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          date: todayStr,
          solvedWord: word.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.code === 'WRONG_CIPHER'
            ? 'Hatalı Mors şifresi! Kodu dikkatlice çözümle.'
            : data?.error?.code === 'ALREADY_COMPLETED'
              ? 'Bugünkü şifre ödülünü zaten aldın.'
              : 'Şifre çözülemedi.',
        );
      }
      return submitDailyCipherResponseSchema.parse(data);
    },
    onSuccess: (data) => {
      setFeedback({
        type: 'success',
        message: `Mors Şifresi Çözüldü! +${data.rewardCash.toLocaleString()} Nakit & +${data.rewardSeasonPoints} Sezon Puanı!`,
      });
      queryClient.invalidateQueries({ queryKey: ['daily-combo-status'] });
      queryClient.invalidateQueries({ queryKey: ['game-design'] });
      queryClient.invalidateQueries({ queryKey: ['economy'] });
      if (data.newCash && onRewardClaimed) {
        onRewardClaimed(data.newCash);
      }
    },
    onError: (err: Error) => {
      setFeedback({
        type: 'error',
        message: err.message,
      });
    },
  });

  const toggleSelectBusiness = (id: string) => {
    if (selectedSlugs.includes(id)) {
      setSelectedSlugs(selectedSlugs.filter((s) => s !== id));
    } else {
      if (selectedSlugs.length < 3) {
        setSelectedSlugs([...selectedSlugs, id]);
      }
    }
  };

  const handleVerifyCombo = () => {
    if (selectedSlugs.length !== 3) return;
    setFeedback(null);
    claimComboMutation.mutate([
      selectedSlugs[0]!,
      selectedSlugs[1]!,
      selectedSlugs[2]!,
    ]);
  };

  const handleVerifyCipher = () => {
    if (!cipherInput.trim()) return;
    setFeedback(null);
    claimCipherMutation.mutate(cipherInput);
  };

  const isComboCompleted = Boolean(comboStatus.data?.isCompleted);

  return (
    <div
      className="panel daily-mystery-panel"
      style={{
        background: 'linear-gradient(180deg, #131d2e 0%, #0c121e 100%)',
        border: '1px solid rgba(241, 201, 154, 0.35)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('combo');
            setFeedback(null);
          }}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: activeTab === 'combo' ? '1px solid #f1c99a' : 'none',
            background:
              activeTab === 'combo'
                ? 'rgba(241, 201, 154, 0.15)'
                : 'transparent',
            color: activeTab === 'combo' ? '#f1c99a' : '#8c9ba5',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>🎯 Günlük Kombo</span>
          {isComboCompleted && (
            <span style={{ fontSize: '11px', color: '#22c55e' }}>✓ Alındı</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('cipher');
            setFeedback(null);
          }}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: activeTab === 'cipher' ? '1px solid #f1c99a' : 'none',
            background:
              activeTab === 'cipher'
                ? 'rgba(241, 201, 154, 0.15)'
                : 'transparent',
            color: activeTab === 'cipher' ? '#f1c99a' : '#8c9ba5',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>📻 Mors Şifresi</span>
        </button>
      </div>

      {activeTab === 'combo' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px',
            }}
          >
            <div>
              <p
                className="eyebrow"
                style={{ color: '#f1c99a', margin: '0 0 4px 0' }}
              >
                GÜNLÜK 3'LÜ GİZLİ KOMBO
              </p>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                Günün Gizli Kartlarını Bul
              </h3>
            </div>
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '8px',
                padding: '6px 12px',
                textAlign: 'right',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#22c55e',
                  fontWeight: 'bold',
                }}
              >
                ÖDÜL
              </span>
              <strong style={{ fontSize: '14px', color: '#fff' }}>
                +{DAILY_COMBO_REWARD.cash.toLocaleString()} 💰
              </strong>
            </div>
          </div>

          <p
            className="muted"
            style={{ fontSize: '12px', marginBottom: '16px' }}
          >
            Aşağıdaki işletmeler arasından bugünün gizli 3 holding kartını seç
            ve dev ödülü kasanıza ekle!
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            {[0, 1, 2].map((slotIndex) => {
              const slug = selectedSlugs[slotIndex];
              const business = DEFAULT_BUSINESSES.find((b) => b.id === slug);
              return (
                <div
                  key={slotIndex}
                  style={{
                    height: '76px',
                    borderRadius: '12px',
                    border: slug
                      ? '1px solid #f1c99a'
                      : '2px dashed rgba(255,255,255,0.2)',
                    background: slug
                      ? 'rgba(241, 201, 154, 0.12)'
                      : 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  {slug && business ? (
                    <>
                      <span style={{ fontSize: '20px' }}>🏢</span>
                      <strong
                        style={{
                          fontSize: '11px',
                          color: '#f1c99a',
                          marginTop: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                      >
                        {business.name}
                      </strong>
                      <button
                        type="button"
                        aria-label="Kaldır"
                        onClick={() => toggleSelectBusiness(slug)}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '4px',
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '14px',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: '24px',
                        color: 'rgba(255,255,255,0.3)',
                      }}
                    >
                      ?
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              maxHeight: '140px',
              overflowY: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '16px',
              padding: '6px',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '8px',
            }}
          >
            {DEFAULT_BUSINESSES.map((b) => {
              const isSelected = selectedSlugs.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleSelectBusiness(b.id)}
                  disabled={isComboCompleted}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: isSelected
                      ? '1px solid #f1c99a'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: isSelected
                      ? 'rgba(241, 201, 154, 0.25)'
                      : 'rgba(255,255,255,0.05)',
                    color: isSelected ? '#f1c99a' : '#c3cad4',
                    cursor: isComboCompleted ? 'default' : 'pointer',
                    opacity: isComboCompleted ? 0.6 : 1,
                  }}
                >
                  {b.name} {isSelected && '✓'}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="button"
              onClick={handleVerifyCombo}
              disabled={
                selectedSlugs.length !== 3 ||
                claimComboMutation.isPending ||
                isComboCompleted
              }
              style={{
                flex: 1,
                padding: '12px',
                fontWeight: 'bold',
                opacity:
                  selectedSlugs.length !== 3 || isComboCompleted ? 0.6 : 1,
              }}
            >
              {isComboCompleted
                ? '✅ Bugünün Kombosu Tamamlandı'
                : claimComboMutation.isPending
                  ? 'Doğrulanıyor…'
                  : `Komboyu Doğrula (${selectedSlugs.length}/3)`}
            </button>

            <button
              type="button"
              className="button secondary"
              onClick={() => setIsShareModalOpen(true)}
              style={{ padding: '12px 16px', fontSize: '13px' }}
              title="Arkadaşlarınla Paylaş"
            >
              📢 Paylaş
            </button>
          </div>
        </div>
      )}

      {activeTab === 'cipher' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px',
            }}
          >
            <div>
              <p
                className="eyebrow"
                style={{ color: '#f1c99a', margin: '0 0 4px 0' }}
              >
                GÜNLÜK SİBER MORS ŞİFRESİ
              </p>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                Günün Gizli Kodunu Çöz
              </h3>
            </div>
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '8px',
                padding: '6px 12px',
                textAlign: 'right',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#60a5fa',
                  fontWeight: 'bold',
                }}
              >
                ÖDÜL
              </span>
              <strong style={{ fontSize: '14px', color: '#fff' }}>
                +{DAILY_CIPHER_REWARD.cash.toLocaleString()} 💰
              </strong>
            </div>
          </div>

          <p
            className="muted"
            style={{ fontSize: '12px', marginBottom: '16px' }}
          >
            Aşağıdaki Mors sinyallerini analiz et, şifreli kelimeyi yaz ve ödülü
            kap!
          </p>

          <div
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '16px',
              fontFamily: 'monospace',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: '#60a5fa',
                display: 'block',
                marginBottom: '6px',
                letterSpacing: '1px',
              }}
            >
              GELEN SİBER MORS SİNYALİ:
            </span>
            <div
              style={{
                fontSize: '22px',
                letterSpacing: '4px',
                color: '#f1c99a',
                fontWeight: 'bold',
                wordBreak: 'break-word',
              }}
            >
              {dailyCipherHint.morseCode}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Şifreli Kelimeyi Yaz (örn: EMPIRE)"
              value={cipherInput}
              onChange={(e) => setCipherInput(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: '15px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}
            />
            <button
              type="button"
              className="button"
              onClick={handleVerifyCipher}
              disabled={!cipherInput.trim() || claimCipherMutation.isPending}
              style={{ padding: '12px 20px', fontWeight: 'bold' }}
            >
              {claimCipherMutation.isPending ? 'Çözülüyor…' : 'Şifreyi Çöz'}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role="alert"
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
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

      <ShareReferralModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        referralLink={referralLink}
        clanName={clanName}
        clanTag={clanTag}
      />
    </div>
  );
}
