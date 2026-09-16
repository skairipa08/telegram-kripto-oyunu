import { useEffect, useRef, useState } from 'react';
import {
  extendMemorySequence,
  memoryRewardForRound,
} from '../game/arcade-game-model';
import {
  playCipherKeySound,
  playDecryptPulseSound,
  playErrorSound,
  playWinSound,
} from '../game/arcade-audio';
import { hapticError, hapticSuccess, hapticTap } from '../game/arcade-haptics';
import './arcade.css';

const CYBER_SIGILS = [
  { symbol: '◆', label: '0x01 [ALPHA]' },
  { symbol: '●', label: '0x02 [BETA]' },
  { symbol: '▲', label: '0x03 [GAMMA]' },
  { symbol: '✦', label: '0x04 [DELTA]' },
];

export interface DynastyCipherGameProps {
  assistant?: boolean;
  onReward?: (amount: number) => void;
  preview?: boolean;
}

export function DynastyCipherGame({
  assistant = false,
  onReward,
}: DynastyCipherGameProps) {
  const [phase, setPhase] = useState<'intro' | 'showing' | 'input' | 'result'>(
    'intro',
  );
  const [sequence, setSequence] = useState<number[]>([0, 2, 1]);
  const [round, setRound] = useState<number>(1);
  const [inputIndex, setInputIndex] = useState<number>(0);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [lives, setLives] = useState<number>(5);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(1.0);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(7000);

  const timers = useRef<number[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach(window.clearTimeout);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, []);

  function stopCountdown() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  function startCountdown() {
    stopCountdown();
    setTimeLeftMs(7000);
    const interval = 100;
    countdownIntervalRef.current = window.setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= interval) {
          stopCountdown();
          handleTimeout();
          return 0;
        }
        return prev - interval;
      });
    }, interval);
  }

  function handleTimeout() {
    playErrorSound();
    hapticError();
    setCombo(1.0);
    const nextLives = lives - 1;
    setLives(nextLives);
    setInputIndex(0);

    if (nextLives <= 0) {
      setPhase('result');
    } else {
      showSequence(sequence);
    }
  }

  function showSequence(seq: number[] = sequence) {
    stopCountdown();
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setPhase('showing');
    setInputIndex(0);

    // Dynamic flash duration: faster with each round
    const stepDuration = Math.max(240, 480 - (round - 1) * 35);
    const gap = 120;

    seq.forEach((val, idx) => {
      timers.current.push(
        window.setTimeout(
          () => {
            setActiveNode(val);
            playCipherKeySound(val);
          },
          idx * (stepDuration + gap) + 200,
        ),
      );
      timers.current.push(
        window.setTimeout(
          () => {
            setActiveNode(null);
          },
          idx * (stepDuration + gap) + 200 + stepDuration,
        ),
      );
    });

    timers.current.push(
      window.setTimeout(
        () => {
          setPhase('input');
          startCountdown();
        },
        seq.length * (stepDuration + gap) + 250,
      ),
    );
  }

  function start() {
    const startSeq = [0, 2, 1];
    setSequence(startSeq);
    setRound(1);
    setLives(5);
    setScore(0);
    setCombo(1.0);
    showSequence(startSeq);
  }

  function handleChoose(nodeIndex: number) {
    if (phase !== 'input') return;

    playCipherKeySound(nodeIndex);
    hapticTap();

    if (nodeIndex !== sequence[inputIndex]) {
      // Mistake!
      stopCountdown();
      playErrorSound();
      hapticError();
      setCombo(1.0); // Reset combo
      const nextLives = lives - 1;
      setLives(nextLives);
      setInputIndex(0);

      if (nextLives <= 0) {
        setPhase('result');
      } else {
        showSequence(sequence);
      }
      return;
    }

    // Correct input!
    if (inputIndex + 1 < sequence.length) {
      setInputIndex((curr) => curr + 1);
      return;
    }

    // Completed full sequence for round!
    stopCountdown();
    playDecryptPulseSound();
    hapticSuccess();

    // Calculate combo multiplier progression: 1.0 -> 1.5 -> 2.0 -> 3.0 -> 5.0
    const nextCombo =
      combo < 1.5 ? 1.5 : combo < 2.0 ? 2.0 : combo < 3.0 ? 3.0 : 5.0;
    setCombo(nextCombo);

    const baseReward = memoryRewardForRound(round);
    const roundReward = Math.floor(baseReward * combo);
    const nextScore = score + roundReward;
    setScore(nextScore);
    if (onReward) onReward(roundReward);

    const nextRound = round + 1;
    if (nextRound > 6) {
      // Complete Firewall Breach!
      playWinSound();
      setPhase('result');
      return;
    }

    const nextSequence = extendMemorySequence(sequence, nextRound);
    setRound(nextRound);
    setSequence(nextSequence);
    showSequence(nextSequence);
  }

  const firewallPercentage = Math.min(100, Math.round(((round - 1) / 5) * 100));

  return (
    <div className="cipher-terminal" aria-label="Hanedan Şifresi Terminali">
      <div className="scanline-overlay" />

      {/* Cyber Header */}
      <div className="cipher-header">
        <div>
          <span className="cipher-sys-id">[SYS_OVERRIDE_V4]</span>
          <div
            style={{
              color: 'var(--text)',
              fontSize: '0.95rem',
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            Hanedan Şifresi
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {combo > 1.0 && (
            <span className="cipher-combo-badge">
              {combo.toFixed(1)}x ÇARPAN
            </span>
          )}
          <span
            style={{
              color: varColorForLives(lives),
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            {lives} HAK · {score} NAKİT
          </span>
        </div>
      </div>

      {/* Firewall Breach Progress */}
      <div className="firewall-gauge">
        <div className="firewall-info">
          <span>GÜVENLİK DUVARI KIRILMASI</span>
          <strong>{firewallPercentage}%</strong>
        </div>
        <div className="firewall-track">
          <div
            className="firewall-bar"
            style={{ width: `${firewallPercentage}%` }}
          />
        </div>
      </div>

      {/* Time Attack Countdown Bar */}
      {phase === 'input' && (
        <div className="cipher-timer-track">
          <div
            className="cipher-timer-bar"
            style={{ width: `${(timeLeftMs / 7000) * 100}%` }}
          />
        </div>
      )}

      {/* Assistant hint if active */}
      {assistant && phase === 'input' && (
        <p className="arcade-assist-active" style={{ zIndex: 2, margin: 0 }}>
          🤖 Şifre Botu: Sıradaki mühür{' '}
          {CYBER_SIGILS[sequence[inputIndex]!]?.symbol} (
          {CYBER_SIGILS[sequence[inputIndex]!]?.label})
        </p>
      )}

      {/* 2x2 Cyber Glyphs Grid */}
      <div className="cipher-grid-v2" role="group" aria-label="Şifre Düğümleri">
        {CYBER_SIGILS.map((sigil, index) => {
          const isActive = activeNode === index;
          return (
            <button
              key={sigil.label}
              className={`cipher-node-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleChoose(index)}
              disabled={phase !== 'input'}
              aria-label={`${sigil.label} ${sigil.symbol}`}
            >
              <span className="sigil">{sigil.symbol}</span>
              <span className="label">{sigil.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status Output */}
      <p className="cipher-status-line" aria-live="polite">
        {phase === 'showing'
          ? '>> DÜĞÜM VERİ AKIŞI İZLENİYOR...'
          : phase === 'input'
            ? `>> DÜZEY ${round}: ${inputIndex + 1}. MÜHÜRÜ ONAYLA`
            : phase === 'result'
              ? lives > 0
                ? `>> TAM ERİŞİM SAĞLANDI! +${score} NAKİT`
                : `>> ERİŞİM REDDEDİLDİ · ${score} NAKİT TOPLANDI`
              : '>> HACK DİZİLİMİNİ BAŞLATMAK İÇİN BUTONA BASIN.'}
      </p>

      {/* Action Button */}
      {(phase === 'intro' || phase === 'result') && (
        <button
          className="button primary"
          onClick={start}
          style={{ position: 'relative', zIndex: 2, width: '100%' }}
        >
          {phase === 'intro'
            ? '>> ŞİFREYİ ÇÖZMEYE BAŞLA'
            : '>> YENİDEN SIZMA GİRİŞİMİ'}
        </button>
      )}
    </div>
  );
}

function varColorForLives(lives: number): string {
  if (lives <= 1) return 'var(--red, #ff9e9e)';
  if (lives <= 3) return 'var(--accent, #e1b47e)';
  return 'var(--green, #7ed2ad)';
}
