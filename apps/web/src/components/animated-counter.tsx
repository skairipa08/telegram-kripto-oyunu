import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { formatNumber } from '../game/ui';

export interface AnimatedCounterProps {
  value: number | null;
  compact?: boolean;
  durationMs?: number;
  showSparksOnIncrease?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface SparkParticle {
  id: number;
  dx: number;
  dy: number;
}

export function AnimatedCounter({
  value,
  compact = false,
  durationMs = 450,
  showSparksOnIncrease = true,
  className,
  ariaLabel,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(value);
  const [isBumping, setIsBumping] = useState(false);
  const [sparks, setSparks] = useState<SparkParticle[]>([]);
  const prevValueRef = useRef<number | null>(value);
  const animFrameRef = useRef<number | null>(null);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sparkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (value === null || prev === null) {
      setDisplayValue(value);
      return;
    }

    if (value === prev) {
      return;
    }

    // SSR or headless fallback guard
    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame === 'undefined'
    ) {
      setDisplayValue(value);
      return;
    }

    // Trigger bump and sparks on balance increase
    if (value > prev) {
      setIsBumping(true);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
      bumpTimerRef.current = setTimeout(() => {
        setIsBumping(false);
      }, 400);

      if (showSparksOnIncrease) {
        const newSparks: SparkParticle[] = Array.from(
          { length: 4 },
          (_, i) => ({
            id: Date.now() + i + Math.random(),
            dx: Math.round((Math.random() - 0.5) * 44),
            dy: Math.round(-14 - Math.random() * 24),
          }),
        );
        setSparks(newSparks);

        if (sparkTimerRef.current) clearTimeout(sparkTimerRef.current);
        sparkTimerRef.current = setTimeout(() => {
          setSparks([]);
        }, 650);
      }
    }

    // Cancel existing rAF animation if running
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startVal = displayValue ?? prev;
    const targetVal = value;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out curve for smooth deceleration
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (targetVal - startVal) * ease);

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetVal);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
      if (sparkTimerRef.current) clearTimeout(sparkTimerRef.current);
    };
  }, [value, durationMs, showSparksOnIncrease]);

  const formatted = formatNumber(displayValue, compact);

  return (
    <span
      className={`animated-counter-root ${isBumping ? 'balance-bump' : ''} ${className ?? ''}`.trim()}
      aria-label={ariaLabel}
    >
      <strong className="counter-digits">{formatted}</strong>
      {sparks.map((spark) => (
        <span
          key={spark.id}
          className="gold-spark"
          style={
            {
              '--dx': `${spark.dx}px`,
              '--dy': `${spark.dy}px`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          ✦
        </span>
      ))}
    </span>
  );
}
