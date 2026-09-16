import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  cashRewardForScore,
  nextTargetCenter,
  rewardForCombo,
  scoreMintHit,
  targetWidthForCombo,
  type MintHitGrade,
} from '../game/mint-game-model';

const ROUND_SECONDS = 45;
const MAX_STRIKES = 5;

export function MintGame({
  preview = false,
  onPreviewReward,
  precisionAssist = false,
}: {
  preview?: boolean;
  onPreviewReward?: (amount: number) => void;
  precisionAssist?: boolean;
}) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [targetCenter, setTargetCenter] = useState(32);
  const [angle, setAngle] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [lastGrade, setLastGrade] = useState<MintHitGrade | null>(null);
  const [lastPoints, setLastPoints] = useState(0);
  const startedAt = useRef(0);
  const frame = useRef(0);
  const rewarded = useRef(false);

  const finishRound = useCallback(() => {
    setPhase('result');
    cancelAnimationFrame(frame.current);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = (timestamp: number) => {
      if (!startedAt.current) startedAt.current = timestamp;
      const elapsed = (timestamp - startedAt.current) / 1000;
      const remaining = Math.max(0, ROUND_SECONDS - elapsed);
      setTimeLeft(Math.ceil(remaining));
      setAngle((elapsed * 132) % 360);
      if (remaining <= 0) return finishRound();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [finishRound, phase]);

  const reward = cashRewardForScore(score);
  useEffect(() => {
    if (phase !== 'result' || rewarded.current || !preview) return;
    rewarded.current = true;
    onPreviewReward?.(reward);
  }, [onPreviewReward, phase, preview, reward]);

  function startRound() {
    startedAt.current = 0;
    rewarded.current = false;
    setTimeLeft(ROUND_SECONDS);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setStrikes(0);
    setTargetCenter(32);
    setAngle(0);
    setHitCount(0);
    setLastGrade(null);
    setLastPoints(0);
    setPhase('playing');
  }

  function strikeCoin() {
    if (phase !== 'playing') return;
    const result = scoreMintHit(
      angle,
      targetCenter,
      targetWidthForCombo(combo),
      combo,
    );
    setLastGrade(result.grade);
    setLastPoints(result.points);
    if (result.grade === 'miss') {
      const nextStrikes = strikes + 1;
      setStrikes(nextStrikes);
      setCombo(0);
      if (nextStrikes >= MAX_STRIKES) finishRound();
      return;
    }
    const nextCombo = combo + 1;
    const nextHitCount = hitCount + 1;
    setScore((value) => value + result.points);
    setCombo(nextCombo);
    setBestCombo((value) => Math.max(value, nextCombo));
    setHitCount(nextHitCount);
    setTargetCenter(nextTargetCenter(targetCenter, nextHitCount));
  }

  const targetWidth = targetWidthForCombo(combo) + (precisionAssist ? 16 : 0);
  return (
    <section className="mint-section" aria-labelledby="mint-title">
      <div className="mint-section-heading">
        <div>
          <p className="eyebrow">GÜNLÜK MİNİ OYUN</p>
          <h2 id="mint-title">Empire Darphanesi</h2>
          <p className="muted">
            Altın dilimi yakala, serini büyüt ve günlük kasanı doldur.
          </p>
        </div>
        <span className="mint-ticket">3 / 3 BİLET</span>
      </div>
      {precisionAssist && (
        <p className="arcade-assist-active">
          Hassasiyet Modülü aktif · hedef alanı genişletildi
        </p>
      )}

      <div className={`mint-machine ${phase}`}>
        <div className="mint-status" aria-live="polite">
          <span>
            <small>SÜRE</small>
            <strong>00:{String(timeLeft).padStart(2, '0')}</strong>
          </span>
          <span>
            <small>SERİ</small>
            <strong>×{combo}</strong>
          </span>
          <span>
            <small>KASA</small>
            <strong>{cashRewardForScore(score)}</strong>
          </span>
        </div>
        <div className="mint-stage">
          <div
            className="mint-target"
            style={
              {
                '--target-center': `${targetCenter}deg`,
                '--target-width': `${targetWidth}deg`,
              } as CSSProperties
            }
          />
          <div
            className="mint-target-marker"
            style={{ transform: `rotate(${targetCenter}deg)` }}
            aria-hidden="true"
          >
            <span>HEDEF</span>
          </div>
          <div
            className="mint-needle"
            style={{ transform: `rotate(${angle}deg)` }}
            aria-hidden="true"
          >
            <i />
          </div>
          <button
            className="mint-coin-button"
            type="button"
            onClick={phase === 'playing' ? strikeCoin : startRound}
            aria-label={
              phase === 'playing'
                ? 'Coini şimdi darpla'
                : 'Darphane turunu başlat'
            }
          >
            <img src="/assets/empire-coin-ui.png" alt="" draggable={false} />
          </button>
          {phase === 'playing' && lastGrade && (
            <span className={`mint-grade ${lastGrade}`}>
              {lastGrade === 'perfect'
                ? `MÜKEMMEL · +${lastPoints}`
                : lastGrade === 'good'
                  ? `İSABET · +${lastPoints}`
                  : 'ISKALADIN'}
            </span>
          )}
        </div>
        <div className="mint-strikes" aria-label={`${strikes} hata yapıldı`}>
          {Array.from({ length: MAX_STRIKES }, (_, index) => (
            <i key={index} className={index < strikes ? 'lost' : ''} />
          ))}
        </div>
        {phase === 'playing' && (
          <p className="mint-next-reward" aria-live="polite">
            Sıradaki ×{combo + 1}: isabet +{rewardForCombo(combo + 1)} ·
            mükemmel +{Math.ceil(rewardForCombo(combo + 1) * 1.5)}
          </p>
        )}

        {phase === 'intro' && (
          <div className="mint-overlay">
            <p className="eyebrow">45 SANİYE · 5 HAK</p>
            <h3>Ritmi yakala.</h3>
            <p>
              Beyaz ibre parlak HEDEF yayının ortasına geldiğinde coine dokun.
              Her seri hedefi daraltır, ödülü büyütür.
            </p>
            <button className="button primary" onClick={startRound}>
              Ücretsiz turu başlat
            </button>
          </div>
        )}
        {phase === 'result' && (
          <div className="mint-overlay result" role="status">
            <p className="eyebrow">TUR TAMAMLANDI</p>
            <h3>+{reward} nakit</h3>
            <p>
              En iyi seri ×{bestCombo}.{' '}
              {preview
                ? 'Örnek ödül önizleme bakiyene eklendi.'
                : 'Güvenli ödül servisi bağlanana kadar bu tur bakiyeyi değiştirmez.'}
            </p>
            <button className="button primary" onClick={startRound}>
              Yeniden oyna
            </button>
          </div>
        )}
      </div>
      <div className="mint-progression" aria-label="Günlük ödül ilerlemesi">
        <div>
          <span>1</span>
          <strong>İlk Baskı</strong>
          <small>50 nakit</small>
        </div>
        <div>
          <span>2</span>
          <strong>Seri Ustası</strong>
          <small>×5 seri</small>
        </div>
        <div className="locked">
          <span>3</span>
          <strong>Günlük Kasa</strong>
          <small>3 tur tamamla</small>
        </div>
      </div>
    </section>
  );
}
