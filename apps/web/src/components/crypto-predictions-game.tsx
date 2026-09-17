import React, { useState } from 'react';
import {
  INITIAL_PREDICTION_MARKETS,
  type PredictionCategory,
  type PredictionMarket,
  type PredictionBetTicket,
} from '../game/crypto-predictions-model';
import { formatNumber } from '../game/ui';
import { playClickSound, playWinSound } from '../game/arcade-audio';
import { triggerHaptic } from '../game/arcade-haptics';
import './arcade.css';

export interface CryptoPredictionsGameProps {
  playerCash?: number | undefined;
  onCashUpdated?: ((newCash: number) => void) | undefined;
}

const QUICK_STAKES = [100, 500, 1000, 5000, 10000];

export function CryptoPredictionsGame({
  playerCash = 10000,
  onCashUpdated,
}: CryptoPredictionsGameProps) {
  const [category, setCategory] = useState<PredictionCategory>('all');
  const [markets] = useState<readonly PredictionMarket[]>(
    INITIAL_PREDICTION_MARKETS,
  );
  const [selectedMarketId, setSelectedMarketId] = useState<string>(
    INITIAL_PREDICTION_MARKETS[0]?.id ?? 'pred_btc_80k',
  );
  const [selectedChoice, setSelectedChoice] = useState<'yes' | 'no'>('yes');
  const [stakeInput, setStakeInput] = useState<string>('500');
  const [tickets, setTickets] = useState<PredictionBetTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'markets' | 'tickets'>('markets');
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeMarket =
    markets.find((m) => m.id === selectedMarketId) ?? markets[0]!;
  const numericStake = Number(stakeInput) || 0;
  const currentOdds =
    selectedChoice === 'yes' ? activeMarket.yesOdds : activeMarket.noOdds;
  const potentialPayout = Math.floor(numericStake * currentOdds);

  const filteredMarkets =
    category === 'all'
      ? markets
      : markets.filter((m) => m.category === category);

  const handlePlaceBet = () => {
    if (numericStake < 50) {
      setFeedback('Minimum tahmin tutarı 50 Nakittir.');
      return;
    }
    if (numericStake > playerCash) {
      setFeedback('Yetersiz bakiye!');
      return;
    }

    // Deduct stake
    const newCash = playerCash - numericStake;
    if (onCashUpdated) {
      onCashUpdated(newCash);
    }

    playClickSound();
    triggerHaptic('impact_medium');

    const newTicket: PredictionBetTicket = {
      id: crypto.randomUUID(),
      marketId: activeMarket.id,
      marketTitle: activeMarket.title,
      choice: selectedChoice,
      choiceLabel:
        selectedChoice === 'yes'
          ? 'EVET (Üstü / Olur)'
          : 'HAYIR (Altı / Olmaz)',
      stake: numericStake,
      odds: currentOdds,
      potentialPayout,
      placedAt: new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'active',
      claimed: false,
    };

    setTickets((prev) => [newTicket, ...prev]);
    setFeedback(
      `✅ Kupon Başarıyla Yapıldı! (${formatNumber(numericStake)} Nakit yatırıldı)`,
    );
  };

  const handleResolveTicket = (ticketId: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status !== 'active') return;

    // Simulate 65% win probability
    const isWin = Math.random() < 0.65;
    playWinSound();
    triggerHaptic('notification_success');

    if (isWin) {
      const wonCash = playerCash + ticket.potentialPayout;
      if (onCashUpdated) {
        onCashUpdated(wonCash);
      }
    }

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: isWin ? 'won' : 'lost',
            claimed: true,
          };
        }
        return t;
      }),
    );
  };

  return (
    <div
      className="crypto-predictions-game"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '16px',
        background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>🎯</span>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 800,
                color: '#38bdf8',
              }}
            >
              İddia & Tahmin Pazarı
            </h3>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Kripto, teknoloji, spor ve dünya olaylarına tahmin yap, yüksek
            oranlarla kazan!
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}
          >
            Kasa
          </span>
          <strong style={{ fontSize: '15px', color: '#22c55e' }}>
            {formatNumber(playerCash)} Nakit
          </strong>
        </div>
      </div>

      {/* Main Switcher: Marketler / Kuponlarım */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('markets')}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '10px',
            background:
              activeTab === 'markets' ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)',
            color: activeTab === 'markets' ? '#0f172a' : '#cbd5e1',
            border: 'none',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          📊 Açık Tahminler ({markets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '10px',
            background:
              activeTab === 'tickets' ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)',
            color: activeTab === 'tickets' ? '#0f172a' : '#cbd5e1',
            border: 'none',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          🎟️ Kuponlarım ({tickets.length})
        </button>
      </div>

      {activeTab === 'markets' ? (
        <>
          {/* Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'crypto', label: '🪙 Kripto' },
              { id: 'tech', label: '🤖 Yapay Zeka' },
              { id: 'world', label: '🌍 Dünya & Emtia' },
              { id: 'sports', label: '⚽ Spor' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id as PredictionCategory)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  background:
                    category === cat.id
                      ? 'rgba(56, 189, 248, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                  border:
                    category === cat.id
                      ? '1px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  color: category === cat.id ? '#38bdf8' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Markets List */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {filteredMarkets.map((m) => {
              const isSelected = m.id === selectedMarketId;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMarketId(m.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: isSelected
                      ? 'rgba(56, 189, 248, 0.12)'
                      : 'rgba(30, 41, 59, 0.5)',
                    border: isSelected
                      ? '1.5px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#38bdf8',
                        fontWeight: 800,
                      }}
                    >
                      {m.categoryIcon} {m.categoryLabel}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      ⏳ {m.endDate}
                    </span>
                  </div>

                  <h4
                    style={{
                      margin: '0 0 6px',
                      fontSize: '14px',
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    {m.title}
                  </h4>
                  <p
                    style={{
                      margin: '0 0 10px',
                      fontSize: '12px',
                      color: '#94a3b8',
                    }}
                  >
                    {m.description}
                  </p>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMarketId(m.id);
                        setSelectedChoice('yes');
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '8px',
                        background:
                          isSelected && selectedChoice === 'yes'
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'rgba(16, 185, 129, 0.12)',
                        border:
                          isSelected && selectedChoice === 'yes'
                            ? '1.5px solid #34d399'
                            : '1px solid rgba(16, 185, 129, 0.25)',
                        color:
                          isSelected && selectedChoice === 'yes'
                            ? '#ffffff'
                            : '#34d399',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>👍 EVET</span>
                      <span>{m.yesOdds.toFixed(2)}x</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMarketId(m.id);
                        setSelectedChoice('no');
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '8px',
                        background:
                          isSelected && selectedChoice === 'no'
                            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                            : 'rgba(239, 68, 68, 0.12)',
                        border:
                          isSelected && selectedChoice === 'no'
                            ? '1.5px solid #f87171'
                            : '1px solid rgba(239, 68, 68, 0.25)',
                        color:
                          isSelected && selectedChoice === 'no'
                            ? '#ffffff'
                            : '#f87171',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>👎 HAYIR</span>
                      <span>{m.noOdds.toFixed(2)}x</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Bet Slip Card */}
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Seçilen Tahmin:
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: selectedChoice === 'yes' ? '#34d399' : '#f87171',
                }}
              >
                {selectedChoice === 'yes' ? 'EVET' : 'HAYIR'} (
                {currentOdds.toFixed(2)}x)
              </span>
            </div>

            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '10px',
              }}
            >
              {activeMarket.title}
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#94a3b8',
                }}
              >
                <span>Yatırılacak Tutar (Nakit)</span>
                <span style={{ color: '#eab308' }}>
                  Kazanılacak: +{formatNumber(potentialPayout)} Nakit
                </span>
              </div>

              <input
                type="number"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                min="50"
                max={playerCash}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 800,
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', gap: '6px' }}>
                {QUICK_STAKES.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setStakeInput(String(amt))}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +{amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setStakeInput(String(playerCash))}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid #eab308',
                    color: '#facc15',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  MAKS
                </button>
              </div>

              {feedback && (
                <div
                  style={{
                    fontSize: '12px',
                    color: feedback.startsWith('✅') ? '#86efac' : '#fca5a5',
                    fontWeight: 700,
                  }}
                >
                  {feedback}
                </div>
              )}

              <button
                type="button"
                className="button"
                onClick={handlePlaceBet}
                disabled={numericStake <= 0 || numericStake > playerCash}
                style={{
                  marginTop: '4px',
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: 900,
                  background:
                    'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)',
                }}
              >
                🎯 TAHMİNİ ONAYLA ({formatNumber(numericStake)} Nakit 👉 +
                {formatNumber(potentialPayout)} Nakit)
              </button>
            </div>
          </div>
        </>
      ) : (
        /* My Tickets Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tickets.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 16px',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              Henüz aktif tahmin kuponun bulunmuyor. Açık tahminlerden birini
              seçerek hemen tahmin yapabilirsin!
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border:
                    t.status === 'won'
                      ? '1px solid #22c55e'
                      : t.status === 'lost'
                        ? '1px solid #ef4444'
                        : '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Saat: {t.placedAt}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color:
                        t.status === 'won'
                          ? '#22c55e'
                          : t.status === 'lost'
                            ? '#ef4444'
                            : '#eab308',
                    }}
                  >
                    {t.status === 'won'
                      ? '🏆 KAZANDI'
                      : t.status === 'lost'
                        ? '❌ KAYBETTİ'
                        : '⏳ DEVAM EDİYOR'}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  {t.marketTitle}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#cbd5e1',
                    marginBottom: '8px',
                  }}
                >
                  <span>
                    Tahmin:{' '}
                    <strong
                      style={{
                        color: t.choice === 'yes' ? '#34d399' : '#f87171',
                      }}
                    >
                      {t.choiceLabel}
                    </strong>
                  </span>
                  <span>
                    Oran: <strong>{t.odds.toFixed(2)}x</strong>
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Yatırılan: {formatNumber(t.stake)} Nakit
                  </span>
                  <strong
                    style={{
                      fontSize: '14px',
                      color: t.status === 'won' ? '#22c55e' : '#eab308',
                    }}
                  >
                    {t.status === 'won'
                      ? `+${formatNumber(t.potentialPayout)} Nakit Alındı`
                      : `Olası: +${formatNumber(t.potentialPayout)} Nakit`}
                  </strong>
                </div>

                {t.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => handleResolveTicket(t.id)}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Sonucu Simüle Et & Ödülü Çek
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
