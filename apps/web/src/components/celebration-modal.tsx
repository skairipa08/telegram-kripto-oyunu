import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | undefined;
  rewardValue: string;
  badgeName?: string | undefined;
  icon?: string | undefined;
  actionLabel?: string | undefined;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  opacity: number;
  decay: number;
  shape: 'rect' | 'circle';
}

const CONFETTI_COLORS = [
  '#ffd700', // Gold
  '#f59e0b', // Amber
  '#7ed2ad', // Cyber Emerald
  '#38bdf8', // Neon Sky Blue
  '#ec4899', // Cyber Pink
  '#a855f7', // Purple
  '#ffffff', // Pure Sparkle
];

export function CelebrationModal({
  isOpen,
  onClose,
  title,
  subtitle,
  rewardValue,
  badgeName,
  icon = '🎉',
  actionLabel = 'Harika!',
}: CelebrationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    // Generate 60 physics confetti particles
    const particleCount = 65;
    const particles: ConfettiParticle[] = [];
    const originX = width / 2;
    const originY = height * 0.42;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 4;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
        vy: Math.sin(angle) * speed - (Math.random() * 5 + 3), // upward bias
        size: Math.random() * 8 + 6,
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1,
        decay: Math.random() * 0.008 + 0.007,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
      });
    }

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (p.opacity <= 0.02 || p.y > height + 20) continue;

        aliveCount++;

        // Physics update
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.vx *= 0.985; // air drag
        p.rotation += p.vRot;
        p.opacity = Math.max(0, p.opacity - p.decay);

        // Render particle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Self-terminate when all particles decay or fall out
      if (aliveCount > 0) {
        animationFrameRef.current = requestAnimationFrame(render);
      } else {
        isRunning = false;
        ctx.clearRect(0, 0, width, height);
      }
    };

    render();
  }, []);

  useEffect(() => {
    if (isOpen) {
      startConfetti();
    }
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen, startConfetti]);

  // Lock background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalMarkup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      aria-describedby={subtitle ? 'celebration-subtitle' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        minHeight: '100dvh',
        backgroundColor: 'rgba(5, 10, 18, 0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        animation: 'celebrationBackdropFadeIn 0.25s ease-out forwards',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Lightweight particle canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Pop-in Celebration Card */}
      <div
        className="panel celebration-card"
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '380px',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          margin: 'auto',
          background: 'linear-gradient(180deg, #182438 0%, #0d1624 100%)',
          border: '2px solid rgba(241, 201, 154, 0.5)',
          borderRadius: '24px',
          padding: '28px 22px 24px',
          textAlign: 'center',
          boxShadow:
            '0 0 35px rgba(245, 158, 11, 0.35), 0 25px 50px rgba(0, 0, 0, 0.7)',
          animation:
            'celebrationPopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        {/* Rotating God Rays Behind Icon */}
        <div
          style={{
            position: 'relative',
            width: '90px',
            height: '90px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, rgba(245, 158, 11, 0.15) 50%, transparent 70%)',
              animation: 'celebrationPulse 2s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontSize: '48px',
              filter: 'drop-shadow(0 4px 12px rgba(245, 158, 11, 0.6))',
              animation: 'celebrationIconBounce 1.5s ease-in-out infinite',
              display: 'inline-block',
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
        </div>

        {/* Title */}
        <div>
          <p
            className="eyebrow"
            style={{
              color: '#ffd700',
              fontWeight: 800,
              letterSpacing: '0.08em',
              margin: '0 0 4px 0',
              fontSize: '11px',
            }}
          >
            ÖDÜL KAZANILDI
          </p>
          <h2
            id="celebration-title"
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              id="celebration-subtitle"
              className="muted"
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.75)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Big Reward Pill */}
        <div
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '16px',
            background:
              'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(245, 158, 11, 0.25))',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            boxShadow: 'inset 0 0 16px rgba(255, 215, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: '#fef08a',
              textTransform: 'uppercase',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            Kazanılan Ödül
          </span>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#ffd700',
              textShadow: '0 2px 10px rgba(245, 158, 11, 0.6)',
              letterSpacing: '-0.02em',
            }}
          >
            {rewardValue}
          </span>
          {badgeName && (
            <span
              className="badge"
              style={{
                marginTop: '4px',
                background: 'linear-gradient(90deg, #eab308, #fef08a, #eab308)',
                color: '#0b0f17',
                fontWeight: 800,
                fontSize: '11px',
                boxShadow: '0 0 10px rgba(234, 179, 8, 0.5)',
              }}
            >
              🏆 {badgeName}
            </span>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="button"
          onClick={onClose}
          style={{
            width: '100%',
            minHeight: '46px',
            borderRadius: '14px',
            background:
              'linear-gradient(135deg, #ffd700 0%, #f59e0b 50%, #d97706 100%)',
            color: '#0b0f17',
            fontSize: '15px',
            fontWeight: 800,
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            marginTop: '4px',
          }}
        >
          {actionLabel}
        </button>
      </div>

      <style>{`
        @keyframes celebrationBackdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes celebrationPopIn {
          from {
            opacity: 0;
            transform: scale(0.85) translateY(12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes celebrationPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes celebrationIconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .celebration-card {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalMarkup;
  }

  return createPortal(modalMarkup, document.body);
}
